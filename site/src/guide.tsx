import { useCallback, useEffect, useRef, useState } from 'react'
import { profile, projects } from './data/content'
import { realEmail, telHref } from './data/publish'

/*
 * Guiding people around the room, the way a film would:
 *  - Director's commentary: on the first visit, subtitles in my voice walk you around, turning the
 *    camera and pointing at things as they're mentioned.
 *  - Scenes: every clickable thing is a "scene". The slate in the corner counts what you've found and
 *    gives a cryptic hint for what you haven't.
 *  - That's a wrap: find them all and the end credits roll (ending, of course, with how to reach me).
 * Progress is remembered in this browser (localStorage), and everything works without it.
 */

export type Scene = { id: string; name: string; hint: string }

export const SCENES: Scene[] = [
  { id: 'monitor', name: 'The work screen', hint: 'Where I build things.' },
  { id: 'laptop', name: 'The lab', hint: 'Where the research happens.' },
  { id: 'papers', name: 'My papers', hint: 'Printed, stacked, under the lamp.' },
  { id: 'lamp', name: 'The desk lamp', hint: 'One switch for a cozy night.' },
  { id: 'jeepney', name: 'The jeepney', hint: 'The king of the road, parked on my desk.' },
  { id: 'cork', name: 'The corkboard', hint: 'Notes to self, pinned by the window.' },
  { id: 'parol', name: 'The parol', hint: 'A star that turns day into night.' },
  { id: 'baybayin', name: 'The baybayin scroll', hint: 'An old script, hanging on the window wall.' },
  { id: 'films', name: 'My top 4', hint: 'Four favourites, no frames.' },
  { id: 'credentials', name: 'The certificates', hint: 'Framed, and proud of it.' },
  { id: 'record', name: 'The record player', hint: 'Something that spins.' },
  { id: 'guitar', name: 'The guitar', hint: 'Six strings, waiting by the bed.' },
]

type Line = { text: string; look?: number; hint?: string }

/** The commentary: one subtitle at a time; `look` turns the camera, `hint` lights up an object's label. */
export const COMMENTARY: Line[] = [
  { text: 'You made it in. Welcome to my kwarto.', look: 1 },
  { text: 'The big screen is for work: projects, my résumé, the backend stuff.', look: 1, hint: 'monitor' },
  { text: 'The MacBook is my lab. The Filipino NLP research lives in there.', look: 1, hint: 'laptop' },
  { text: 'Over by the window, a corkboard full of notes to self.', look: 0, hint: 'cork' },
  { text: 'And on this side, four films I love and two certificates I’m proud of.', look: 2, hint: 'films' },
  { text: `There are ${SCENES.length} scenes hiding in here. Find them all and you get the credits.`, look: 1 },
]

const KEY = 'kwarto.v2'
type Saved = { found: string[]; heardCommentary: boolean; wrapped: boolean }
function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { found: Array.isArray(s.found) ? s.found : [], heardCommentary: !!s.heardCommentary, wrapped: !!s.wrapped }
  } catch {
    return { found: [], heardCommentary: false, wrapped: false }
  }
}
function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode etc.: progress just isn't kept */
  }
}

/** Scenes found, commentary state and the wrap, with persistence. */
export function useGuide() {
  const [saved, setSaved] = useState<Saved>(load)
  const update = useCallback((patch: Partial<Saved>) => {
    setSaved((s) => {
      const next = { ...s, ...patch }
      save(next)
      return next
    })
  }, [])
  const discover = useCallback(
    (id: string) => {
      setSaved((s) => {
        if (!SCENES.some((x) => x.id === id) || s.found.includes(id)) return s
        const next = { ...s, found: [...s.found, id] }
        save(next)
        return next
      })
    },
    [],
  )
  return { ...saved, discover, update }
}

