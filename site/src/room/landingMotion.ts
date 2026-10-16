/**
 * Pauses the welcome page's slow camera drift without re-rendering React (which would hitch the
 * scroll animation). The landing page sets `paused`; the camera rig reads it every frame and
 * registers `wake` so drawing can restart. Kept dependency-free so App can import it cheaply.
 */
export const landingMotion: { paused: boolean; wake: (() => void) | null } = { paused: false, wake: null }

export function setLandingPaused(paused: boolean) {
  if (landingMotion.paused === paused) return
  landingMotion.paused = paused
  if (!paused) landingMotion.wake?.()
}
