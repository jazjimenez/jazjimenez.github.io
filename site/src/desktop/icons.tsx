// Hand-made app icons (no Apple artwork).

export type IconKind = 'folder' | 'about' | 'pdf' | 'credentials' | 'tagabaybay' | 'terminal' | 'films' | 'contact' | 'doc' | 'room'

export function AppIcon({ kind, size = 48 }: { kind: IconKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="app-icon">
      {ICONS[kind]}
    </svg>
  )
}

const tile = (fill: string) => <rect x="4" y="4" width="56" height="56" rx="14" fill={fill} />

const ICONS: Record<IconKind, React.ReactNode> = {
  folder: (
    <>
      <path d="M6 18a5 5 0 0 1 5-5h14l5 5h23a5 5 0 0 1 5 5v4H6z" fill="#3f86d6" />
      <rect x="6" y="22" width="52" height="32" rx="5" fill="#6fb0f2" />
      <rect x="6" y="22" width="52" height="4" fill="#8cc2f6" />
    </>
  ),
  about: (
    <>
      {tile('#f6efe3')}
      <circle cx="32" cy="26" r="9" fill="#2e6b5e" />
      <path d="M16 50c2-9 9-13 16-13s14 4 16 13" fill="#2e6b5e" />
    </>
  ),
  pdf: (
    <>
      <path d="M14 6h26l12 12v38a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="#fff" stroke="#d9d4cc" />
      <path d="M40 6v12h12" fill="#ece6dc" />
      <rect x="11" y="34" width="34" height="13" rx="3" fill="#d23b2e" />
      <text x="28" y="44.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="Inter, sans-serif">
        PDF
      </text>
    </>
  ),
  credentials: (
    <>
      <path d="M6 18a5 5 0 0 1 5-5h14l5 5h23a5 5 0 0 1 5 5v4H6z" fill="#3f86d6" />
      <rect x="6" y="22" width="52" height="32" rx="5" fill="#6fb0f2" />
      <path d="M32 29l11 5-11 5-11-5z" fill="#1f4f8a" />
      <path d="M25 37v5c0 2 3.5 4 7 4s7-2 7-4v-5l-7 3z" fill="#1f4f8a" />
    </>
  ),
  tagabaybay: (
    <>
      {tile('#2e6b5e')}
      <text x="32" y="43" textAnchor="middle" fontSize="30" fill="#f6efe3" fontFamily="'Noto Sans Tagalog', sans-serif">
        ᜊ
      </text>
    </>
  ),
  terminal: (
    <>
      {tile('#1f2329')}
      <path d="M16 24l9 7-9 7" stroke="#7fe0a0" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="29" y="38" width="16" height="4" rx="2" fill="#7fe0a0" />
    </>
  ),
  films: (
    <>
      {tile('#c0392b')}
      <rect x="14" y="20" width="36" height="26" rx="3" fill="#2a0e10" />
      {[17, 25, 33, 41].map((x) => (
        <g key={x}>
          <rect x={x} y="22" width="4" height="3" fill="#f6efe3" />
          <rect x={x} y="41" width="4" height="3" fill="#f6efe3" />
        </g>
      ))}
      <path d="M28 28l9 5-9 5z" fill="#f2b632" />
    </>
  ),
  contact: (
    <>
      {tile('#e8a33a')}
      <rect x="14" y="20" width="36" height="25" rx="4" fill="#fff" />
      <path d="M15 22l17 13 17-13" stroke="#e8a33a" strokeWidth="3" fill="none" />
    </>
  ),
  doc: (
    <>
      <path d="M14 6h26l12 12v38a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z" fill="#fff" stroke="#d9d4cc" />
      {[24, 31, 38, 45].map((y) => (
        <rect key={y} x="18" y={y} width={y === 45 ? 16 : 28} height="3" rx="1.5" fill="#c9c2b6" />
      ))}
    </>
  ),
  room: (
    <>
      {tile('#3a2e4f')}
      <polygon points="32,14 36,25 48,25 38,32 42,44 32,37 22,44 26,32 16,25 28,25" fill="#f2b632" />
      <rect x="31" y="6" width="2" height="8" fill="#f2b632" />
    </>
  ),
}
