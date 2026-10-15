import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { profile, projects } from '../data/content'
import type { Weather } from '../hooks/useManila'
import { AboutApp, ContactApp, CredentialsApp, FilmsApp, FinderApp, ProjectApp, ResumeApp, TagaBaybayApp, TerminalApp } from './apps'
import { AppIcon, type IconKind } from './icons'

export type AppId = 'finder' | 'about' | 'resume' | 'credentials' | 'tagabaybay' | 'terminal' | 'films' | 'contact' | 'project'

export type OpenApp = (app: AppId, arg?: string) => void

type Win = {
  key: string
  app: AppId
  arg?: string
  x: number
  y: number
  w: number
  h: number
  z: number
  minimized: boolean
  maximized: boolean
}

const META: Record<AppId, { title: string; icon: IconKind; w: number; h: number }> = {
  finder: { title: 'Projects', icon: 'folder', w: 640, h: 420 },
  about: { title: 'About Me', icon: 'about', w: 560, h: 520 },
  resume: { title: 'Resume.pdf', icon: 'pdf', w: 620, h: 640 },
  credentials: { title: 'Credentials', icon: 'credentials', w: 560, h: 420 },
  tagabaybay: { title: 'TagaBaybay', icon: 'tagabaybay', w: 520, h: 560 },
  terminal: { title: 'Terminal — jaztin@kwarto', icon: 'terminal', w: 620, h: 400 },
  films: { title: 'Films', icon: 'films', w: 480, h: 380 },
  contact: { title: 'Contact', icon: 'contact', w: 460, h: 340 },
  project: { title: 'Project', icon: 'doc', w: 620, h: 560 },
}

const DESKTOP_ICONS: { app: AppId; label: string; icon: IconKind }[] = [
  { app: 'finder', label: 'Projects', icon: 'folder' },
  { app: 'about', label: 'About Me', icon: 'about' },
  { app: 'resume', label: 'Resume.pdf', icon: 'pdf' },
  { app: 'credentials', label: 'Credentials', icon: 'credentials' },
  { app: 'tagabaybay', label: 'TagaBaybay', icon: 'tagabaybay' },
]

const DOCK: AppId[] = ['finder', 'about', 'tagabaybay', 'terminal', 'films', 'contact']

type Props = {
  clock: string
  weather: Weather | null
  night: boolean
  initialApp?: AppId
  onExit: () => void
}

export default function Desktop({ clock, weather, night, initialApp, onExit }: Props) {
  const [wins, setWins] = useState<Win[]>([])
  const zTop = useRef(10)
  const count = useRef(0)
  const narrow = useNarrow()

  const focus = useCallback((key: string) => {
    zTop.current += 1
    const z = zTop.current
    setWins((ws) => ws.map((w) => (w.key === key ? { ...w, z, minimized: false } : w)))
  }, [])

  const open: OpenApp = useCallback((app, arg) => {
    const key = app === 'project' ? `project:${arg}` : app
    setWins((ws) => {
      zTop.current += 1
      const existing = ws.find((w) => w.key === key)
      if (existing) return ws.map((w) => (w.key === key ? { ...w, z: zTop.current, minimized: false } : w))
      const m = META[app]
      const n = count.current++
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.min(m.w, vw - 40)
      const h = Math.min(m.h, vh - 130)
      const x = Math.max(16, Math.min(vw - w - 120, 70 + (n % 6) * 34))
      const y = Math.max(36, Math.min(vh - h - 90, 50 + (n % 6) * 28))
      return [...ws, { key, app, arg, x, y, w, h, z: zTop.current, minimized: false, maximized: false }]
    })
  }, [])

  const close = (key: string) => setWins((ws) => ws.filter((w) => w.key !== key))
  const patch = (key: string, p: Partial<Win>) => setWins((ws) => ws.map((w) => (w.key === key ? { ...w, ...p } : w)))

  useEffect(() => {
    if (initialApp) open(initialApp)
  }, [initialApp, open])

  const active = wins.filter((w) => !w.minimized).sort((a, b) => b.z - a.z)[0]
  const activeTitle = active ? titleFor(active) : 'Finder'

  return (
    <div className={`desktop${night ? ' desktop--night' : ''}`}>
      <div className="menubar">
        <span className="menubar__logo" aria-hidden>
          ✦
        </span>
        <b>{activeTitle}</b>
        <span className="menubar__item hide-sm">File</span>
        <span className="menubar__item hide-sm">View</span>
        <span className="menubar__item hide-sm">Window</span>
        <span className="menubar__spacer" />
        {weather && (
          <span className="menubar__item hide-sm" title={`${weather.label} in Manila right now`}>
            {weather.icon} {weather.temp}° Manila
          </span>
        )}
        <span className="menubar__item">{clock}</span>
        <button className="menubar__back" onClick={onExit}>
          ← Room
        </button>
      </div>

      <div className="desk-icons">
        {DESKTOP_ICONS.map((i) => (
          <button key={i.app} className="desk-icon" onClick={() => open(i.app)}>
            <AppIcon kind={i.icon} size={54} />
            <span>{i.label}</span>
          </button>
        ))}
      </div>

      <div className="desktop__watermark">
        <div className="desktop__hello">Hi, I'm {profile.shortName}.</div>
        <div>{profile.headline}</div>
        <div className="desktop__tip">Open a folder to explore, or try TagaBaybay in the dock.</div>
      </div>

      {wins.map((w) => (
        <Window
          key={w.key}
          win={w}
          narrow={narrow}
          title={titleFor(w)}
          active={active?.key === w.key}
          onFocus={() => focus(w.key)}
          onClose={() => close(w.key)}
          onMinimize={() => patch(w.key, { minimized: true })}
          onMaximize={() => patch(w.key, { maximized: !w.maximized })}
          onMove={(x, y) => patch(w.key, { x, y })}
        >
          <AppBody win={w} open={open} onExit={onExit} />
        </Window>
      ))}

      <nav className="dock" aria-label="Dock">
        {DOCK.map((app) => {
          const running = wins.some((w) => w.app === app)
          return (
            <button key={app} className="dock__item" onClick={() => open(app)} title={META[app].title}>
              <AppIcon kind={META[app].icon} size={46} />
              <span className="dock__tip">{META[app].title.split(' —')[0]}</span>
              {running && <span className="dock__dot" />}
            </button>
          )
        })}
        <span className="dock__sep" />
        <button className="dock__item" onClick={onExit} title="Back to the room">
          <AppIcon kind="room" size={46} />
          <span className="dock__tip">Back to the room</span>
        </button>
      </nav>
    </div>
  )
}

