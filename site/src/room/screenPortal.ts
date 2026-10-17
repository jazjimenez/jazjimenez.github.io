import * as THREE from 'three'
import { PORTAL_ID } from './portalId'

/**
 * Glue between the 3D laptop screen and the real (DOM) desktop.
 *
 * While you lean in, the desktop element is drawn *on* the laptop screen using a CSS perspective
 * transform (matrix3d) that maps the viewport rectangle onto the screen's four projected corners.
 * Near the end it flattens out to fill the viewport, so the 3D screen literally becomes the page
 * with no cut. Leaving plays the same mapping in reverse.
 */

/** Size of the laptop's display surface in its local space (metres). */
export const SCREEN_W = 0.68
export const SCREEN_H = 0.43

/** The two screens you can lean into: the external monitor and the MacBook on its stand. */
export type ScreenId = 'monitor' | 'laptop'
/** Display surface size of each screen in its own local space (metres). */
export const SCREEN_SIZE: Record<ScreenId, { w: number; h: number }> = {
  laptop: { w: SCREEN_W, h: SCREEN_H },
  monitor: { w: 0.6, h: 0.3375 }, // 27" 16:9
}
/** Registered by the scene so the camera rig can find each screen. */
export const screens: Record<ScreenId, THREE.Mesh | null> = { monitor: null, laptop: null }
/** Which screen the desktop opens on (set when you click one). */
export const activeScreen: { id: ScreenId } = { id: 'monitor' }

/** Things the camera can zoom in on from the chair (e.g. the corkboard). Registered by the scene. */
export type FocusId = 'cork' | 'certs'
/** `mesh`: any object centred on the target with its +z facing out of the wall. */
export const focusTargets: Record<FocusId, { mesh: THREE.Object3D | null; w: number; h: number }> = {
  cork: { mesh: null, w: 1.0, h: 0.7 },
  certs: { mesh: null, w: 1.16, h: 0.48 },
}

export function currentScreen() {
  const mesh = screens[activeScreen.id] ?? screens.monitor ?? screens.laptop
  if (!mesh) return null
  const id: ScreenId = mesh === screens.laptop ? 'laptop' : 'monitor'
  return { mesh, ...SCREEN_SIZE[id] }
}


type Pt = [number, number]

// --- 2D projective transform (homography), after the classic "perspective mapping" derivation ---
type M3 = number[]
const adj = (m: M3): M3 => [
  m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
  m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
  m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
]
const mul = (a: M3, b: M3): M3 => {
  const c: M3 = []
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let s = 0
      for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j]
      c[3 * i + j] = s
    }
  return c
}
const mulV = (m: M3, v: number[]) => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
]
const basis = (p: Pt[]): M3 => {
  const m = [p[0][0], p[1][0], p[2][0], p[0][1], p[1][1], p[2][1], 1, 1, 1]
  const v = mulV(adj(m), [p[3][0], p[3][1], 1])
  return mul(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]])
}

/** CSS matrix3d that maps the rect (0,0)-(w,h) onto quad [TL, TR, BL, BR] (transform-origin 0 0). */
export function rectToQuad(w: number, h: number, quad: [Pt, Pt, Pt, Pt]): string {
  // corner order for the basis: TL, TR, BL, BR
  const src: Pt[] = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ]
  const t = mul(basis(quad), adj(basis(src)))
  for (let i = 0; i < 9; i++) t[i] /= t[8]
  return `matrix3d(${[t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]].map((n) => +n.toFixed(9)).join(',')})`
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const corner = new THREE.Vector3()
const LOCAL: [number, number][] = [
  [-0.5, 0.5],
  [0.5, 0.5],
  [-0.5, -0.5],
  [0.5, -0.5],
]

/**
 * Place the desktop element on the laptop screen for transition progress t ∈ [0, 1].
 * 0 = sitting back in the chair, 1 = desktop fills the viewport.
 */
export function updatePortal(t: number, camera: THREE.Camera, width: number, height: number) {
  const el = document.getElementById(PORTAL_ID)
  const scr = currentScreen()
  if (!el || !scr) return
  const mesh = scr.mesh
  if (t >= 1) {
    el.style.transform = 'none'
    el.style.opacity = '1'
    return
  }
  mesh.updateWorldMatrix(true, false)
  // Flatten into the full viewport over the last stretch of the move.
  const flat = smooth(0.62, 1, t)
  const vp: Pt[] = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ]
  const quad = LOCAL.map(([x, y], i) => {
    corner.set(x * scr.w, y * scr.h, 0)
    mesh.localToWorld(corner).project(camera)
    const px = ((corner.x + 1) / 2) * width
    const py = ((1 - corner.y) / 2) * height
    return [px + (vp[i][0] - px) * flat, py + (vp[i][1] - py) * flat] as Pt
  }) as [Pt, Pt, Pt, Pt]
  el.style.transform = rectToQuad(width, height, quad)
  // The live desktop fades in over the 3D screen while it's still small.
  el.style.opacity = String(smooth(0.03, 0.3, t))
}
