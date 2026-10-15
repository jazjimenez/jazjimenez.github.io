import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { SEAT_EYE } from './layout'
import { currentScreen, focusTargets, type FocusId, updatePortal } from './screenPortal'

/** The three places you can look from the chair: left (window), center (desk), right (records, books, bed). */
export const LOOK_YAWS = [1.3, 0, -1.3] as const
/** Head tilt per view: level at the window, down at the desk, a little down for records/books. */
const LOOK_PITCHES = [0.02, -0.16, 0.02] as const
export const CENTER_VIEW = 1
const TURN_SECONDS = 0.95
const EDGE = 0.86 // cursor this close to a side edge…
const EDGE_DWELL = 0.35 // …for this long (s) turns you that way
const SWIPE_PX = 50
const LEAN_SECONDS = 1.6 // chair → screen-fills-the-page

export type LaptopMode = 'seat' | 'entering' | 'inside' | 'leaving'
/** landing: third-person "dollhouse" view behind the welcome page · arriving: flying in · done: seated */
export type IntroMode = 'landing' | 'arriving' | 'done'

const ARRIVE_SECONDS = 2.6
// Third-person view from outside the room (front-right, above), looking into the cutaway.
const LANDING_TARGET = new THREE.Vector3(-0.4, 0.9, -0.7)
const LANDING_OFFSET = new THREE.Vector3(6.2, 4.4, 6.6)
// The flight in arcs through this point (above the bed corner, inside the room).
const ARRIVE_VIA = new THREE.Vector3(1.6, 2.2, 1.4)
// On wide screens the welcome text sits on the left, so shift the room toward the right of the frame.
const LANDING_SHIFT = 0.17 // fraction of the view width

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/**
 * First-person camera: you're sitting at the desk, and can look at three views (LOOK_YAWS).
 * - The view is controlled by `look` (0 left, 1 center, 2 right); turns between views are eased.
 * - Asks to turn (`onLookRequest(-1 | 1)`) when the cursor rests at a side edge, on ← / → keys,
 *   or on a horizontal swipe. The on-screen arrows in the UI change `look` directly.
 * - The cursor nudges your gaze a little within a view (like glancing).
 * - `entering`: one eased move from the chair to the screen while the real desktop is mapped onto
 *   the 3D screen and grows to fill the page (see screenPortal.ts). `leaving` plays it backwards.
 */
