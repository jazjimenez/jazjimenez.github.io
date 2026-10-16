// All of the site's content lives here. Edit this file to update the site.
// Anything marked TODO is a placeholder waiting for your real details.

export type Link = { label: string; url: string }

export type Project = {
  id: string
  title: string
  tagline: string
  year: string
  role: string
  status?: string
  summary: string[]
  highlights: string[]
  stack: string[]
  links: Link[]
  /** Desktop app to open from this project's window, if any. */
  app?: 'tagabaybay'
}

export type Credential = {
  title: string
  issuer: string
  date: string
  detail?: string
}

export const profile = {
  name: 'Jaztin Jacob Jimenez',
  shortName: 'Jaztin',
  headline: 'Software developer — backend & databases — with a research streak in Filipino NLP.',
  location: 'Manila, Philippines',
  school: 'De La Salle University — College of Computer Studies',
  about: [
    "Hi! I'm Jaztin. I like the parts of software you don't see: how data is shaped, stored, queried and moved around. Database design and backend systems are where I'm happiest.",
    'I also do research on language technology for Filipino, a low-resource language that still gets far less attention from NLP tools than it deserves. My work so far covers loanword spelling (TagaBaybay) and a dataset pipeline for Filipino-English audio-visual speech recognition.',
    'Outside of code: films and music, probably in that order. (TODO: add a line or two in your own voice.)',
  ],
  interests: ['Database design', 'Backend systems', 'Data pipelines', 'Filipino NLP', 'Speech & audio-visual data', 'Films', 'Music'],
  email: 'you@example.com', // TODO: your email
  links: [
    { label: 'GitHub', url: 'https://github.com/' }, // TODO: your GitHub profile
    { label: 'LinkedIn', url: 'https://www.linkedin.com/' }, // TODO: your LinkedIn
  ] as Link[],
  /** Put your resume at site/public/resume.pdf */
  resume: 'resume.pdf',
  /** The live site (used for search engines, link previews and the machine-readable profile). */
  siteUrl: 'https://jazjimenez.github.io/',
  /** One-paragraph summary: the first thing a recruiter (or an AI screener) reads. */
  summary:
    'Computer Science student at De La Salle University focused on backend development and database design, with research in Filipino natural language processing. Co-author of TagaBaybay, a rule-based system for respelling English loanwords in Filipino (paper accepted at IEEE TENCON 2026), and author of an undergraduate thesis building a Filipino-English audio-visual speech dataset pipeline.',
  /** What you're looking for. Text in "(TODO …)" is hidden from the public page. */
  lookingFor: 'Backend, database or data engineering roles — internship or entry-level. (TODO: confirm the role types and your availability date)',
  spokenLanguages: ['English', 'Filipino'],
}

export type SkillGroup = { group: string; items: string[] }

/** Skills, grouped. TODO: adjust to what you'd be happy to be interviewed on. */
export const skills: SkillGroup[] = [
  { group: 'Backend & data', items: ['Relational database design and modelling', 'SQL', 'Backend development', 'Data pipelines'] },
  { group: 'Programming languages', items: ['Rust', 'Python', 'SQL', 'TypeScript'] },
  { group: 'Research & NLP', items: ['Rule-based NLP', 'Grapheme-to-phoneme conversion', 'Evaluation and error analysis', 'Speech and audio-visual datasets'] },
  { group: 'Tools', items: ['Git and GitHub', 'React', 'Three.js', 'Blender (Python scripting)'] },
]

export type Education = { school: string; degree: string; dates: string; notes?: string[] }

export const education: Education[] = [
  {
    school: 'De La Salle University, Manila',
    degree: 'BS Computer Science', // TODO: exact degree / specialization
    dates: 'TODO: e.g. 2022 – 2026',
    notes: ['Undergraduate thesis: Filipino-English audio-visual speech recognition dataset pipeline', 'Research with the MangoCats Research Group'],
  },
]

