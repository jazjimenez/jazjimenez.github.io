// After `vite build`: make the site readable without JavaScript.
//  • renders the simple version (src/plain/Plain.tsx) into dist/index.html, so crawlers and AI
//    screeners that don't run JavaScript still get the full profile as HTML
//  • adds schema.org Person data (JSON-LD) and link-preview tags
//  • writes plain-text copies (profile.md, llms.txt), robots.txt and sitemap.xml
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom' })

try {
  const { createElement } = await import('react')
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { default: Plain } = await vite.ssrLoadModule('/src/plain/Plain.tsx')
  const c = await vite.ssrLoadModule('/src/data/content.ts')
  const { pub, pubList, realEmail, realLink, shortUrl } = await vite.ssrLoadModule('/src/data/publish.ts')
  const { profile, projects, papers, skills, education, credentials, letterboxd } = c
  const site = profile.siteUrl
  const email = realEmail(profile.email)
  const links = profile.links.filter(realLink)

  // ---- index.html: pre-rendered profile + structured data ----
  const body = renderToStaticMarkup(createElement(Plain, { webgl: false, onEnterRoom() {} }))
  const description = `${profile.name}: ${profile.summary}`
  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    url: site,
    jobTitle: 'Software Developer (Backend & Databases)',
    description: profile.summary,
    ...(email && { email: `mailto:${email}` }),
    address: { '@type': 'PostalAddress', addressLocality: 'Manila', addressCountry: 'PH' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'De La Salle University', address: 'Manila, Philippines' },
    knowsAbout: [...new Set(skills.flatMap((g) => pubList(g.items)).concat(profile.interests.slice(0, 5)))],
    knowsLanguage: profile.spokenLanguages,
    ...(pub(profile.lookingFor) && { seeks: { '@type': 'Demand', description: pub(profile.lookingFor) } }),
    sameAs: [...links.map((l) => l.url), letterboxd.profile],
  }
  const pubs = papers
    .filter((p) => pub(p.title) && pub(p.status) !== 'In progress')
    .map((p) => ({
      '@context': 'https://schema.org',
      '@type': 'ScholarlyArticle',
      headline: p.title,
      author: pub(p.authors),
      publisher: pub(p.venue),
      ...(p.links[0] && { url: p.links[0].url }),
    }))
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const head = [
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${site}" />`,
    `<meta property="og:type" content="profile" />`,
    `<meta property="og:title" content="${esc(`${profile.name}: Kwarto ni Jaztin`)}" />`,
    `<meta property="og:description" content="${esc(profile.summary)}" />`,
    `<meta property="og:url" content="${site}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<link rel="alternate" type="text/markdown" href="profile.md" title="Profile (Markdown)" />`,
    ...[person, ...pubs].map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`),
    // The app replaces the pre-rendered page as soon as it starts; hide it meanwhile so it doesn't flash.
    `<script>document.documentElement.classList.add('js')</script>`,
    `<style>.js #root > .sv { visibility: hidden }</style>`,
  ].join('\n    ')
  const indexPath = resolve(dist, 'index.html')
  let html = readFileSync(indexPath, 'utf8')
  html = html.replace(/<meta name="description"[^>]*>\s*/, '')
  html = html.replace('</head>', `  ${head}\n  </head>`)
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`)
  writeFileSync(indexPath, html)

  // ---- profile.md / llms.txt: the same profile as plain Markdown ----
  const md = []
  md.push(`# ${profile.name}`, '', `> ${profile.headline}`, '', profile.summary, '')
  md.push('## Contact', '')
  if (email) md.push(`- Email: ${email}`)
  for (const l of links) md.push(`- ${l.label}: ${l.url}`)
  md.push(`- Website: ${site}`, `- Resume (PDF): ${new URL(profile.resume, site)}`, `- Location: ${profile.location}`, '')
  md.push('## At a glance', '', '- Focus: Backend development, database design, Filipino NLP research')
  if (pub(profile.lookingFor)) md.push(`- Looking for: ${pub(profile.lookingFor)}`)
  md.push(`- Education: ${pub(education[0].degree)}, ${education[0].school}`, `- Languages: ${profile.spokenLanguages.join(', ')}`, '')
  md.push('## Projects', '')
  for (const p of projects) {
    md.push(`### ${p.title}`, '')
    const meta = [pub(p.year), pub(p.role), pub(p.status)].filter(Boolean)
    if (meta.length) md.push(`*${meta.join(' · ')}*`, '')
    if (pub(p.tagline)) md.push(pub(p.tagline), '')
    for (const s of pubList(p.summary)) md.push(s, '')
    for (const h of pubList(p.highlights)) md.push(`- ${h}`)
    if (pubList(p.highlights).length) md.push('')
    if (pubList(p.stack).length) md.push(`Built with: ${pubList(p.stack).join(', ')}`, '')
    for (const l of p.links) md.push(`- ${l.label}: ${l.url}`)
    if (p.links.length) md.push('')
  }
  md.push('## Research & publications', '')
  for (const p of papers.filter((p) => pub(p.title))) {
    md.push(`- ${[pub(p.authors), `"${pub(p.title)}"`, pub(p.venue), pub(p.status)].filter(Boolean).map((x) => x.replace(/\.$/, '')).join('. ')}.${p.links.map((l) => ` ${l.label}: ${l.url}`).join('')}`)
  }
  md.push('', '## Skills', '')
  for (const g of skills) md.push(`- ${g.group}: ${pubList(g.items).join(', ')}`)
  md.push('', '## Education', '')
  for (const e of education) {
    md.push(`- ${[pub(e.degree), e.school, pub(e.dates)].filter(Boolean).join(', ')}`)
    for (const n of pubList(e.notes)) md.push(`  - ${n}`)
  }
  const creds = credentials.filter((x) => pub(x.title) && !papers.some((p) => p.title === x.title) && !/^BS /.test(x.title))
  for (const x of creds) md.push(`- ${pub(x.title)}, ${[pub(x.issuer), pub(x.date)].filter(Boolean).join(', ')}`)
  md.push('', '## About', '')
  for (const s of pubList(profile.about)) md.push(s, '')
  md.push(`Favourite films: ${letterboxd.favorites.map((f) => `${f.title} (${f.year})`).join(', ')}. Letterboxd: ${letterboxd.profile}`, '')
  const markdown = md.join('\n')
  writeFileSync(resolve(dist, 'profile.md'), markdown)
  writeFileSync(
    resolve(dist, 'llms.txt'),
    `${markdown}\n---\n\nThis is the plain-text version of ${site} (an interactive 3D portfolio). The same information is in the HTML of the home page.\n`,
  )
  writeFileSync(resolve(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap.xml', site)}\n`)
  writeFileSync(
    resolve(dist, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site}</loc></url>\n  <url><loc>${new URL('profile.md', site)}</loc></url>\n</urlset>\n`,
  )
  console.log(`prerender: index.html (${(body.length / 1024).toFixed(1)} kB of profile HTML), profile.md, llms.txt, robots.txt, sitemap.xml`)
} finally {
  await vite.close()
}
