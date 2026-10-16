import { credentials, education, letterboxd, papers, profile, projects, skills } from '../data/content'
import { pub, pubList, realEmail, realLink, shortUrl } from '../data/publish'

const RESUME_URL = `${import.meta.env.BASE_URL}${profile.resume}`

/**
 * The simple version: everything on one plain, fast page, written like a résumé so it reads well
 * for people skimming and for AI screeners. Plain semantic HTML (sections, headings, lists) with the
 * addresses written out as text. It is also pre-rendered into index.html at build time
 * (scripts/prerender.mjs), so it can be read without running any JavaScript.
 */
export default function Plain({ onEnterRoom, webgl }: { onEnterRoom: () => void; webgl: boolean }) {
  const email = realEmail(profile.email)
  const links = profile.links.filter(realLink)
  const lookingFor = pub(profile.lookingFor)
  const work = projects.map((p) => ({ ...p, summary: pubList(p.summary), highlights: pubList(p.highlights), stack: pubList(p.stack) }))
  const otherCreds = credentials.filter((c) => pub(c.title) && !papers.some((p) => p.title === c.title) && !/^BS /.test(c.title))
  let n = 0
  const num = () => String(++n).padStart(2, '0')

  return (
    <main className="sv" aria-label={`${profile.name}: profile`}>
      <header className="sv-head">
        <div className="sv-weave" aria-hidden />
        <p className="sv-kicker">Portfolio · simple version</p>
        <h1 className="sv-name">{profile.name}</h1>
        <p className="sv-role">{profile.headline}</p>
        <ul className="sv-contact" aria-label="Contact">
          {email && (
            <li>
              <span className="sv-k">Email</span>
              <a href={`mailto:${email}`}>{email}</a>
            </li>
          )}
          {links.map((l) => (
            <li key={l.url}>
              <span className="sv-k">{l.label}</span>
              <a href={l.url} target="_blank" rel="noreferrer">
                {shortUrl(l.url)}
              </a>
            </li>
          ))}
          <li>
            <span className="sv-k">Resume</span>
            <a href={RESUME_URL} target="_blank" rel="noreferrer">
              PDF ↗
            </a>
          </li>
        </ul>
        {webgl && (
          <button className="sv-room" onClick={onEnterRoom}>
            ✦ Enter the 3D room instead
          </button>
        )}
      </header>

      <section className="sv-sec" aria-labelledby="sv-summary">
        <h2 id="sv-summary">
          <span className="sv-num">{num()}</span>Summary
        </h2>
        <p className="sv-summary">{profile.summary}</p>
        <dl className="sv-glance">
          <dt>Focus</dt>
          <dd>Backend development · Database design · Filipino NLP research</dd>
          {lookingFor && (
            <>
              <dt>Looking for</dt>
              <dd>{lookingFor}</dd>
            </>
          )}
          <dt>Education</dt>
          <dd>
            {pub(education[0].degree)}, {education[0].school}
          </dd>
          <dt>Based in</dt>
          <dd>{profile.location}</dd>
          <dt>Languages</dt>
          <dd>{profile.spokenLanguages.join(', ')}</dd>
        </dl>
      </section>

      <section className="sv-sec" aria-labelledby="sv-projects">
        <h2 id="sv-projects">
          <span className="sv-num">{num()}</span>Projects
        </h2>
        {work.map((p) => (
          <article key={p.id} className="sv-proj">
            <h3>{p.title}</h3>
            <p className="sv-meta">{[pub(p.year), pub(p.role)].filter(Boolean).join(' · ')}</p>
            {pub(p.tagline) && <p className="sv-tagline">{pub(p.tagline)}</p>}
            {pub(p.status) && <p className="sv-status">{pub(p.status)}</p>}
            {p.summary.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
            {p.highlights.length > 0 && (
              <ul className="sv-points">
                {p.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
            {p.stack.length > 0 && (
              <p className="sv-stack">
                <span className="sv-k">Built with</span>
                {p.stack.join(', ')}
              </p>
            )}
            {p.links.length > 0 && (
              <ul className="sv-links">
                {p.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer">
                      {l.label}
                    </a>{' '}
                    <span className="sv-url">{shortUrl(l.url)}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>

      <section className="sv-sec" aria-labelledby="sv-research">
        <h2 id="sv-research">
          <span className="sv-num">{num()}</span>Research &amp; publications
        </h2>
        <ol className="sv-cites">
          {papers
            .filter((p) => pub(p.title))
            .map((p) => (
              <li key={p.title}>
                {pub(p.authors) && <>{pub(p.authors).replace(/\.$/, '')}. </>}
                <cite>&ldquo;{pub(p.title)}.&rdquo;</cite> {pub(p.venue)}
                {pub(p.status) && <span className="sv-tag">{pub(p.status)}</span>}
                {p.links.length > 0 && (
                  <span className="sv-citelinks">
                    {p.links.map((l) => (
                      <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
                        {l.label}
                      </a>
                    ))}
                  </span>
                )}
              </li>
            ))}
        </ol>
      </section>

      <section className="sv-sec" aria-labelledby="sv-skills">
        <h2 id="sv-skills">
          <span className="sv-num">{num()}</span>Skills
        </h2>
        <dl className="sv-glance sv-skills">
          {skills.map((g) => (
            <div key={g.group} className="sv-row">
              <dt>{g.group}</dt>
              <dd>{pubList(g.items).join(' · ')}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="sv-sec" aria-labelledby="sv-education">
        <h2 id="sv-education">
          <span className="sv-num">{num()}</span>Education{otherCreds.length > 0 && <> &amp; credentials</>}
        </h2>
        {education.map((e) => (
          <div key={e.school} className="sv-edu">
            <h3>{pub(e.degree)}</h3>
            <p className="sv-meta">{[e.school, pub(e.dates)].filter(Boolean).join(' · ')}</p>
            {pubList(e.notes).length > 0 && (
              <ul className="sv-points">
                {pubList(e.notes).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {otherCreds.length > 0 && (
          <ul className="sv-points">
            {otherCreds.map((c) => (
              <li key={c.title}>
                {pub(c.title)} — {[pub(c.issuer), pub(c.date)].filter(Boolean).join(', ')}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="sv-sec" aria-labelledby="sv-about">
        <h2 id="sv-about">
          <span className="sv-num">{num()}</span>About me
        </h2>
        {pubList(profile.about).map((s, i) => (
          <p key={i}>{s}</p>
        ))}
        <p>
          My favourite films are{' '}
          {letterboxd.favorites.map((f, i) => (
            <span key={f.url}>
              {i > 0 && (i === letterboxd.favorites.length - 1 ? ', and ' : ', ')}
              <cite>{f.title}</cite> ({f.year})
            </span>
          ))}
          . I log what I watch on{' '}
          <a href={letterboxd.profile} target="_blank" rel="noreferrer">
            Letterboxd
          </a>
          .
        </p>
      </section>

      <footer className="sv-foot">
        <p>
          Plain-text versions of this page, for screen readers and AI tools: <a href={`${import.meta.env.BASE_URL}profile.md`}>profile.md</a> ·{' '}
          <a href={`${import.meta.env.BASE_URL}llms.txt`}>llms.txt</a>
        </p>
        <p>
          {profile.name} · {shortUrl(profile.siteUrl)}
        </p>
      </footer>
    </main>
  )
}
