import { credentials, profile, projects } from '../data/content'

const RESUME_URL = `${import.meta.env.BASE_URL}${profile.resume}`

/** The "skip the room" page: everything on one fast, plain page. */
export default function Plain({ onEnterRoom, webgl }: { onEnterRoom: () => void; webgl: boolean }) {
  return (
    <div className="plain">
      <header className="plain__head">
        <div>
          <h1>{profile.name}</h1>
          <p className="plain__lede">{profile.headline}</p>
          <p className="muted">
            {profile.location} · {profile.school}
          </p>
        </div>
        <div className="plain__actions">
          <a className="btn btn--primary" href={RESUME_URL} target="_blank" rel="noreferrer">
            Resume
          </a>
          <a className="btn" href={`mailto:${profile.email}`}>
            Email
          </a>
          {profile.links.map((l) => (
            <a key={l.url} className="btn" href={l.url} target="_blank" rel="noreferrer">
              {l.label}
            </a>
          ))}
          {webgl && (
            <button className="btn" onClick={onEnterRoom}>
              ✦ Enter the room
            </button>
          )}
        </div>
      </header>

      <section>
        <h2>Projects</h2>
        {projects.map((p) => (
          <article key={p.id} className="plain__card">
            <div className="doc__eyebrow">
              {p.year} · {p.role}
            </div>
            <h3>{p.title}</h3>
            <p className="doc__lede">{p.tagline}</p>
            {p.status && <div className="badge">{p.status}</div>}
            {p.summary.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
            <ul>
              {p.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
            <div className="chips">
              {p.stack.map((s) => (
                <span key={s} className="chip">
                  {s}
                </span>
              ))}
            </div>
            {p.links.length > 0 && (
              <div className="doc__actions">
                {p.links.map((l) => (
                  <a key={l.url} className="btn" href={l.url} target="_blank" rel="noreferrer">
                    {l.label} ↗
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>

      <section>
        <h2>Credentials</h2>
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
      </section>

      <section>
        <h2>About</h2>
        {profile.about.map((s, i) => (
          <p key={i}>{s}</p>
        ))}
      </section>
    </div>
  )
}