export const projects: Project[] = [
  {
    id: 'tagabaybay',
    title: 'TagaBaybay',
    tagline: 'Orthographic nativization of English loanwords into Filipino',
    year: '2026',
    role: 'Co-author · MangoCats Research Group, DLSU',
    status: 'Forthcoming at IEEE TENCON 2026 (Bali, Indonesia)',
    summary: [
      'When English words are borrowed into Filipino they get respelled: "computer" becomes "kompyuter", "schedule" becomes "iskedyul". TagaBaybay does this automatically with a rule-based rewrite cascade built from the official KWF orthography guidelines and phonological descriptions of Filipino — no parallel training corpus required.',
      'Each word is split into graphemes, checked against an English pronouncing dictionary, converted to sounds, and rewritten by priority-ordered, context-sensitive rules. Words outside the dictionary (like drug and brand names) go through a spelling-based cascade instead.',
    ],
    highlights: [
      'Gold standard of 2,319 English–Filipino loanword pairs',
      '5.14% character error rate in the paper (5-vowel), 4.05% under 3-vowel evaluation',
      'Later versions improved this to 3.34% / 2.63%',
      'Beats a regex baseline (20.38%) and a zero-shot LLM given the same rules (15.54%)',
    ],
    stack: ['Rust', 'Rule-based NLP', 'G2P (CMUdict)', 'Evaluation tooling'],
    links: [
      { label: 'GitHub repository', url: 'https://github.com/Mango-Cats/tagabaybay' },
      { label: 'Project website', url: 'https://mango-cats.github.io/tagabaybay-docs/web/' },
    ],
    app: 'tagabaybay',
  },
  {
    id: 'avsr-pipeline',
    title: 'Filipino-English AVSR Dataset Pipeline',
    tagline: 'Undergraduate thesis — building audio-visual speech data for code-switched Filipino-English',
    year: '2026', // TODO
    role: 'Thesis author', // TODO
    status: 'In progress', // TODO
    summary: [
      'Audio-visual speech recognition (AVSR) uses both the sound of speech and the movement of the lips. Datasets for it barely exist for Filipino, and even less for the Filipino-English code-switching people actually speak every day.',
      'This thesis builds a pipeline that turns raw video into a clean, aligned audio-visual dataset. (TODO: describe the stages — sourcing, face/lip detection, transcription, alignment, filtering — and the size of the result.)',
    ],
    highlights: [
      'TODO: dataset size (hours / clips / speakers)',
      'TODO: the hardest engineering problem you solved',
      'TODO: results or benchmark, if any',
    ],
    stack: ['Python', 'TODO'],
    links: [],
  },
  {
    id: 'org-website',
    title: 'School Organization Website',
    tagline: 'The official website for a DLSU student organization', // TODO: org name
    year: 'TODO',
    role: 'TODO: your role',
    summary: ['TODO: what the site does, who uses it, and what you built (especially any backend or database parts).'],
    highlights: ['TODO'],
    stack: ['TODO'],
    links: [], // TODO: { label: 'Live site', url: '...' }
  },
]

export const credentials: Credential[] = [
  {
    title: 'Orthographic Nativization as Rule-Based Rewrite Cascades',
    issuer: 'IEEE Region 10 Conference (TENCON 2026)',
    date: '2026',
    detail: 'Chua, Ganituen, Ching, Jimenez, Oco — forthcoming',
  },
  {
    title: 'BS Computer Science', // TODO: exact degree / specialization
    issuer: 'De La Salle University',
    date: 'TODO',
  },
  { title: 'TODO: certification or award', issuer: 'TODO', date: 'TODO' },
]

export type Paper = { title: string; venue: string; authors: string; status?: string; links: Link[] }

/** Research papers — the stack of papers on the desk. */
export const papers: Paper[] = [
  {
    title: 'Orthographic Nativization as Rule-Based Rewrite Cascades',
    venue: 'IEEE Region 10 Conference (TENCON 2026), Bali, Indonesia',
    authors: 'E. G. Chua, Z. R. Ganituen, J. E. Ching, J. J. Jimenez, N. Oco',
    status: 'Forthcoming',
    links: [
      { label: 'Project website', url: 'https://mango-cats.github.io/tagabaybay-docs/web/' },
      { label: 'Code on GitHub', url: 'https://github.com/Mango-Cats/tagabaybay' },
    ],
  },
  {
    title: 'A Dataset Pipeline for Filipino-English Audio-Visual Speech Recognition', // TODO: exact thesis title
    venue: 'Undergraduate thesis, De La Salle University', // TODO
    authors: 'J. J. Jimenez et al.', // TODO
    status: 'In progress', // TODO
    links: [], // TODO: add a link once it's public
  },
]

export type Film = {
  title: string
  year: number
  url: string
  /** Official poster, loaded at runtime from TMDB's image CDN (falls back to `poster` colours if it can't load). */
  posterUrl: string
  poster: { top: string; bottom: string; accent: string }
}