export default function FirstPersonRig({
  mode,
  onEntered,
  onLeft,
  look,
  onLookRequest,
  intro,
  onArrived,
  focus = null,
}: {
  /** Zoomed in on something from the chair (eased in/out; no turning or glancing meanwhile). */
  focus?: FocusId | null
  intro: IntroMode
  onArrived: () => void
  mode: LaptopMode
  onEntered: () => void
  onLeft: () => void
  look: number
  onLookRequest: (dir: -1 | 1) => void
}) {
  const { camera, gl, size, invalidate, get } = useThree()
  const yaw = useRef<number>(LOOK_YAWS[look])
  const turn = useRef({ from: LOOK_YAWS[look] as number, to: LOOK_YAWS[look] as number, t: 1 })
  const basePitch = useRef<number>(LOOK_PITCHES[look])
  const pitchTurn = useRef({ from: LOOK_PITCHES[look] as number, to: LOOK_PITCHES[look] as number })
  const pointer = useRef({ x: 0, y: 0, overCanvas: false, edgeSince: 0, edgeFired: false })
  const swipe = useRef<{ x: number; done: boolean } | null>(null)
  const pitchOffset = useRef(0)
  const lean = useRef({ t: 0, done: false, haveSeat: false })
  const arrive = useRef({ t: 0, done: false, fromPos: new THREE.Vector3(), fromQ: new THREE.Quaternion() })
  const request = useRef(onLookRequest)
  request.current = onLookRequest
  const tmp = useMemo(
    () => ({
      look: new THREE.Vector3(),
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
      seatPos: new THREE.Vector3(),
      seatQ: new THREE.Quaternion(),
      endPos: new THREE.Vector3(),
      endQ: new THREE.Quaternion(),
      center: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      scale: new THREE.Vector3(),
    }),
    [],
  )

  // Wider lens on portrait phones so the desk still fits.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = size.width / size.height < 0.8 ? 78 : 62
    cam.updateProjectionMatrix()
    invalidate()
  }, [camera, size.width, size.height, invalidate])

  // Landing pose: farther back on narrow screens so the whole room fits.
  const landingPos = useMemo(() => {
    const k = size.width / size.height < 1 ? 1.4 : 1
    return LANDING_TARGET.clone().addScaledVector(LANDING_OFFSET, k)
  }, [size.width, size.height])

  useEffect(() => {
    if (intro === 'arriving') {
      // fly in from exactly where the camera is (mid-drift), so there's no jump
      arrive.current.fromPos.copy(camera.position)
      arrive.current.fromQ.copy(camera.quaternion)
      arrive.current.t = 0
      arrive.current.done = false
      yaw.current = LOOK_YAWS[look]
      turn.current = { from: yaw.current, to: yaw.current, t: 1 }
      basePitch.current = LOOK_PITCHES[look]
    }
    invalidate()
  }, [intro]) // eslint-disable-line react-hooks/exhaustive-deps

  // Start an eased turn whenever the requested view changes.
  useEffect(() => {
    turn.current = { from: yaw.current, to: LOOK_YAWS[look], t: 0 }
    pitchTurn.current = { from: basePitch.current, to: LOOK_PITCHES[look] }
    invalidate()
  }, [look, invalidate])

  // Pose to return to (where you were looking from the chair).
  const seatPose = () => {
    const y = yaw.current
    const pitch = basePitch.current - pitchOffset.current
    tmp.seatPos.copy(SEAT_EYE)
    tmp.look.set(SEAT_EYE.x - Math.sin(y) * Math.cos(pitch), SEAT_EYE.y + Math.sin(pitch), SEAT_EYE.z - Math.cos(y) * Math.cos(pitch))
    tmp.m.lookAt(tmp.seatPos, tmp.look, camera.up)
    tmp.seatQ.setFromRotationMatrix(tmp.m)
  }

  useEffect(() => {
    const l = lean.current
    if (mode === 'entering') {
      // Start from exactly where the camera is now (including any glance), so there's no jump.
      tmp.seatPos.copy(camera.position)
      tmp.seatQ.copy(camera.quaternion)
      l.haveSeat = true
      l.t = 0
    } else if (mode === 'leaving') {
      if (!l.haveSeat) seatPose() // arrived via the #laptop link: go back to the default seat view
      l.t = 1
    } else if (mode === 'inside') l.t = 1
    else l.t = 0
    l.done = false
    invalidate()
  }, [mode, invalidate, camera]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Where the camera ends up: square on to the screen, the screen exactly fitting the view. */
  const screenPose = () => {
    const scr = currentScreen()
    if (!scr) return false
    const mesh = scr.mesh
    mesh.updateWorldMatrix(true, false)
    mesh.getWorldPosition(tmp.center)
    mesh.getWorldScale(tmp.scale)
    tmp.normal.set(0, 0, 1).transformDirection(mesh.matrixWorld)
    const cam = camera as THREE.PerspectiveCamera
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const aspect = size.width / size.height
    const d = Math.max((scr.h * tmp.scale.y) / (2 * tanHalf), (scr.w * tmp.scale.x) / (2 * tanHalf * aspect))
    tmp.endPos.copy(tmp.center).addScaledVector(tmp.normal, d)
    tmp.m.lookAt(tmp.endPos, tmp.center, camera.up)
    tmp.endQ.setFromRotationMatrix(tmp.m)
    return true
  }

  /** Square on to a focus target, fitted to the view with a little margin. */
  const focusPose = (id: FocusId) => {
    const t = focusTargets[id]
    if (!t.mesh) return false
    t.mesh.updateWorldMatrix(true, false)
    t.mesh.getWorldPosition(tmp.center)
    t.mesh.getWorldScale(tmp.scale)
    tmp.normal.set(0, 0, 1).transformDirection(t.mesh.matrixWorld)
    const cam = camera as THREE.PerspectiveCamera
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const aspect = size.width / size.height
    const d = 1.12 * Math.max((t.h * tmp.scale.y) / (2 * tanHalf), (t.w * tmp.scale.x) / (2 * tanHalf * aspect))
    tmp.endPos.copy(tmp.center).addScaledVector(tmp.normal, d)
    tmp.m.lookAt(tmp.endPos, tmp.center, camera.up)
    tmp.endQ.setFromRotationMatrix(tmp.m)
    return true
  }

  useEffect(() => invalidate(), [focus, invalidate])

  // Dev-only handle for inspecting views from the console: __room.look(yaw, pitch)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    ;(window as unknown as { __room: unknown }).__room = {
      look: (y: number, p = 0) => {
        yaw.current = y
        turn.current = { from: y, to: y, t: 1 }
        pitchOffset.current = p
        invalidate()
      },
      frames: () => gl.info.render.frame,
      store: get,
      exportScene: async () => (await import('./devExport')).exportRoomScene(get().scene),
    }
  }, [invalidate, gl, get])

  useEffect(() => {
    const el = gl.domElement
    const onMove = (e: PointerEvent) => {
      const p = pointer.current
      p.x = (e.clientX / window.innerWidth) * 2 - 1
      p.y = (e.clientY / window.innerHeight) * 2 - 1
      // Only react when the cursor is over the room itself, not over buttons/panels.
      p.overCanvas = e.target === el && e.pointerType === 'mouse'
      if (Math.abs(p.x) < EDGE || !p.overCanvas) {
        p.edgeSince = 0
        p.edgeFired = false
      } else if (!p.edgeSince) p.edgeSince = performance.now()
      if (swipe.current && !swipe.current.done && Math.abs(e.clientX - swipe.current.x) > SWIPE_PX) {
        // swipe left → look right (like dragging the world), swipe right → look left
        request.current(e.clientX < swipe.current.x ? 1 : -1)
        swipe.current.done = true
      }
      invalidate() // the gaze follows the cursor, so draw a frame
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && e.target === el) swipe.current = { x: e.clientX, done: false }
    }
    const onUp = () => (swipe.current = null)
    const onLeave = () => {
      pointer.current.overCanvas = false
      pointer.current.edgeSince = 0
      invalidate()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === 'ArrowLeft') request.current(-1)
      else if (e.key === 'ArrowRight') request.current(1)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    document.documentElement.addEventListener('pointerleave', onLeave)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('keydown', onKey)
    }
  }, [gl, invalidate])

  /** Lens shift (0..1 of LANDING_SHIFT); eased to 0 during the flight so there's no jump. */
  const lensShift = (amount: number) => {
    const cam = camera as THREE.PerspectiveCamera
    const w = size.width
    const h = size.height
    // wide: room to the right of the text · portrait: room above the text (which sits at the bottom)
    const sx = w / h > 1.1 ? -w * amount * LANDING_SHIFT : 0
    const sy = w / h < 0.9 ? h * amount * 0.2 : 0
    if (Math.abs(sx) + Math.abs(sy) > 0.5) cam.setViewOffset(w, h, sx, sy, w, h)
    else if (cam.view?.enabled) cam.clearViewOffset()
  }

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.1)
    const p = pointer.current

    // ---- leaning in / out: one continuous, eased move ----
    if (mode === 'entering' || mode === 'leaving') {
      const l = lean.current
      if (!screenPose()) return
      l.t = THREE.MathUtils.clamp(l.t + ((mode === 'entering' ? 1 : -1) * dt) / LEAN_SECONDS, 0, 1)
      const e = easeInOutCubic(l.t)
      camera.position.lerpVectors(tmp.seatPos, tmp.endPos, e)
      camera.quaternion.slerpQuaternions(tmp.seatQ, tmp.endQ, e)
      camera.updateMatrixWorld()
      updatePortal(l.t, camera, size.width, size.height)
      state.invalidate()
      if (!l.done && mode === 'entering' && l.t >= 1) {
        l.done = true
        onEntered()
      } else if (!l.done && mode === 'leaving' && l.t <= 0) {
        l.done = true
        onLeft()
      }
      return
    }
    if (mode === 'inside') return

    // ---- welcome page: slow drift around the dollhouse view ----
    if (intro === 'landing') {
      const t = state.clock.elapsedTime
      const drift = Math.sin(t * 0.18) * 0.35
      tmp.look.copy(landingPos).sub(LANDING_TARGET).applyAxisAngle(camera.up, drift).add(LANDING_TARGET)
      tmp.look.y += Math.sin(t * 0.23) * 0.15
      camera.position.copy(tmp.look)
      camera.lookAt(LANDING_TARGET)
      lensShift(1)
      state.invalidate()
      return
    }

    // ---- "Enter the room": one curved, eased flight into the chair ----
    if (intro === 'arriving') {
      const a = arrive.current
      a.t = Math.min(1, a.t + dt / ARRIVE_SECONDS)
      const e = easeInOutCubic(a.t)
      seatPose()
      // quadratic Bézier from the outside view, via a point inside the room, to the seat
      const u = 1 - e
      camera.position
        .copy(a.fromPos)
        .multiplyScalar(u * u)
        .addScaledVector(ARRIVE_VIA, 2 * u * e)
        .addScaledVector(tmp.seatPos, e * e)
      camera.quaternion.slerpQuaternions(a.fromQ, tmp.seatQ, easeInOutCubic(Math.min(1, a.t * 1.15)))
      lensShift(1 - easeInOutCubic(Math.min(1, a.t * 1.6)))
      state.invalidate()
      if (a.t >= 1 && !a.done) {
        a.done = true
        onArrived()
      }
      return
    }

    // ---- zoomed in on something (the corkboard): ease over, hold still ----
    if (focus && focusPose(focus)) {
      p.edgeSince = 0
      camera.position.lerp(tmp.endPos, 1 - Math.exp(-dt * 3.2))
      camera.quaternion.slerp(tmp.endQ, 1 - Math.exp(-dt * 4.5))
      const posDone = camera.position.distanceToSquared(tmp.endPos) < 1e-6
      const rotDone = camera.quaternion.angleTo(tmp.endQ) < 2e-3
      if (posDone) camera.position.copy(tmp.endPos)
      if (rotDone) camera.quaternion.copy(tmp.endQ)
      if (!posDone || !rotDone) state.invalidate()
      return
    }

    // Resting the cursor at a side edge asks to turn that way (once per visit to the edge).
    const resting = p.edgeSince > 0 && !p.edgeFired
    if (resting && performance.now() - p.edgeSince > EDGE_DWELL * 1000) {
      p.edgeFired = true
      request.current(p.x < 0 ? -1 : 1)
    }

    // Eased turn between views.
    const tw = turn.current
    if (tw.t < 1) {
      tw.t = Math.min(1, tw.t + dt / TURN_SECONDS)
      const e = easeInOutCubic(tw.t)
      yaw.current = THREE.MathUtils.lerp(tw.from, tw.to, e)
      basePitch.current = THREE.MathUtils.lerp(pitchTurn.current.from, pitchTurn.current.to, e)
    }

    // Small "glance" toward the cursor while it's in the middle of the screen.
    const glanceX = p.overCanvas ? THREE.MathUtils.clamp(p.x, -EDGE, EDGE) * 0.12 : 0
    const glanceY = p.overCanvas ? p.y * 0.16 : 0
    const y = yaw.current - glanceX
    const pitch = THREE.MathUtils.clamp(basePitch.current - glanceY - pitchOffset.current, -1.1, 0.9)
    const eye = SEAT_EYE
    const look = tmp.look.set(eye.x - Math.sin(y) * Math.cos(pitch), eye.y + Math.sin(pitch), eye.z - Math.cos(y) * Math.cos(pitch))

    const k = 1 - Math.exp(-dt * 7)
    camera.position.lerp(eye, 1 - Math.exp(-dt * 3))
    tmp.m.lookAt(camera.position, look, camera.up)
    tmp.q.setFromRotationMatrix(tmp.m)
    camera.quaternion.slerp(tmp.q, k)

    // On-demand rendering: keep asking for frames only while the view is still settling.
    // Snap the last hair of the way so float rounding can't keep it "settling" forever.
    const posDone = camera.position.distanceToSquared(eye) < 1e-6
    const rotDone = camera.quaternion.angleTo(tmp.q) < 2e-3
    if (posDone) camera.position.copy(eye)
    if (rotDone) camera.quaternion.copy(tmp.q)
    if (tw.t < 1 || resting || !posDone || !rotDone) state.invalidate()
  })

  return null
}
