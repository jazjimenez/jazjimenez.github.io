import { useEffect, useRef, useState, type FormEvent } from 'react'
import { credentials, letterboxd, profile, projects, roomExtras, TMDB_CREDIT } from '../data/content'
import { EXAMPLE_WORDS, lookup, type Trace } from '../data/tagabaybay'
import type { OpenApp } from './Desktop'
import { AppIcon } from './icons'

const RESUME_URL = `${import.meta.env.BASE_URL}${profile.resume}`

/* ---------- Finder: the Projects folder ---------- */

export function FinderApp({ open }: { open: OpenApp }) {
  return (
    <div className="finder">
      <aside className="finder__side">
        <div className="finder__group">Favorites</div>
        <button className="finder__link finder__link--on">📁 Projects</button>
        <button className="finder__link" onClick={() => open('credentials')}>
          🎓 Credentials
        </button>
        <button className="finder__link" onClick={() => open('resume')}>
          📄 Resume.pdf
        </button>
        <button className="finder__link" onClick={() => open('about')}>
          🙂 About Me
        </button>
      </aside>
      <div className="finder__main">
        <div className="finder__path">Jaztin › Projects · {projects.length} items</div>
        <div className="finder__grid">
          {projects.map((p) => (
            <button key={p.id} className="finder__item" onClick={() => open('project', p.id)}>
              <AppIcon kind={p.app === 'tagabaybay' ? 'tagabaybay' : 'doc'} size={58} />
              <span className="finder__name">{p.title}</span>
              <span className="finder__meta">{p.year}</span>
            </button>
          ))}
          <div className="finder__item finder__item--ghost" title="New projects land here">
            <AppIcon kind="folder" size={58} />
            <span className="finder__name">Next project…</span>
            <span className="finder__meta">in progress</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- Project viewer ---------- */

export function ProjectApp({ id, open }: { id: string; open: OpenApp }) {
  const p = projects.find((x) => x.id === id)
  if (!p) return <div className="doc">Project not found.</div>
  return (
    <article className="doc">
      <div className="doc__eyebrow">
        {p.year} · {p.role}
      </div>
      <h1 className="doc__title">{p.title}</h1>
      <p className="doc__lede">{p.tagline}</p>
      {p.status && <div className="badge">{p.status}</div>}
      {p.summary.map((s, i) => (
        <p key={i}>{s}</p>
      ))}
      <h3>Highlights</h3>
      <ul>
        {p.highlights.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
      <h3>Built with</h3>
      <div className="chips">
        {p.stack.map((s) => (
          <span key={s} className="chip">
            {s}
          </span>
        ))}
      </div>
      <div className="doc__actions">
        {p.app === 'tagabaybay' && (
          <button className="btn btn--primary" onClick={() => open('tagabaybay')}>
            Try it live →
          </button>
        )}
        {p.links.map((l) => (
          <a key={l.url} className="btn" href={l.url} target="_blank" rel="noreferrer">
            {l.label} ↗
          </a>
        ))}
      </div>
    </article>
  )
}

/* ---------- About ---------- */

export function AboutApp({ open }: { open: OpenApp }) {
  return (
    <article className="doc">
      <div className="about__head">
        <div className="about__avatar" aria-hidden>
          {profile.shortName[0]}
        </div>
        <div>
          <h1 className="doc__title">{profile.name}</h1>
          <div className="doc__eyebrow">
            {profile.location} · {profile.school}
          </div>
        </div>
      </div>
      <p className="doc__lede">{profile.headline}</p>
      {profile.about.map((s, i) => (
        <p key={i}>{s}</p>
      ))}
      <h3>What I'm into</h3>
      <div className="chips">
        {profile.interests.map((s) => (
          <span key={s} className="chip">
            {s}
          </span>
        ))}
      </div>
      <div className="doc__actions">
        <button className="btn btn--primary" onClick={() => open('finder')}>
          See my projects
        </button>
        <button className="btn" onClick={() => open('resume')}>
          Resume
        </button>
        <button className="btn" onClick={() => open('contact')}>
          Contact
        </button>
      </div>
    </article>
  )
}

/* ---------- Resume ---------- */

export function ResumeApp() {
  const [state, setState] = useState<'checking' | 'ok' | 'missing'>('checking')
  useEffect(() => {
    // Dev servers answer missing files with index.html, so check the content type.
    fetch(RESUME_URL, { method: 'HEAD' })
      .then((r) => setState(r.ok && (r.headers.get('content-type') ?? '').includes('pdf') ? 'ok' : 'missing'))
      .catch(() => setState('missing'))
  }, [])
  if (state === 'checking') return <div className="doc">Loading…</div>
  if (state === 'missing')
    return (
      <div className="doc doc--center">
        <AppIcon kind="pdf" size={72} />
        <h3>Resume coming soon</h3>
        <p className="muted">
          (Site owner: put your resume at <code>site/public/resume.pdf</code> and it will show up here.)
        </p>
      </div>
    )
  return (
    <div className="resume">
      <div className="resume__bar">
        <a className="btn btn--primary" href={RESUME_URL} download>
          Download PDF
        </a>
        <a className="btn" href={RESUME_URL} target="_blank" rel="noreferrer">
          Open in new tab ↗
        </a>
      </div>
      <iframe className="resume__frame" src={RESUME_URL} title="Resume" />
    </div>
  )
}

/* ---------- Credentials ---------- */

export function CredentialsApp() {
  return (
    <div className="doc">
      <h1 className="doc__title">Credentials</h1>
      <ul className="creds">
        {credentials.map((c, i) => (
          <li key={i} className="creds__item">
            <div className="creds__icon">🎓</div>
            <div>
              <div className="creds__title">{c.title}</div>
              <div className="muted">
                {c.issuer} · {c.date}
              </div>
              {c.detail && <div className="creds__detail">{c.detail}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- TagaBaybay ---------- */

export function TagaBaybayApp({ initialWord }: { initialWord?: string }) {
  const [input, setInput] = useState(initialWord ?? 'schedule')
  const [word, setWord] = useState(initialWord ?? 'schedule')
  const [shown, setShown] = useState(0)
  const trace: Trace | undefined = lookup(word)

  // Reveal the rewrite steps one by one.
  useEffect(() => {
    setShown(0)
    if (!trace) return
    const id = setInterval(() => setShown((n) => (n >= trace.steps.length ? n : n + 1)), 260)
    return () => clearInterval(id)
  }, [word, trace])

  const run = (w: string) => {
    setInput(w)
    setWord(w.trim().toLowerCase())
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(input)
  }
  const done = trace && shown >= trace.steps.length

  return (
    <div className="tb">
      <form className="tb__form" onSubmit={submit}>
        <input className="tb__input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type an English word…" aria-label="English word" />
        <button className="btn btn--primary">Nativize</button>
      </form>
      <div className="tb__examples">
        {EXAMPLE_WORDS.map((w) => (
          <button key={w} className={`chip chip--btn${w === word ? ' chip--on' : ''}`} onClick={() => run(w)}>
            {w}
          </button>
        ))}
      </div>

      {trace ? (
        <div className="tb__trace">
          <div className="tb__row">
            <span className="tb__label">1 · split</span>
            <span className="tb__tokens">
              {trace.tokens.map((t, i) => (
                <span key={i} className="tb__tok">
                  {t}
                </span>
              ))}
            </span>
          </div>
          <div className="tb__row">
            <span className="tb__label">2 · sound</span>
            <span className="mono">{trace.ipa}</span>
          </div>
          <div className="tb__row tb__row--top">
            <span className="tb__label">3 · rules</span>
            <ol className="tb__steps">
              {trace.steps.slice(0, shown).map((s, i) => (
                <li key={i} className="tb__step">
                  <span className="mono">
                    {s.from} → <b>{s.to}</b>
                  </span>
                  <span className="muted">{s.rule}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className={`tb__out${done ? ' tb__out--on' : ''}`}>
            <span className="muted">{word} →</span> {done ? trace.nativized : '…'}
          </div>
          {done && <p className="muted tb__note">{trace.notes}</p>}
        </div>
      ) : (
        <div className="tb__missing">
          <p>
            <b>"{word}"</b> isn't in this offline demo yet — the site runs a set of precomputed examples. Pick one above, or run the full system from the
            repository.
          </p>
          <a className="btn" href="https://github.com/Mango-Cats/tagabaybay" target="_blank" rel="noreferrer">
            TagaBaybay on GitHub ↗
          </a>
        </div>
      )}
      <footer className="tb__foot muted">
        Rule-based rewrite cascade · MangoCats Research Group, DLSU · forthcoming at IEEE TENCON 2026
      </footer>
    </div>
  )
}

/* ---------- Terminal ---------- */

type Line = { kind: 'in' | 'out' | 'err'; text: string }

const HELP = `available commands:
  whoami            who I am
  ls                list projects
  open <project>    open a project (e.g. open tagabaybay)
  nativize <word>   run TagaBaybay on a word (e.g. nativize computer)
  cat about         read about me
  resume            open my resume
  contact           how to reach me
  room              go back to the room
  clear             clear the screen`

export function TerminalApp({ open, onExit }: { open: OpenApp; onExit: () => void }) {
  const [lines, setLines] = useState<Line[]>(() => [
    { kind: 'out', text: `Last login: ${new Date().toDateString()} on ttys000` },
    { kind: 'out', text: "Welcome! Type 'help' to see what you can do." },
  ])
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [hIdx, setHIdx] = useState(-1)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Braces matter: newer browsers return a Promise from scrollIntoView, which React rejects as an effect cleanup.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [lines])
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [])

  const exec = (raw: string): Line[] => {
    const [cmd = '', ...rest] = raw.trim().split(/\s+/)
    const arg = rest.join(' ').toLowerCase()
    switch (cmd.toLowerCase()) {
      case '':
        return []
      case 'help':
        return [{ kind: 'out', text: HELP }]
      case 'whoami':
        return [{ kind: 'out', text: `${profile.name}\n${profile.headline}\n${profile.location}` }]
      case 'ls':
        return [{ kind: 'out', text: projects.map((p) => `${p.id.padEnd(16)} ${p.title}`).join('\n') }]
      case 'open': {
        const p = projects.find((x) => x.id === arg || x.title.toLowerCase() === arg)
        if (!p) return [{ kind: 'err', text: `open: no such project: ${arg || '(none)'} — try 'ls'` }]
        open('project', p.id)
        return [{ kind: 'out', text: `opening ${p.title}…` }]
      }
      case 'nativize': {
        if (!arg) return [{ kind: 'err', text: 'usage: nativize <word>' }]
        const t = lookup(arg)
        if (!t) return [{ kind: 'err', text: `${arg}: not in the offline examples. try: ${EXAMPLE_WORDS.slice(0, 5).join(', ')}` }]
        return [{ kind: 'out', text: `${arg} → ${t.nativized}\n${t.steps.map((s) => `  ${s.from} → ${s.to}   (${s.rule})`).join('\n')}` }]
      }
      case 'cat':
        if (arg === 'about' || arg === 'about.txt') return [{ kind: 'out', text: profile.about.join('\n\n') }]
        return [{ kind: 'err', text: `cat: ${arg || '(none)'}: No such file — try 'cat about'` }]
      case 'resume':
        open('resume')
        return [{ kind: 'out', text: 'opening Resume.pdf…' }]
      case 'contact':
        return [{ kind: 'out', text: [`email: ${profile.email}`, ...profile.links.map((l) => `${l.label.toLowerCase()}: ${l.url}`)].join('\n') }]
      case 'room':
      case 'exit':
        setTimeout(onExit, 300)
        return [{ kind: 'out', text: 'logging out… back to the room.' }]
      case 'sudo':
        return [{ kind: 'err', text: 'nice try 🙂' }]
      case 'kumusta':
      case 'hello':
      case 'hi':
        return [{ kind: 'out', text: 'Mabuti naman! Salamat sa pagbisita. 👋' }]
      default:
        return [{ kind: 'err', text: `zsh: command not found: ${cmd}` }]
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim().toLowerCase() === 'clear') {
      setLines([])
    } else {
      const out = exec(value) // run outside the state updater: commands may open windows
      setLines((ls) => [...ls, { kind: 'in', text: value }, ...out])
    }
    if (value.trim()) setHistory((h) => [value, ...h])
    setHIdx(-1)
    setValue('')
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault()
      const i = Math.min(hIdx + 1, history.length - 1)
      setHIdx(i)
      setValue(history[i])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const i = hIdx - 1
      setHIdx(Math.max(i, -1))
      setValue(i >= 0 ? history[i] : '')
    }
  }

  return (
    <div className="term" onClick={() => inputRef.current?.focus()}>
      {lines.map((l, i) => (
        <pre key={i} className={`term__line term__line--${l.kind}`}>
          {l.kind === 'in' ? <span className="term__prompt">jaztin@kwarto ~ % </span> : null}
          {l.text}
        </pre>
      ))}
      <form onSubmit={submit} className="term__form">
        <span className="term__prompt">jaztin@kwarto ~ % </span>
        <input
          ref={inputRef}
          className="term__input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          autoFocus
          spellCheck={false}
          autoCapitalize="off"
          aria-label="Terminal input"
        />
      </form>
      <div ref={endRef} />
    </div>
  )
}

/* ---------- Films & Contact ---------- */

export function FilmsApp() {
  const f = roomExtras.films
  const m = roomExtras.music
  return (
    <div className="doc">
      <h1 className="doc__title">Films &amp; music</h1>
      <h3>My top 4 on Letterboxd</h3>
      <div className="films">
        {letterboxd.favorites.map((film) => (
          <a key={film.url} className="films__item" href={film.url} target="_blank" rel="noreferrer">
            <span className="films__poster" style={{ background: `linear-gradient(${film.poster.top}, ${film.poster.bottom})`, color: film.poster.accent }}>
              {film.title}
              <img className="films__img" src={film.posterUrl} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} />
            </span>
            <span className="films__meta">
              {film.title} <span className="muted">({film.year})</span>
            </span>
          </a>
        ))}
      </div>
      <div className="doc__actions">
        <a className="btn btn--primary" href={letterboxd.profile} target="_blank" rel="noreferrer">
          Follow me on Letterboxd ↗
        </a>
      </div>
      <p className="muted">{f.note}</p>
      <p className="muted films__credit">{TMDB_CREDIT}</p>
      <h3>Listening</h3>
      <ul>
        {m.lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  )
}

export function ContactApp() {
  return (
    <div className="doc">
      <h1 className="doc__title">Say hello 👋</h1>
      <p>I'm looking for roles in backend / database engineering and NLP. The fastest way to reach me:</p>
      <div className="doc__actions doc__actions--col">
        <a className="btn btn--primary" href={`mailto:${profile.email}`}>
          ✉ {profile.email}
        </a>
        {profile.links.map((l) => (
          <a key={l.url} className="btn" href={l.url} target="_blank" rel="noreferrer">
            {l.label} ↗
          </a>
        ))}
      </div>
    </div>
  )
}