export const letterboxd = {
  profile: 'https://letterboxd.com/jazu_/',
  handle: 'jazu_',
  /** Favourite films, in the order shown on the Letterboxd profile. Poster colours are my own designs. */
  favorites: [
    { title: 'The Holdovers', year: 2023, url: 'https://letterboxd.com/film/the-holdovers/', posterUrl: 'https://image.tmdb.org/t/p/w500/VHSzNBTwxV8vh7wylo7O9CLdac.jpg', poster: { top: '#7a1f24', bottom: '#2a0b0e', accent: '#f1e6d0' } },
    { title: 'Dead Poets Society', year: 1989, url: 'https://letterboxd.com/film/dead-poets-society/', posterUrl: 'https://image.tmdb.org/t/p/w500/erzbMlcNHOdx24AXOcn2ZKA7R1q.jpg', poster: { top: '#2f4a33', bottom: '#0f1a12', accent: '#e8d9a8' } },
    { title: 'Hyphen', year: 2023, url: 'https://letterboxd.com/film/hyphen-2023-1/', posterUrl: 'https://image.tmdb.org/t/p/w500/aWywFJGglE75WIkOihIHg1l6716.jpg', poster: { top: '#c8742c', bottom: '#3a1e0c', accent: '#fbefd9' } },
    { title: 'Monster', year: 2023, url: 'https://letterboxd.com/film/monster-2023/', posterUrl: 'https://image.tmdb.org/t/p/w500/kvUJUyUGOhEoiWWNH04IXoExPE2.jpg', poster: { top: '#3c5a7a', bottom: '#111a26', accent: '#dfe8f0' } },
  ] as Film[],
}

/** Poster images courtesy of TMDB (required attribution). */
export const TMDB_CREDIT = 'Posters from TMDB. This site uses TMDB images but is not endorsed or certified by TMDB.'

export type StickyNote = { text: string; color: string }
export type Photo = { caption: string; /** put the image in site/public/corkboard/ and give its file name here */ src?: string }

/**
 * The corkboard above the desk (click it to zoom in). Drawn live from this list, so edits show up
 * without re-baking. TODO: rewrite the notes in your own words and add real photos.
 */
export const corkboard = {
  notes: [
    { text: 'Ship the thesis 🎓', color: '#ffe48a' },
    { text: 'TENCON 2026 → Bali ✈', color: '#ffb3c7' },
    { text: 'SELECT * FROM goals\nWHERE done = false;', color: '#b9f0c8' },
    { text: 'Learn: Blackbird\n(fingerpicking!)', color: '#ffd59e' },
    { text: 'Mabuhay! 👋', color: '#a8dcff' },
    { text: 'Call Lola\nevery Sunday', color: '#ffe48a' },
    { text: 'Backend > frontend\n(don\'t tell anyone)', color: '#d7c4ff' },
  ] as StickyNote[],
  photos: [
    { caption: 'Manila sunsets' }, // TODO: { caption: '…', src: 'manila.jpg' }
    { caption: 'MangoCats 🥭' },
    { caption: 'first gig' },
  ] as Photo[],
}

/** Personal extras shown when clicking objects in the room. */
export const roomExtras = {
  films: {
    title: 'My top 4 films',
    lines: ['The four favourites on my Letterboxd — the posters on the wall.'],
    note: 'A Letterboxd-style app of my own is in the works — it will live in the dock.',
  },
  music: {
    title: 'On the record player',
    lines: ['TODO: an album you keep coming back to', 'TODO: what you listen to while coding'],
  },
  baybayin: {
    title: 'Baybayin',
    lines: [
      'ᜆᜄᜊᜌ᜔ᜊᜌ᜔ — "TagaBaybay", written in baybayin, the pre-colonial script of the Tagalog language.',
      'Baybayin is an abugida: each character is a consonant with an inherent "a", and marks above or below change the vowel.',
    ],
  },
  parol: {
    title: 'Parol',
    lines: ['The Filipino Christmas star lantern. Click it to switch the room between day and night.'],
  },
  papers: {
    title: 'Papers on my desk',
    lines: ['Research I have worked on — printed out, of course.'],
  },
  guitar: {
    title: 'Guitar',
    lines: ['TODO: what you like to play — a song you always come back to.'],
  },
  jeepney: {
    title: 'Jeepney',
    lines: ['The king of the road. Sakay na — hop on and it takes you back to the laptop.'],
  },
} as const
