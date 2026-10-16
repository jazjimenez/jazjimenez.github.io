// Helpers for the public, text-first pages (the simple version, llms.txt, profile.md).
// Anything still marked TODO in content.ts is left out, so placeholders never reach readers or AI screeners.

import type { Link } from './content'

/** The text without any "(TODO …)" notes; empty if what's left is still a placeholder. */
export function pub(s: string | undefined): string {
  if (!s) return ''
  const t = s.replace(/\s*\(TODO[^)]*\)/g, '').trim()
  return /TODO/.test(t) ? '' : t
}

/** Only the finished entries of a list. */
export const pubList = (xs: string[] | undefined) => (xs ?? []).map(pub).filter(Boolean)

/** A link is real if it points somewhere specific (not a bare placeholder like https://github.com/). */
export const realLink = (l: Link) => {
  try {
    const u = new URL(l.url)
    return u.pathname.replace(/\/+$/, '') !== '' || u.hash !== ''
  } catch {
    return false
  }
}

export const realEmail = (e: string) => (/@example\.com$/.test(e) || !e.includes('@') ? '' : e)

/** "https://www.github.com/x/" → "github.com/x" (shown next to links, so the address itself is readable). */
export const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
