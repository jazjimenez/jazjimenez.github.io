import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { letterboxd, papers, profile, roomExtras, TMDB_CREDIT } from './data/content'
import { pub, pubList } from './data/publish'
import Desktop, { type AppId } from './desktop/Desktop'
import { Commentary, SCENES, ScenesSlate, useGuide, WrapCredits } from './guide'
import { setLandingPaused } from './room/landingMotion'
import { isManilaNight, useManilaClock, useManilaWeather } from './hooks/useManila'
import Plain from './plain/Plain'
import type { RoomExtraKey } from './room/Room'
import type { FocusId, ScreenId } from './room/screenPortal'
import { PORTAL_ID } from './room/portalId'

const Room = lazy(() => import('./room/Room'))

// entering/leaving: the camera is leaning in to (or back from) the laptop, with the desktop on its screen
// landing: welcome page over a third-person view of the room (scroll down for the simple version)
// arriving: flying in to the chair
type View = 'landing' | 'arriving' | 'room' | 'entering' | 'desktop' | 'leaving'

const RESUME_URL = `${import.meta.env.BASE_URL}${profile.resume}`

function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

/** Eased scroll (slower and more decisive than the browser's smooth scroll). Calls `done` when it lands. */
let gliding = false
function glideTo(el: HTMLElement, top: number, done?: () => void, ms = 1050) {
  if (top > 0) setLandingPaused(true) // stop drawing the room before the first frame moves
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.scrollTop = top
    setLandingPaused(top > 0)
    return void done?.()
  }
  const from = el.scrollTop
  const start = performance.now()
  gliding = true
  el.style.scrollBehavior = 'auto'
  // easeInOutQuart: a firm push off, a long soft landing
  const ease = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2)
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms)
    el.scrollTop = from + (top - from) * ease(t)
    if (t < 1) return void requestAnimationFrame(step)
    el.style.scrollBehavior = ''
    gliding = false
    if (top <= 0) setLandingPaused(false) // back on the welcome screen: the room drifts again
    done?.()
  }
  requestAnimationFrame(step)
}

/**
 * The landing page has two resting places: the welcome screen and the top of the simple version.
 * Any scroll between them (wheel, trackpad, swipe, keys) commits to one and glides all the way there,
 * so the page never sits half-way. Inside the simple version, scrolling is normal.
 */
function useLandingSnap(scroller: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    const el = scroller.current
    if (!active || !el) return
    let quietUntil = 0 // swallow trackpad momentum for a moment after each glide
    let touchY: number | null = null
    let atTopSince = 0 // when scrolling up through the simple version last reached its top
    const simpleTop = () => document.getElementById('simple')?.offsetTop ?? el.clientHeight
    const go = (dir: 1 | -1) => {
      glideTo(el, dir > 0 ? simpleTop() : 0, () => (quietUntil = performance.now() + 450))
    }
    /** Should input in direction `dir` be taken over by a glide (true), or scroll normally (false)? */
    const takeOver = (dir: 1 | -1) => {
      const top = simpleTop()
      if (el.scrollTop < top - 2) return true // on the welcome screen or in between
      return dir < 0 && el.scrollTop <= top + 2 // at the very top of the simple version, going up
    }
    const busy = () => gliding || performance.now() < quietUntil

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 2) return
      const dir = e.deltaY > 0 ? 1 : -1
      if (busy()) {
        if (takeOver(dir) || gliding || el.scrollTop <= simpleTop() + 2) e.preventDefault()
        return
      }
      const top = simpleTop()
      // Flicking up while reading: stop at the top of the simple version instead of flying past it.
      if (dir < 0 && el.scrollTop > top + 2 && el.scrollTop + e.deltaY < top) {
        e.preventDefault()
        el.style.scrollBehavior = 'auto'
        el.scrollTop = top
        el.style.scrollBehavior = ''
        atTopSince = performance.now()
        return
      }
      if (!takeOver(dir)) return
      e.preventDefault()
      if (dir < 0 && el.scrollTop <= 0) return
      // …and only a fresh scroll up from there (not the same flick's momentum) goes back to the welcome screen
      if (dir < 0 && performance.now() - atTopSince < 400) {
        atTopSince = performance.now()
        return
      }
      go(dir)
    }
    const onTouchStart = (e: TouchEvent) => (touchY = e.touches[0].clientY)
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null) return
      const dy = touchY - e.touches[0].clientY // > 0: swiping up = scrolling down
      const dir = dy > 0 ? 1 : -1
      if (busy() || !takeOver(dir)) {
        if (gliding) e.preventDefault()
        return
      }
      e.preventDefault()
      if (Math.abs(dy) > 24 && !(dir < 0 && el.scrollTop <= 0)) {
        touchY = null
        go(dir)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      const down = ['ArrowDown', 'PageDown', ' '].includes(e.key)
      const up = ['ArrowUp', 'PageUp'].includes(e.key)
      if ((!down && !up) || (e.target as HTMLElement)?.closest?.('input, textarea, button, a')) return
      const dir = down ? 1 : -1
      if (busy() || !takeOver(dir)) return
      e.preventDefault()
      if (!(dir < 0 && el.scrollTop <= 0)) go(dir)
    }
    // Safety net (e.g. dragging the scrollbar): if it comes to rest in between, finish the move.
    let settle = 0
    const onScroll = () => {
      clearTimeout(settle)
      settle = window.setTimeout(() => {
        const top = simpleTop()
        if (gliding || el.scrollTop <= 1 || el.scrollTop >= top - 1) return
        glideTo(el, el.scrollTop > top * 0.35 ? top : 0, () => (quietUntil = performance.now() + 450), 700)
      }, 160)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(settle)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKey)
    }
  }, [scroller, active])
}

