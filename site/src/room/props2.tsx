import { RoundedBox } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { canvasTexture } from './textures'

/*
 * Room v2: the pieces that make the room feel like a particular person's, in a particular place.
 * Repeated small parts (shells, bulbs, cups) are merged into one mesh each, so they stay cheap to
 * draw and take up one island in the lightmap instead of hundreds.
 */

const merged = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()))!
  parts.forEach((p) => p.dispose())
  return g
}

/* ---------- capiz shell chandelier (the ceiling light) ---------- */

/** Three brass rings of hanging capiz-shell strands around a warm bulb. The bulb is `emit_ceiling`. */
export function CapizChandelier({ on }: { on: boolean }) {
  const tiers = [
    { r: 0.15, n: 10, len: 4, top: -0.34 },
    { r: 0.26, n: 14, len: 5, top: -0.25 },
    { r: 0.37, n: 18, len: 6, top: -0.16 },
  ]
  const shells = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    tiers.forEach((t, ti) => {
      for (let i = 0; i < t.n; i++) {
        const a = (i / t.n) * Math.PI * 2 + ti * 0.4
        for (let k = 0; k < t.len; k++) {
          const g = new THREE.CylinderGeometry(0.03, 0.03, 0.003, 12)
          g.rotateX(Math.PI / 2)
          // real shells never hang square: each one turned a little differently
          g.rotateY(a + Math.sin(i * 3.1 + k * 1.7) * 0.5)
          g.translate(Math.cos(a) * t.r, t.top - 0.05 - k * 0.064, Math.sin(a) * t.r)
          parts.push(g)
        }
      }
    })
    return merged(parts)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const threads = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    tiers.forEach((t, ti) => {
      for (let i = 0; i < t.n; i++) {
        const a = (i / t.n) * Math.PI * 2 + ti * 0.4
        const len = t.len * 0.064 + 0.02
        const g = new THREE.CylinderGeometry(0.0012, 0.0012, len, 4)
        g.translate(Math.cos(a) * t.r, t.top - len / 2, Math.sin(a) * t.r)
        parts.push(g)
      }
    })
    return merged(parts)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const brass = <meshStandardMaterial color="#b8904a" metalness={0.85} roughness={0.3} />
  return (
    <group position={[0, 2.99, 0]}>
      {/* ceiling canopy + rod */}
      <mesh position={[0, -0.015, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.03, 24]} />
        {brass}
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.17, 8]} />
        {brass}
      </mesh>
      {tiers.map((t) => (
        <mesh key={t.r} position={[0, t.top, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[t.r, 0.006, 6, 48]} />
          {brass}
        </mesh>
      ))}
      <mesh geometry={threads}>
        <meshStandardMaterial color="#d9cdb6" roughness={0.9} />
      </mesh>
      {/* pearly, a little pink: capiz is what the window panes are made of too */}
      <mesh geometry={shells} castShadow>
        <meshStandardMaterial color="#f2e7dc" roughness={0.35} side={THREE.DoubleSide} />
      </mesh>
      <mesh name="emit_ceiling" position={[0, -0.4, 0]}>
        <sphereGeometry args={[0.07, 24, 16]} />
        <meshStandardMaterial color="#f7f3ea" emissive="#ffd9a0" emissiveIntensity={on ? 2.2 : 0} />
      </mesh>
      {on && <pointLight position={[0, -0.42, 0]} intensity={6} distance={9} decay={1.6} color="#ffd6a0" />}
    </group>
  )
}

/* ---------- neon: the Philippine flag's triangle, sun and three stars ---------- */