/** Plays the commentary as subtitles. Advances on its own, on click, or skips. */
export function Commentary({ onLine, onDone }: { onLine: (l: Line) => void; onDone: () => void }) {
  const [i, setI] = useState(0)
  const line = COMMENTARY[i]
  const lineRef = useRef(onLine)
  lineRef.current = onLine
  useEffect(() => {
    if (!line) return onDone()
    lineRef.current(line)
    // long enough to read comfortably: ~60 ms a character, at least 3.5 s
    const id = setTimeout(() => setI((n) => n + 1), Math.max(3500, line.text.length * 62))
    return () => clearTimeout(id)
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!line) return null
  return (
    <div className="commentary" role="status" aria-live="polite">
      <div className="commentary__tag">
        Director&rsquo;s commentary · {i + 1}/{COMMENTARY.length}
      </div>
      <button className="commentary__line" onClick={() => setI((n) => n + 1)} title="Next">
        <span key={i}>{line.text}</span>
      </button>
      <button className="commentary__skip" onClick={onDone}>
        Skip commentary
      </button>
    </div>
  )
}

/** The slate in the corner: "Scenes 4/12", opening a call sheet of found and unfound scenes. */
export function ScenesSlate({ found, onReplay }: { found: string[]; onReplay: () => void }) {
  const [open, setOpen] = useState(false)
  const [bump, setBump] = useState(false)
  const prev = useRef(found.length)
  useEffect(() => {
    if (found.length > prev.current) {
      setBump(true)
      const id = setTimeout(() => setBump(false), 900)
      prev.current = found.length
      return () => clearTimeout(id)
    }
    prev.current = found.length
  }, [found.length])
  return (
    <div className="slate-wrap">
      <button className={`slate${bump ? ' slate--bump' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="slate__stripes" aria-hidden />
        <span>
          Scenes <b>{found.length}</b>/{SCENES.length}
        </span>
      </button>
      {open && (
        <div className="callsheet" role="dialog" aria-label="Scenes">
          <div className="callsheet__head">Call sheet</div>
          <ol>
            {SCENES.map((s) => {
              const got = found.includes(s.id)
              return (
                <li key={s.id} className={got ? 'is-found' : ''}>
                  <span className="callsheet__mark" aria-hidden>
                    {got ? '✓' : '·'}
                  </span>
                  {got ? s.name : <i>{s.hint}</i>}
                </li>
              )
            })}
          </ol>
          <button
            className="callsheet__replay"
            onClick={() => {
              setOpen(false)
              onReplay()
            }}
          >
            ▶ Replay the commentary
          </button>
        </div>
      )}
    </div>
  )
}

/** All scenes found: end credits roll. */
export function WrapCredits({ onClose }: { onClose: () => void }) {
  const email = realEmail(profile.email)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="wrap" role="dialog" aria-label="That's a wrap">
      <div className="wrap__roll">
        <p className="wrap__big">That&rsquo;s a wrap.</p>
        <p className="wrap__sub">You found every scene in the room.</p>
        <dl>
          <dt>Written, directed &amp; debugged by</dt>
          <dd>{profile.name}</dd>
          <dt>Backend &amp; databases</dt>
          <dd>{profile.shortName}</dd>
          <dt>Filipino NLP research</dt>
          <dd>{projects[0]?.title} · {projects[1]?.title}</dd>
          <dt>Featuring</dt>
          <dd>{SCENES.map((s) => s.name.replace(/^(The|My) /, '')).join(' · ')}</dd>
          <dt>Shot in</dt>
          <dd>Manila, Philippines</dd>
          <dt>Lit in</dt>
          <dd>Blender · rendered in three.js</dd>
        </dl>
        <p className="wrap__thanks">Salamat sa panonood. Thanks for watching.</p>
        <div className="wrap__cta">
          {email && (
            <a className="btn btn--cine" href={`mailto:${email}`}>
              ✉ {email}
            </a>
          )}
          {profile.phone && (
            <a className="btn btn--ghost" href={telHref(profile.phone)}>
              ☎ {profile.phone}
            </a>
          )}
        </div>
      </div>
      <button className="btn btn--ghost btn--sm wrap__close" onClick={onClose}>
        Back to the room
      </button>
    </div>
  )
}