/** Landing → simple version hand-off at progress p (0..1). Compositor-only: transform + opacity. */
function applyLandingProgress(app: HTMLElement, p: number) {
  const q = (sel: string) => app.querySelector<HTMLElement>(sel)
  const set = (el: HTMLElement | null, transform: string | null, opacity: number | null) => {
    if (!el) return
    if (transform !== null) el.style.transform = transform
    if (opacity !== null) el.style.opacity = String(Math.max(0, Math.min(1, opacity)))
  }
  const vh = app.clientHeight / 100
  // the room stays put and simply dims behind the rising sheet
  set(q('.landing-dim'), null, 0.95 * p)
  // the title card shoots up, shrinks and fades; the letterbox bars pull away
  set(q('.welcome__card'), `translate3d(0, ${(-28 * vh * p).toFixed(1)}px, 0) scale(${(1 - 0.16 * p).toFixed(4)})`, 1 - 2 * p)
  set(q('.cine-bar--top'), `translate3d(0, ${(-100 * Math.min(1, 2 * p)).toFixed(1)}%, 0)`, null)
  set(q('.cine-bar--bottom'), null, 1 - 4 * p)
  set(q('.frame-corners'), null, 1 - 3 * p)
  // the simple version rises as a card and grows to full width
  set(q('.simple-section'), `scale(${(0.86 + 0.14 * p).toFixed(4)})`, null)
  set(q('.simple-section__handle'), null, (1 - p) * 0.25)
}

/** The three places you can look from the chair, named like a shot list. */
const SHOTS = ['Window', 'Desk', 'Shelf'] as const

/** Live Manila time, HH:MM:SS. Updates its own text node, so it never re-renders the app. */
function Timecode() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    const tick = () => {
      if (ref.current) ref.current.textContent = fmt.format(new Date())
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <span ref={ref} className="tc" />
}

/** Blinking "● REC" with the scene heading, like a camera's on-screen display. */
function Slug({ night }: { night: boolean }) {
  return (
    <span className="slug">
      <span className="rec">
        <i aria-hidden /> REC
      </span>
      <span>INT. KWARTO — {night ? 'NIGHT' : 'DAY'}</span>
    </span>
  )
}

function setHash(hash: string) {
  if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search)
}