function starPath(cx: number, cy: number, r: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.42 : r
    pts.push(new THREE.Vector3(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0))
  }
  return pts
}
function tubeAlong(pts: THREE.Vector3[], radius: number) {
  const path = new THREE.CurvePath<THREE.Vector3>()
  for (let i = 0; i < pts.length - 1; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
  return new THREE.TubeGeometry(path, pts.length * 4, radius, 6, false)
}

/** Neon sign of the flag's white triangle with the sun and stars. Faces +z; the tubes are `emit_neon`. */
export function NeonFlag({ lit }: { lit: boolean }) {
  const tubes = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const R = 0.007
    // the triangle (rounded corners would be nicer; neon benders bend, so slightly cut corners)
    const A = new THREE.Vector3(-0.27, 0.24, 0)
    const B = new THREE.Vector3(-0.27, -0.24, 0)
    const C = new THREE.Vector3(0.18, 0, 0)
    parts.push(tubeAlong([A, B, C, A.clone().add(new THREE.Vector3(0.01, -0.006, 0))], R))
    // the sun: a ring and eight rays
    const sx = -0.12
    const ring = new THREE.TorusGeometry(0.055, R, 6, 40)
    ring.translate(sx, 0, 0)
    parts.push(ring)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8
      for (const off of [-0.18, 0, 0.18]) {
        const len = off ? 0.035 : 0.055
        const g = new THREE.CylinderGeometry(R * 0.8, R * 0.8, len, 6)
        g.translate(0, 0.075 + len / 2, 0)
        g.rotateZ(a - Math.PI / 2 + off)
        g.translate(sx, 0, 0)
        parts.push(g)
      }
    }
    // three stars, one in each corner
    parts.push(tubeAlong(starPath(-0.225, 0.17, 0.032), R * 0.8))
    parts.push(tubeAlong(starPath(-0.225, -0.17, 0.032), R * 0.8))
    parts.push(tubeAlong(starPath(0.09, 0, 0.032), R * 0.8))
    return merged(parts)
  }, [])
  return (
    <group>
      {/* clear acrylic backing on standoffs, like real neon signs */}
      <mesh position={[-0.05, 0, 0.012]}>
        <boxGeometry args={[0.6, 0.62, 0.006]} />
        <meshStandardMaterial color="#2a2622" roughness={0.25} metalness={0.1} />
      </mesh>
      <mesh name="emit_neon" geometry={tubes} position={[0, 0, 0.03]}>
        <meshStandardMaterial color="#fff2c4" emissive="#ffcf4a" emissiveIntensity={lit ? 3 : 0} roughness={0.3} />
      </mesh>
      {lit && <pointLight position={[0, 0, 0.25]} intensity={1.6} distance={2.5} decay={2} color="#ffcf4a" />}
    </group>
  )
}

/* ---------- sungka: the Filipino shell-and-pits board game ---------- */

/** A carved sungka board with its 14 small pits, the two "houses" and cowrie shells. Long axis = x. */
export function Sungka() {
  const shells = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    let seed = 7
    const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
    const pits: [number, number, number][] = []
    for (let i = 0; i < 7; i++) for (const z of [-0.045, 0.045]) pits.push([-0.21 + i * 0.07, z, 3])
    pits.push([-0.33, 0, 9], [0.33, 0, 11]) // the houses hold more
    for (const [x, z, n] of pits)
      for (let k = 0; k < n; k++) {
        const g = new THREE.SphereGeometry(0.007, 6, 4)
        g.scale(1.4, 0.7, 1)
        g.rotateY(r() * Math.PI)
        g.translate(x + (r() - 0.5) * 0.02, 0.058 + r() * 0.006, z + (r() - 0.5) * 0.02)
        parts.push(g)
      }
    return merged(parts)
  }, [])
  const wood = <meshStandardMaterial color="#6b3f22" roughness={0.55} />
  const pit = <meshStandardMaterial color="#2a170c" roughness={0.9} />
  return (
    <group>
      {/* a boat-shaped board on two low feet */}
      <RoundedBox args={[0.8, 0.05, 0.17]} radius={0.02} position={[0, 0.035, 0]} castShadow receiveShadow>
        {wood}
      </RoundedBox>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 0.035, 0]} rotation={[0, 0, x > 0 ? -0.25 : 0.25]} castShadow>
          <boxGeometry args={[0.08, 0.04, 0.1]} />
          {wood}
        </mesh>
      ))}
      {Array.from({ length: 7 }, (_, i) =>
        [-0.045, 0.045].map((z) => (
          <mesh key={`${i}${z}`} position={[-0.21 + i * 0.07, 0.0605, z]}>
            <cylinderGeometry args={[0.022, 0.022, 0.002, 16]} />
            {pit}
          </mesh>
        )),
      )}
      {[-0.33, 0.33].map((x) => (
        <mesh key={x} position={[x, 0.0605, 0]}>
          <cylinderGeometry args={[0.042, 0.042, 0.002, 20]} />
          {pit}
        </mesh>
      ))}
      <mesh geometry={shells} castShadow>
        <meshStandardMaterial color="#efe6d6" roughness={0.4} />
      </mesh>
    </group>
  )
}