function titleFor(w: Win) {
  if (w.app === 'project') return projects.find((p) => p.id === w.arg)?.title ?? 'Project'
  return META[w.app].title
}

function AppBody({ win, open, onExit }: { win: Win; open: OpenApp; onExit: () => void }) {
  switch (win.app) {
    case 'finder':
      return <FinderApp open={open} />
    case 'about':
      return <AboutApp open={open} />
    case 'resume':
      return <ResumeApp />
    case 'credentials':
      return <CredentialsApp />
    case 'tagabaybay':
      return <TagaBaybayApp initialWord={win.arg} />
    case 'terminal':
      return <TerminalApp open={open} onExit={onExit} />
    case 'films':
      return <FilmsApp />
    case 'contact':
      return <ContactApp />
    case 'project':
      return <ProjectApp id={win.arg ?? ''} open={open} />
  }
}

function Window({
  win,
  title,
  active,
  narrow,
  children,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onMove,
}: {
  win: Win
  title: string
  active: boolean
  narrow: boolean
  children: ReactNode
  onFocus: () => void
  onClose: () => void
  onMinimize: () => void
  onMaximize: () => void
  onMove: (x: number, y: number) => void
}) {
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const full = narrow || win.maximized

  const onPointerDown = (e: React.PointerEvent) => {
    if (full || (e.target as HTMLElement).closest('.traffic')) return
    drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const x = Math.min(window.innerWidth - 80, Math.max(-win.w + 120, e.clientX - drag.current.dx))
    const y = Math.min(window.innerHeight - 60, Math.max(28, e.clientY - drag.current.dy))
    onMove(x, y)
  }
  const onPointerUp = () => (drag.current = null)

  const style: React.CSSProperties = full
    ? { zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z }

  return (
    <section
      className={`window${active ? ' window--active' : ''}${full ? ' window--full' : ''}${win.minimized ? ' window--min' : ''}`}
      style={style}
      onPointerDown={onFocus}
      aria-label={title}
    >
      <header className="window__bar" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={onMaximize}>
        <div className="traffic">
          <button className="traffic__btn traffic__close" onClick={onClose} aria-label="Close" />
          <button className="traffic__btn traffic__min" onClick={onMinimize} aria-label="Minimize" />
          <button className="traffic__btn traffic__max" onClick={onMaximize} aria-label="Maximize" />
        </div>
        <div className="window__title">{title}</div>
      </header>
      <div className="window__body">{children}</div>
    </section>
  )
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 720)
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 720)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return narrow
}