export default function App() {
  const webgl = useState(hasWebGL)[0]
  const [view, setView] = useState<View>(() => {
    if (location.hash === '#laptop') return 'desktop' // shareable link straight to the laptop
    if (location.hash === '#room') return 'room' // skip the welcome page
    return 'landing'
  })
  const [nightOverride, setNightOverride] = useState<boolean | null>(null)
  const [look, setLook] = useState(1) // 0 left · 1 center (desk) · 2 right
  const [focus, setFocus] = useState<FocusId | null>(null) // zoomed in on the corkboard
  const turn = (dir: -1 | 1) => {
    if (!focus) setLook((l) => Math.min(2, Math.max(0, l + dir)))
  }
  const [extra, setExtra] = useState<RoomExtraKey | null>(null)
  // which screen you leaned in to: the monitor is Work, the MacBook is the Lab
  const [screen, setScreen] = useState<ScreenId>('monitor')
  // the guided tour: commentary on the first visit, the scenes you've found, the wrap
  const guide = useGuide()
  const [commentaryOn, setCommentaryOn] = useState(false)
  const [hintId, setHintId] = useState<string | null>(null)
  const [wrapOpen, setWrapOpen] = useState(false)
  const [initialApp, setInitialApp] = useState<AppId | undefined>()
  const clock = useManilaClock()
  const weather = useManilaWeather()
  const night = nightOverride ?? isManilaNight(clock.now)
  const [cozyPick, setCozy] = useState(false)
  const cozy = night && cozyPick
  // landing page scroll: the simple version lives below the welcome screen
  const scroller = useRef<HTMLDivElement>(null)
  const [wantSimple, setWantSimple] = useState(() => location.hash === '#simple')
  const appRef = useRef<HTMLDivElement>(null)
  useLandingSnap(scroller, view === 'landing')
  const scrollToSimple = () => {
    const el = scroller.current
    const target = document.getElementById('simple')
    if (el && target) glideTo(el, target.offsetTop)
  }


  useEffect(() => {
    if (view === 'landing') return // the landing page sets #simple itself while scrolling
    const hash = view === 'desktop' ? '#laptop' : view === 'room' ? '#room' : ''
    setHash(hash)
  }, [view])

  // arriving at the landing page asking for the simple version (#simple link or "Simple version" in the room)
  useEffect(() => {
    if (view !== 'landing' || !wantSimple) return
    const id = requestAnimationFrame(() => {
      const el = scroller.current
      const target = document.getElementById('simple')
      if (el && target) {
        // jump straight there (no smooth scrolling or snapping on the way)
        el.style.scrollBehavior = el.style.scrollSnapType = 'auto'
        el.scrollTop = target.offsetTop
        requestAnimationFrame(() => (el.style.scrollBehavior = el.style.scrollSnapType = ''))
      }
      setWantSimple(false)
    })
    return () => cancelAnimationFrame(id)
  }, [view, wantSimple])

  // Scroll progress from the welcome screen (0) to the simple version (1) drives the hand-off.
  // Only transform and opacity are touched, on a handful of layers, so the GPU composites each frame
  // without re-laying out or repainting the page. The 3D room stops drawing as soon as you scroll.
  const onLandingScroll = () => {
    const el = scroller.current
    const app = appRef.current
    if (!el || !app) return
    const p = Math.min(1, Math.max(0, el.scrollTop / el.clientHeight))
    applyLandingProgress(app, p)
    // no React state here: re-rendering mid-scroll would hitch the animation
    setLandingPaused(p > 0.01 || gliding)
    setHash(p > 0.6 ? '#simple' : '')
  }
  useEffect(() => {
    if (view === 'landing') return
    if (appRef.current) applyLandingProgress(appRef.current, 0)
    setLandingPaused(false)
  }, [view])

  // The simple version's sections fade up as they scroll into view.
  useEffect(() => {
    const root = scroller.current
    if (view !== 'landing' || !root) return
    const items = root.querySelectorAll('.simple-section .sv > *')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
      },
      { root, threshold: 0.12 },
    )
    items.forEach((i) => io.observe(i))
    return () => io.disconnect()
  }, [view])

  // Escape steps back out of the corkboard close-up; leaving the room resets it.
  useEffect(() => {
    if (!focus) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFocus(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus])
  useEffect(() => {
    if (view !== 'room') setFocus(null)
  }, [view])

  const goToLaptop = (app?: AppId, on: ScreenId = 'monitor') => {
    setExtra(null)
    setFocus(null)
    setCommentaryOn(false)
    setHintId(null)
    setScreen(on)
    setInitialApp(app)
    setView('entering')
  }

  // First time in the room: the director's commentary walks you around.
  useEffect(() => {
    if (view === 'room' && !guide.heardCommentary) setCommentaryOn(true)
  }, [view, guide.heardCommentary])
  const endCommentary = () => {
    setCommentaryOn(false)
    setHintId(null)
    guide.update({ heardCommentary: true })
  }
  // Every scene found: roll the credits (once), after a beat so the last card can be read.
  useEffect(() => {
    if (view !== 'room' || guide.wrapped || guide.found.length < SCENES.length) return
    const id = setTimeout(() => setWrapOpen(true), 1600)
    return () => clearTimeout(id)
  }, [view, guide.wrapped, guide.found.length])

  // Safety net: if the 3D room isn't ready to animate the way back (e.g. still loading), don't get stuck.
  useEffect(() => {
    if (view !== 'leaving') return
    const id = setTimeout(() => setView('room'), 4000)
    return () => clearTimeout(id)
  }, [view])

  // No WebGL: just the simple version.
  if (!webgl) return <Plain webgl={false} onEnterRoom={() => {}} />

  const card = extra ? roomExtras[extra] : null

  return (
    <div className={`app${night ? ' app--night' : ''}`} ref={appRef}>
      <div className="stage">
        <Suspense
          fallback={
            <div className="loading" role="status">
              <div className="leader" aria-hidden>
                <span className="leader__sweep" />
                <span className="leader__cross" />
              </div>
              <span className="loading__text">Setting up the room…</span>
            </div>
          }
        >
          <Room
            night={night}
            cozy={cozy}
            onLamp={() => {
              // daytime: jump straight to a cozy night; at night: toggle the big light
              if (!night) {
                setNightOverride(true)
                setCozy(true)
              } else setCozy(!cozyPick)
            }}
            rainy={!!weather?.rainy}
            paused={view === 'desktop'}
            laptopMode={view === 'entering' || view === 'leaving' ? view : view === 'desktop' ? 'inside' : 'seat'}
            intro={view === 'landing' ? 'landing' : view === 'arriving' ? 'arriving' : 'done'}
            onArrived={() => setView('room')}
            onEnteredLaptop={() => setView('desktop')}
            onLeftLaptop={() => {
              setInitialApp(undefined)
              setView('room')
            }}
            onOpenLaptop={(on) => goToLaptop(undefined, on)}
            screen={screen}
            hintId={view === 'room' ? hintId : null}
            onDiscover={guide.discover}
            onOpenCredentials={() => goToLaptop('credentials')}
            onToggleNight={() => {
              setNightOverride(!night)
              setCozy(false)
            }}
            onExtra={setExtra}
            focus={focus}
            onFocus={(f) => {
              setExtra(null)
              if (f && commentaryOn) endCommentary()
              setFocus(f)
            }}
            look={look}
            onLookRequest={turn}
          />
        </Suspense>
      </div>

      {view === 'landing' && <div className="landing-dim" aria-hidden />}
      {(view === 'landing' || view === 'arriving') && (
        <div className={`landing-scroll${view === 'arriving' ? ' landing--leaving' : ''}`} ref={scroller} onScroll={onLandingScroll}>
        <section className="welcome" aria-label="Welcome">
          <div className="grain" aria-hidden />
          <div className="frame-corners" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </div>
          <header className="cine-bar cine-bar--top">
            <Slug night={night} />
            <span className="cine-bar__mid hide-sm">Reel 01 · a portfolio in one room</span>
            <span className="cine-bar__tc">
              MNL <Timecode />
            </span>
          </header>
          <div className="welcome__card">
            <p className="welcome__eyebrow">Mabuhay — come on in</p>
            <h1 className="welcome__title" lang="tl">
              <span>Kwarto</span> <em>ni Jaztin</em>
            </h1>
            <p className="welcome__subtitle">
              <span>
                <i lang="tl">kwarto</i> (n.) — room. Jaztin&rsquo;s room.
              </span>
            </p>
            <p className="welcome__lede">{profile.headline}</p>
            <p className="welcome__text">
              Take a seat at my desk and open the computer for my projects and research. Look around, too: a few things in here have stories.
            </p>
            <div className="welcome__actions">
              <button className="btn btn--cine" onClick={() => setView('arriving')} autoFocus>
                <span aria-hidden>▶</span> Enter the room
              </button>
              <a className="btn btn--ghost" href={RESUME_URL} target="_blank" rel="noreferrer">
                Resume ↗
              </a>
            </div>
          </div>
          <footer className="cine-bar cine-bar--bottom">
            <span className="cine-credit hide-sm">
              <b>Starring</b> backend &amp; databases · Filipino NLP
            </span>
            <button className="welcome__more" onClick={scrollToSimple}>
              Simple version
              <span className="welcome__chevron" aria-hidden>
                ↓
              </span>
            </button>
            <span className="cine-credit cine-credit--right hide-sm">
              <b>Shot in</b> Manila · lit in Blender · three.js
            </span>
          </footer>
        </section>
        <section id="simple" className="simple-section" aria-label="Simple version">
          <div className="simple-section__handle" aria-hidden />
          <Plain
            webgl
            onEnterRoom={() => {
              if (scroller.current) glideTo(scroller.current, 0, () => setView('arriving'))
              else setView('arriving')
            }}
          />
        </section>
        </div>
      )}

      {view === 'room' && (
        <>
          <div className="viewfinder" aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </div>
          <header className="hud hud--top">
            <div className="hud__slug">
              <Slug night={night} />
              <span className="cine-bar__tc hide-sm">
                MNL <Timecode />
              </span>
            </div>
            <div className="hud__actions">
              <ScenesSlate found={guide.found} onReplay={() => setCommentaryOn(true)} />
              <a className="btn btn--ghost btn--sm" href={RESUME_URL} target="_blank" rel="noreferrer">
                Resume ↗
              </a>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setWantSimple(true)
                  setView('landing')
                }}
              >
                Simple version
              </button>
            </div>
          </header>
          <div className="lower-third">
            <div className="lower-third__name">{profile.name}</div>
            <div className="lower-third__role">Backend &amp; databases · Filipino NLP</div>
          </div>
          {focus ? (
            <>
              <button className="btn btn--ghost btn--sm focus-back" onClick={() => setFocus(null)} autoFocus>
                ← Back
              </button>
              <div className="hud hud--bottom">
                {focus === 'certs' ? (
                  <button className="btn btn--cine" onClick={() => goToLaptop('credentials')}>
                    See all my credentials →
                  </button>
                ) : (
                  <span className="hud__hint">My corkboard · Esc to step back</span>
                )}
              </div>
            </>
          ) : (
            <div className="hud hud--bottom">
              {commentaryOn && (
                <Commentary
                  onLine={(l) => {
                    if (l.look !== undefined) setLook(l.look)
                    setHintId(l.hint ?? null)
                  }}
                  onDone={endCommentary}
                />
              )}
              <nav className="shots" aria-label="Look around">
                {SHOTS.map((name, i) => (
                  <button key={name} className={`shot${i === look ? ' shot--on' : ''}`} onClick={() => setLook(i)} aria-current={i === look}>
                    <span className="shot__n">{i + 1}</span>
                    {name}
                  </button>
                ))}
              </nav>
              <span className="hud__hint">
                <span className="hint--mouse">← → or rest at an edge to look around</span>
                <span className="hint--touch">Swipe to look around</span> · click anything that glows
              </span>
            </div>
          )}
          {wrapOpen && (
            <WrapCredits
              onClose={() => {
                setWrapOpen(false)
                guide.update({ wrapped: true })
              }}
            />
          )}
          {card && extra && (
            <aside className="extra" role="dialog" aria-label={card.title}>
              <div className="extra__slate" aria-hidden>
                <span>
                  Scene · <b>{extra}</b>
                </span>
              </div>
              <button className="extra__close" onClick={() => setExtra(null)} aria-label="Close">
                ×
              </button>
              <h3>{card.title}</h3>
              {pubList([...card.lines]).map((l) => (
                <p key={l}>{l}</p>
              ))}
              {pubList([...card.lines]).length === 0 && <p className="muted">More on this soon.</p>}
              {extra === 'papers' && (
                <ul className="extra__papers">
                  {papers.map((pp) => (
                    <li key={pp.title}>
                      <div className="extra__paper-title">{pub(pp.title)}</div>
                      <div className="muted">{[pub(pp.venue), pub(pp.status)].filter(Boolean).join(' · ')}</div>
                      <div className="extra__paper-authors">{pub(pp.authors)}</div>
                      {pp.links.length > 0 && (
                        <div className="extra__paper-links">
                          {pp.links.map((l) => (
                            <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                              {l.label} ↗
                            </a>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {extra === 'films' && (
                <ol className="extra__films">
                  {letterboxd.favorites.map((f) => (
                    <li key={f.url}>
                      <a href={f.url} target="_blank" rel="noreferrer">
                        {f.title}
                      </a>{' '}
                      <span className="muted">({f.year})</span>
                    </li>
                  ))}
                </ol>
              )}
              {extra === 'films' && (
                <a className="btn btn--primary" href={letterboxd.profile} target="_blank" rel="noreferrer">
                  My Letterboxd ↗
                </a>
              )}
              {extra === 'films' && <p className="extra__credit">{TMDB_CREDIT}</p>}
              {extra === 'jeepney' && (
                <button className="btn btn--primary" onClick={() => goToLaptop()}>
                  Sakay na → my work
                </button>
              )}
              {(extra === 'films' || extra === 'music') && (
                <button className="btn" onClick={() => goToLaptop('films')}>
                  Open Films on the laptop
                </button>
              )}
            </aside>
          )}
        </>
      )}

      {(view === 'entering' || view === 'desktop' || view === 'leaving') && (
        // The 3D rig maps this onto the laptop screen during entering/leaving (see room/screenPortal.ts).
        <div
          id={PORTAL_ID}
          className={`screen-portal${view === 'desktop' ? '' : ' screen-portal--moving'}`}
          style={view === 'entering' ? { opacity: 0 } : undefined}
        >
          <Desktop
            clock={clock.label}
            weather={weather}
            night={night}
            initialApp={initialApp}
            mode={screen === 'laptop' ? 'lab' : 'work'}
            onExit={() => setView('leaving')}
          />
        </div>
      )}
    </div>
  )
}