/* ---------- a 16mm film projector ---------- */

function Reel({ r }: { r: number }) {
  const spokes = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 3; i++) {
      const g = new THREE.BoxGeometry(r * 1.6, 0.012, 0.008)
      g.rotateZ((i * Math.PI) / 3)
      parts.push(g)
    }
    return merged(parts)
  }, [r])
  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      <mesh castShadow>
        <torusGeometry args={[r, 0.008, 6, 36]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* the wound film */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.72, r * 0.72, 0.014, 32]} />
        <meshStandardMaterial color="#2a1f18" roughness={0.6} />
      </mesh>
      <mesh geometry={spokes}>
        <meshStandardMaterial color="#9aa0a6" metalness={0.8} roughness={0.3} />
      </mesh>
    </group>
  )
}

/** Vintage projector with feed and take-up reels. Lens points to -x. */
export function Projector() {
  const body = <meshStandardMaterial color="#3d4a43" roughness={0.45} metalness={0.3} />
  return (
    <group>
      <RoundedBox args={[0.26, 0.14, 0.13]} radius={0.02} position={[0, 0.09, 0]} castShadow receiveShadow>
        {body}
      </RoundedBox>
      {/* vents */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0.04 + i * 0.022, 0.09, 0.0655]}>
          <planeGeometry args={[0.008, 0.07]} />
          <meshStandardMaterial color="#1a1f1c" />
        </mesh>
      ))}
      {/* lens barrel */}
      <mesh position={[-0.16, 0.1, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.028, 0.032, 0.08, 20]} />
        <meshStandardMaterial color="#1c1c1c" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[-0.201, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 0.002, 20]} />
        <meshStandardMaterial color="#4a5a6a" metalness={0.9} roughness={0.05} />
      </mesh>
      {/* reel arms */}
      {[-0.07, 0.09].map((x, i) => (
        <mesh key={x} position={[x, 0.2 + i * 0.03, 0]} rotation={[0, 0, i ? -0.5 : 0.5]} castShadow>
          <boxGeometry args={[0.016, 0.16 + i * 0.06, 0.016]} />
          {body}
        </mesh>
      ))}
      <group position={[-0.1, 0.27, 0]}>
        <Reel r={0.075} />
      </group>
      <group position={[0.13, 0.3, 0]}>
        <Reel r={0.09} />
      </group>
      {/* feet */}
      {[-0.1, 0.1].map((x) =>
        [-0.05, 0.05].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.01, z]}>
            <cylinderGeometry args={[0.012, 0.012, 0.02, 10]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        )),
      )}
    </group>
  )
}

/* ---------- clapperboard ---------- */

function slateTexture() {
  return canvasTexture(512, 400, (g) => {
    g.fillStyle = '#16181a'
    g.fillRect(0, 0, 512, 400)
    g.strokeStyle = 'rgba(240,236,228,.85)'
    g.lineWidth = 3
    // chalk grid
    ;[110, 190, 270].forEach((y) => {
      g.beginPath()
      g.moveTo(14, y)
      g.lineTo(498, y)
      g.stroke()
    })
    g.beginPath()
    g.moveTo(256, 110)
    g.lineTo(256, 270)
    g.stroke()
    g.fillStyle = 'rgba(240,236,228,.6)'
    g.font = '600 20px Inter, sans-serif'
    g.fillText('PROD.', 22, 40)
    g.fillText('SCENE', 22, 136)
    g.fillText('TAKE', 268, 136)
    g.fillText('DIRECTOR', 22, 216)
    g.fillText('CAMERA', 268, 216)
    g.fillText('DATE', 22, 296)
    g.fillStyle = '#f4ede0'
    g.font = '700 46px "Caveat", "Comic Sans MS", cursive'
    g.fillText('Kwarto ni Jaztin', 104, 90)
    g.font = '700 50px "Caveat", "Comic Sans MS", cursive'
    g.fillText('01', 120, 178)
    g.fillText('1', 400, 178)
    g.font = '700 40px "Caveat", "Comic Sans MS", cursive'
    g.fillText('J. Jimenez', 60, 258)
    g.fillText('Manila', 330, 258)
    g.fillText('ngayon (now)', 110, 340)
  })
}

/** Film slate: chalk board with a striped clapper on top. Faces +z, bottom edge at y=0. */
export function Clapperboard() {
  const face = useMemo(() => slateTexture(), [])
  const stripes = useMemo(
    () =>
      canvasTexture(256, 32, (g) => {
        g.fillStyle = '#f4f1ea'
        g.fillRect(0, 0, 256, 32)
        g.fillStyle = '#16181a'
        for (let x = -32; x < 256; x += 32) {
          g.beginPath()
          g.moveTo(x, 32)
          g.lineTo(x + 16, 32)
          g.lineTo(x + 32, 0)
          g.lineTo(x + 16, 0)
          g.fill()
        }
      }),
    [],
  )
  const W = 0.2
  const H = 0.16
  return (
    <group>
      <mesh position={[0, H / 2, 0]} castShadow>
        <boxGeometry args={[W, H, 0.008]} />
        <meshStandardMaterial color="#16181a" roughness={0.8} />
      </mesh>
      <mesh position={[0, H / 2, 0.0041]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial map={face} roughness={0.9} />
      </mesh>
      {/* the clapper stick, hinged at the left and opened a little */}
      <group position={[-W / 2, H + 0.004, 0]} rotation={[0, 0, 0.32]}>
        <mesh position={[W / 2, 0.012, 0]} castShadow>
          <boxGeometry args={[W, 0.024, 0.01]} />
          <meshStandardMaterial color="#16181a" />
        </mesh>
        <mesh position={[W / 2, 0.012, 0.0051]}>
          <planeGeometry args={[W, 0.024]} />
          <meshStandardMaterial map={stripes} />
        </mesh>
      </group>
      <mesh position={[0, H + 0.016, 0]}>
        <boxGeometry args={[W, 0.024, 0.01]} />
        <meshStandardMaterial color="#16181a" />
      </mesh>
      <mesh position={[0, H + 0.016, 0.0051]}>
        <planeGeometry args={[W, 0.024]} />
        <meshStandardMaterial map={stripes} />
      </mesh>
    </group>
  )
}

/* ---------- fairy lights with clipped polaroids ---------- */

function polaroidTexture(i: number) {
  const skies = [
    ['#f6a86b', '#e2566b'],
    ['#7fb6e0', '#f2e2b8'],
    ['#2a2a4a', '#e88a4a'],
    ['#9ad0a8', '#f0e6c0'],
    ['#f2c46a', '#c0392b'],
  ][i % 5]
  return canvasTexture(128, 150, (g) => {
    g.fillStyle = '#fbf8f1'
    g.fillRect(0, 0, 128, 150)
    const gr = g.createLinearGradient(0, 10, 0, 112)
    gr.addColorStop(0, skies[0])
    gr.addColorStop(1, skies[1])
    g.fillStyle = gr
    g.fillRect(10, 10, 108, 102)
    g.fillStyle = 'rgba(20,16,12,.55)'
    g.beginPath()
    g.moveTo(10, 112)
    for (let x = 10; x <= 118; x += 9) g.lineTo(x, 96 - Math.sin(x * 0.09 + i) * 8 - ((x * 7 + i * 13) % 11))
    g.lineTo(118, 112)
    g.fill()
  })
}

/**
 * A string of warm bulbs swooping across the wall, with a few polaroids pegged on.
 * `from`/`to` are the two nails (local x on the wall); the string sags between them. Faces +z.
 */
export function FairyLights({ lit, from, to, sag, photos }: { lit: boolean; from: number; to: number; sag: number; photos: number[] }) {
  const { wire, bulbs, curve } = useMemo(() => {
    const mid = (from + to) / 2
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(from, 0, 0.02), new THREE.Vector3(mid, -sag * 2, 0.05), new THREE.Vector3(to, 0, 0.02))
    const wire = new THREE.TubeGeometry(curve, 64, 0.0018, 4, false)
    const parts: THREE.BufferGeometry[] = []
    const n = Math.round(Math.abs(to - from) / 0.14)
    for (let i = 1; i < n; i++) {
      const p = curve.getPoint(i / n)
      const g = new THREE.SphereGeometry(0.011, 8, 6)
      g.scale(1, 1.35, 1)
      g.translate(p.x, p.y - 0.014, p.z)
      parts.push(g)
    }
    return { wire, bulbs: merged(parts), curve }
  }, [from, to, sag])
  const pics = useMemo(() => photos.map((t, i) => ({ p: curve.getPoint(t), tex: polaroidTexture(i), tilt: [0.08, -0.06, 0.05, -0.09, 0.07][i % 5] })), [photos, curve])
  return (
    <group>
      <mesh geometry={wire}>
        <meshStandardMaterial color="#2b2b2b" roughness={0.6} />
      </mesh>
      <mesh name="emit_fairy" geometry={bulbs}>
        <meshStandardMaterial color="#fff1d0" emissive="#ffb55a" emissiveIntensity={lit ? 3 : 0} roughness={0.3} />
      </mesh>
      {pics.map(({ p, tex, tilt }, i) => (
        // pegged just under the wire, hanging a little crooked
        <group key={i} position={[p.x, p.y - 0.012, p.z - 0.018]} rotation={[0, 0, tilt]}>
          <mesh position={[0, -0.002, 0.004]}>
            <boxGeometry args={[0.012, 0.03, 0.008]} />
            <meshStandardMaterial color="#c9a46a" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.065, 0]} castShadow>
            <boxGeometry args={[0.085, 0.1, 0.002]} />
            <meshStandardMaterial map={tex} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {lit && <pointLight position={[(from + to) / 2, -sag, 0.3]} intensity={1.2} distance={2.5} decay={2} color="#ffb55a" />}
    </group>
  )
}

/* ---------- the jeepney, rebuilt ---------- */

function jeepneySideTexture(flip: boolean) {
  return canvasTexture(512, 128, (g) => {
    if (flip) {
      g.translate(512, 0)
      g.scale(-1, 1)
    }
    g.fillStyle = '#c8261c'
    g.fillRect(0, 0, 512, 128)
    // chrome trim and painted stripes
    g.fillStyle = '#d9dde2'
    g.fillRect(0, 0, 512, 8)
    g.fillRect(0, 120, 512, 8)
    ;['#f2c230', '#2468c8', '#f2c230'].forEach((c, i) => {
      g.fillStyle = c
      g.fillRect(0, 84 + i * 9, 512, 6)
    })
    // windows
    g.fillStyle = '#1b2430'
    for (let i = 0; i < 7; i++) g.fillRect(40 + i * 62, 18, 50, 34)
    // route, painted in the curly lettering every jeepney has
    g.save()
    if (flip) {
      g.translate(512, 0)
      g.scale(-1, 1)
    }
    g.fillStyle = '#fff6d6'
    g.font = 'italic 800 24px Georgia, serif'
    g.textAlign = 'center'
    g.fillText('Kwarto · Mesa · Kama', 256, 76)
    g.restore()
    // stars
    g.fillStyle = '#f2c230'
    ;[16, 496].forEach((x) => {
      g.beginPath()
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const r = i % 2 ? 5 : 11
        g.lineTo(x + Math.cos(a) * r, 64 + Math.sin(a) * r)
      }
      g.fill()
    })
  })
}

/** Desk-sized jeepney: painted body, chrome nose and horses, mirrors, roof rack, signboard. Long axis = x, front = -x. */
export function JeepneyV2({ sign }: { sign: THREE.Texture }) {
  const [left, right] = useMemo(() => [jeepneySideTexture(false), jeepneySideTexture(true)], [])
  const chrome = <meshStandardMaterial color="#e6e8eb" metalness={1} roughness={0.12} />
  const L = 0.34
  const Wd = 0.13
  const wheels: [number, number][] = [
    [-0.1, Wd / 2],
    [0.11, Wd / 2],
    [-0.1, -Wd / 2],
    [0.11, -Wd / 2],
  ]
  return (
    <group>
      {/* passenger body */}
      <RoundedBox args={[L, 0.1, Wd]} radius={0.01} position={[0.02, 0.08, 0]} castShadow>
        <meshStandardMaterial color="#c8261c" metalness={0.3} roughness={0.35} />
      </RoundedBox>
      <mesh position={[0.02, 0.08, Wd / 2 + 0.0008]}>
        <planeGeometry args={[L - 0.02, 0.095]} />
        <meshStandardMaterial map={left} metalness={0.2} roughness={0.35} />
      </mesh>
      <mesh position={[0.02, 0.08, -Wd / 2 - 0.0008]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[L - 0.02, 0.095]} />
        <meshStandardMaterial map={right} metalness={0.2} roughness={0.35} />
      </mesh>
      {/* roof with an overhang, painted blue, and a chrome rack */}
      <RoundedBox args={[L + 0.04, 0.016, Wd + 0.02]} radius={0.006} position={[0.02, 0.138, 0]} castShadow>
        <meshStandardMaterial color="#2468c8" roughness={0.4} />
      </RoundedBox>
      {[-Wd / 2 + 0.008, Wd / 2 - 0.008].map((z) => (
        <mesh key={z} position={[0.04, 0.156, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.003, 0.003, L - 0.04, 6]} />
          {chrome}
        </mesh>
      ))}
      {/* hood and the big chrome grille */}
      <RoundedBox args={[0.11, 0.07, Wd - 0.01]} radius={0.012} position={[-0.2, 0.065, 0]} castShadow>
        <meshStandardMaterial color="#e6e8eb" metalness={0.9} roughness={0.2} />
      </RoundedBox>
      <mesh position={[-0.256, 0.06, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.09, 0.05]} />
        <meshStandardMaterial color="#9aa1a8" metalness={1} roughness={0.25} />
      </mesh>
      {[-0.04, 0.04].map((z) => (
        <mesh key={z} position={[-0.257, 0.075, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.011, 0.011, 0.006, 14]} />
          <meshStandardMaterial color="#fff6d8" emissive="#fff0c0" emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* windshield */}
      <mesh position={[-0.146, 0.11, 0]} rotation={[0, -Math.PI / 2, -0.25]}>
        <planeGeometry args={[Wd - 0.02, 0.045]} />
        <meshStandardMaterial color="#1b2430" metalness={0.4} roughness={0.1} />
      </mesh>
      {/* the famous chrome horses, a pair, rearing on the hood */}
      {[-0.03, 0.03].map((z) => (
        <group key={z} position={[-0.22, 0.104, z]} rotation={[0, 0, 0.35]}>
          <mesh position={[0, 0.018, 0]}>
            <boxGeometry args={[0.03, 0.012, 0.006]} />
            {chrome}
          </mesh>
          <mesh position={[-0.016, 0.03, 0]} rotation={[0, 0, 0.7]}>
            <boxGeometry args={[0.016, 0.009, 0.005]} />
            {chrome}
          </mesh>
          <mesh position={[0.008, 0.004, 0]}>
            <boxGeometry args={[0.005, 0.02, 0.005]} />
            {chrome}
          </mesh>
        </group>
      ))}
      {/* side mirrors on stalks */}
      {[-1, 1].map((s) => (
        <group key={s} position={[-0.16, 0.115, s * (Wd / 2 + 0.012)]}>
          <mesh>
            <cylinderGeometry args={[0.0015, 0.0015, 0.03, 4]} />
            {chrome}
          </mesh>
          <mesh position={[0, 0.018, 0]}>
            <boxGeometry args={[0.006, 0.018, 0.012]} />
            {chrome}
          </mesh>
        </group>
      ))}
      {/* signboard over the windshield */}
      <mesh position={[-0.138, 0.162, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.12, 0.03]} />
        <meshStandardMaterial map={sign} side={THREE.DoubleSide} />
      </mesh>
      {/* chrome bumper and rear step */}
      <mesh position={[-0.262, 0.03, 0]}>
        <boxGeometry args={[0.012, 0.014, Wd + 0.01]} />
        {chrome}
      </mesh>
      <mesh position={[0.2, 0.03, 0]}>
        <boxGeometry args={[0.03, 0.008, Wd - 0.02]} />
        {chrome}
      </mesh>
      {wheels.map(([x, z], i) => (
        <group key={i} position={[x, 0.026, z]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.026, 0.026, 0.02, 18]} />
            <meshStandardMaterial color="#151515" roughness={0.8} />
          </mesh>
          <mesh position={[0, z > 0 ? 0.0105 : -0.0105, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.002, 14]} />
            {chrome}
          </mesh>
        </group>
      ))}
    </group>
  )
}
