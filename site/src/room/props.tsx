import { useFrame, useThree } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  baybayinTexture,
  certificateTexture,
  codeEditorTexture,
  monitorTexture,
  paperPageTexture,
  keyboardTexture,
  signboardTexture,
  woodTexture,
  normalMapFor,
} from './textures'
import { focusTargets, SCREEN_H, SCREEN_SIZE, SCREEN_W, screens } from './screenPortal'
import { CORK, liveCorkboard, livePoster } from './liveTextures'
import { letterboxd, papers } from '../data/content'

export const WOOD = '#8a4b22'
export const WOOD_DARK = '#5e3216'

let woodTex: THREE.Texture | null = null
/** Shared narra wood-grain texture. */
const BULB_HOT = new THREE.Color(6, 4.2, 2.2)

export const wood = () => (woodTex ??= woodTexture())
let woodNormalTex: THREE.Texture | null = null
export const woodNormal = () => (woodNormalTex ??= normalMapFor(wood(), 2))

/* ---------- furniture ---------- */

/** Desk height and placement, shared with the things that sit on it. */
export const DESK = { top: 0.75, w: 2.0, d: 0.8, z: -2.58 }

let oakTex: THREE.Texture | null = null
const oak = () => (oakTex ??= woodTexture('#c9a37a'))

/** Modern desk: light-oak top on black steel sled legs with a back rail. */
export function Desk() {
  const steel = <meshStandardMaterial color="#1b1b1d" metalness={0.75} roughness={0.38} />
  const { top, w, d, z } = DESK
  const legH = top - 0.035
  return (
    <group position={[0, 0, z]}>
      <RoundedBox args={[w, 0.035, d]} radius={0.008} smoothness={3} position={[0, top - 0.0175, 0]} castShadow receiveShadow>
        <meshPhysicalMaterial map={oak()} roughness={0.45} clearcoat={0.35} clearcoatRoughness={0.3} />
      </RoundedBox>
      {[-1, 1].map((sx) => (
        <group key={sx} position={[sx * (w / 2 - 0.08), 0, 0]}>
          {/* sled: two posts, a foot rail and a top rail */}
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[0, legH / 2, sz * (d / 2 - 0.06)]} castShadow>
              <boxGeometry args={[0.04, legH, 0.04]} />
              {steel}
            </mesh>
          ))}
          <mesh position={[0, 0.012, 0]} castShadow>
            <boxGeometry args={[0.05, 0.024, d - 0.08]} />
            {steel}
          </mesh>
          <mesh position={[0, legH - 0.015, 0]}>
            <boxGeometry args={[0.04, 0.03, d - 0.12]} />
            {steel}
          </mesh>
        </group>
      ))}
      {/* back stretcher */}
      <mesh position={[0, legH - 0.05, -(d / 2 - 0.06)]} castShadow>
        <boxGeometry args={[w - 0.16, 0.05, 0.02]} />
        {steel}
      </mesh>
    </group>
  )
}

/** Real-laptop size: the model is ~0.72 m wide, a real 15" laptop is ~0.34–0.40 m. */
const LAPTOP_SCALE = 0.56

export function Laptop() {
  const screen = useMemo(() => codeEditorTexture(), [])
  return (
    <group scale={LAPTOP_SCALE}>
      {/* base */}
      <RoundedBox args={[0.72, 0.022, 0.5]} radius={0.008} castShadow>
        <meshStandardMaterial color="#c9ccd1" metalness={0.6} roughness={0.35} />
      </RoundedBox>
      {/* keyboard + trackpad */}
      <mesh position={[0, 0.0115, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.6, 0.2]} />
        <meshStandardMaterial color="#2a2c30" />
      </mesh>
      <mesh position={[0, 0.0115, 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.22, 0.12]} />
        <meshStandardMaterial color="#b8bbc0" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* lid, hinged at the back edge */}
      <group position={[0, 0.011, -0.24]} rotation={[-0.25, 0, 0]}>
        <RoundedBox args={[0.72, 0.47, 0.014]} radius={0.008} position={[0, 0.235, 0]} castShadow>
          <meshStandardMaterial color="#c9ccd1" metalness={0.6} roughness={0.35} />
        </RoundedBox>
        <mesh
          name="nobake_screen_laptop"
          position={[0, 0.235, 0.0075]}
          ref={(m) => {
            screens.laptop = m
          }}
        >
          <planeGeometry args={[SCREEN_W, SCREEN_H]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

// Desk-lamp geometry, in the lamp's own space (base at the origin).
const LAMP_J1 = new THREE.Vector3(0.05, 0.33, 0.03) // elbow
const LAMP_J2 = new THREE.Vector3(0.25, 0.42, 0.13) // where the shade hangs
/** Direction the shade points: down and toward the front of the desk. Mirrored in blender/bake_room.py. */
export const LAMP_AIM = new THREE.Vector3(0.18, -1, 0.28).normalize()

/** A rod between two points (lamp arms). */
function Rod({ from, to, radius, children }: { from: THREE.Vector3; to: THREE.Vector3; radius: number; children: React.ReactNode }) {
  const { mid, len, quat } = useMemo(() => {
    const dir = to.clone().sub(from)
    return {
      mid: from.clone().add(to).multiplyScalar(0.5),
      len: dir.length(),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    }
  }, [from, to])
  return (
    <mesh position={mid} quaternion={quat} castShadow>
      <cylinderGeometry args={[radius, radius, len, 12]} />
      {children}
    </mesh>
  )
}

/** Architect-style desk lamp: weighted base, two-piece arm, metal shade with a cream lining. */
export function DeskLamp({ night }: { night: boolean }) {
  const shadeQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), LAMP_AIM), [])
  const discQuat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), LAMP_AIM), [])
  const shadePos = useMemo(() => LAMP_J2.clone().addScaledVector(LAMP_AIM, 0.05), [])
  const mouthPos = useMemo(() => LAMP_J2.clone().addScaledVector(LAMP_AIM, 0.1), [])
  const metal = <meshStandardMaterial color="#2e5e52" metalness={0.55} roughness={0.32} />
  const joint = <meshStandardMaterial color="#c9a75e" metalness={0.85} roughness={0.25} />
  return (
    <group scale={1.5}>
      {/* weighted base + switch */}
      <mesh castShadow position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.085, 0.095, 0.024, 32]} />
        {metal}
      </mesh>
      <mesh position={[0.045, 0.028, 0.03]}>
        <boxGeometry args={[0.018, 0.01, 0.012]} />
        <meshStandardMaterial color="#1c1c1c" />
      </mesh>
      {/* arms and joints */}
      <Rod from={new THREE.Vector3(0, 0.024, 0)} to={LAMP_J1} radius={0.007}>
        {metal}
      </Rod>
      <Rod from={LAMP_J1} to={LAMP_J2} radius={0.007}>
        {metal}
      </Rod>
      {[new THREE.Vector3(0, 0.03, 0), LAMP_J1, LAMP_J2].map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.013, 12, 12]} />
          {joint}
        </mesh>
      ))}
      {/* shade: metal outside, cream inside */}
      <group position={shadePos} quaternion={shadeQuat}>
        <mesh castShadow>
          <cylinderGeometry args={[0.028, 0.075, 0.1, 32, 1, true]} />
          <meshStandardMaterial color="#2e5e52" metalness={0.55} roughness={0.3} side={THREE.FrontSide} />
        </mesh>
        <mesh scale={0.97}>
          <cylinderGeometry args={[0.028, 0.075, 0.1, 32, 1, true]} />
          <meshStandardMaterial color="#efe6d2" roughness={0.6} side={THREE.BackSide} />
        </mesh>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.004, 24]} />
          {metal}
        </mesh>
      </group>
      {/* the glowing mouth of the shade (the bulb itself stays hidden inside) */}
      <mesh name="emit_bulb" position={mouthPos} quaternion={discQuat}>
        <circleGeometry args={[0.07, 32]} />
        <meshBasicMaterial color={night ? BULB_HOT : '#e9e0cc'} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* realtime-room fallback only; the baked room has this light in its lightmap */}
      {night && <pointLight position={mouthPos.clone().addScaledVector(LAMP_AIM, 0.06)} intensity={3} distance={4} decay={1.6} color="#ffc887" />}
    </group>
  )
}

const CUP_SPOT: [number, number, number] = [0.86, 0.75, -2.6]

/** Daytime: a mug of hot coffee. */
export function HotCoffeeMug() {
  return (
    <group name="cup_day" position={CUP_SPOT}>
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.045, 0.042, 0.11, 32]} />
        <meshStandardMaterial color="#f3ede0" roughness={0.35} />
      </mesh>
      <mesh position={[0.05, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.025, 0.008, 10, 20]} />
        <meshStandardMaterial color="#f3ede0" roughness={0.35} />
      </mesh>
      {/* hot black coffee with a ring of crema */}
      <mesh position={[0, 0.106, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.041, 32]} />
        <meshStandardMaterial color="#2a170d" roughness={0.15} />
      </mesh>
      <mesh position={[0, 0.1065, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.034, 0.041, 32]} />
        <meshStandardMaterial color="#7a4a26" roughness={0.3} />
      </mesh>
    </group>
  )
}

/** Night: a mason jar of iced coffee with ice and a metal straw. */
export function IcedCoffeeJar() {
  const glass = useMemo(() => {
    // jar profile (radius, height): base, straight wall, shoulder, threaded mouth
    const pts = [
      [0.0, 0.0],
      [0.04, 0.0],
      [0.045, 0.006],
      [0.046, 0.105],
      [0.04, 0.122],
      [0.038, 0.126],
      [0.038, 0.142],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    return new THREE.LatheGeometry(pts, 40)
  }, [])
  const ice: [number, number, number, number][] = [
    [0.012, 0.087, 0.008, 0.4],
    [-0.016, 0.084, -0.006, 1.1],
    [0.002, 0.093, -0.017, 0.7],
    [-0.008, 0.076, 0.016, 1.6],
  ]
  return (
    <group name="cup_night" position={CUP_SPOT}>
      {/* coffee: milky at the bottom, darker on top */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.043, 0.039, 0.05, 32]} />
        <meshStandardMaterial color="#c49a6c" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.074, 0]}>
        <cylinderGeometry args={[0.0435, 0.043, 0.038, 32]} />
        <meshStandardMaterial color="#6e4127" roughness={0.25} />
      </mesh>
      {ice.map(([x, y, z, r], i) => (
        <RoundedBox key={i} args={[0.022, 0.02, 0.022]} radius={0.004} position={[x, y, z]} rotation={[r, r * 0.7, r * 0.3]}>
          <meshStandardMaterial color="#e6f1f4" roughness={0.15} />
        </RoundedBox>
      ))}
      {/* metal straw */}
      <mesh position={[-0.006, 0.1, 0.004]} rotation={[0.12, 0, 0.22]}>
        <cylinderGeometry args={[0.0032, 0.0032, 0.21, 12]} />
        <meshStandardMaterial color="#c9ccd1" metalness={1} roughness={0.22} />
      </mesh>
      {/* glass jar with screw threads at the mouth */}
      <mesh geometry={glass}>
        <meshStandardMaterial name="glass_jar" color="#e8f2f2" transparent opacity={0.22} roughness={0.05} side={THREE.DoubleSide} />
      </mesh>
      {[0.13, 0.136].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.0385, 0.0012, 6, 40]} />
          <meshStandardMaterial name="glass_thread" color="#e8f2f2" transparent opacity={0.3} roughness={0.05} />
        </mesh>
      ))}
    </group>
  )
}

/** The classic white plastic monobloc chair. */
export function MonoblocChair() {
  const mat = <meshStandardMaterial color="#f4f3ef" roughness={0.45} />
  const legs: [number, number][] = [
    [-0.2, -0.2],
    [0.2, -0.2],
    [-0.2, 0.2],
    [0.2, 0.2],
  ]
  return (
    <group name="model_chair" position={[0, 0, -1.8]}>
      <RoundedBox args={[0.5, 0.05, 0.48]} radius={0.02} position={[0, 0.45, 0]} castShadow>
        {mat}
      </RoundedBox>
      {legs.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.22, z]} rotation={[z * 0.3, 0, -x * 0.3]} castShadow>
          <cylinderGeometry args={[0.025, 0.035, 0.46, 10]} />
          {mat}
        </mesh>
      ))}
      <RoundedBox args={[0.5, 0.45, 0.04]} radius={0.02} position={[0, 0.7, 0.24]} rotation={[-0.18, 0, 0]} castShadow>
        {mat}
      </RoundedBox>
      {[-0.12, 0, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.72, 0.265]} rotation={[-0.18, 0, 0]}>
          <boxGeometry args={[0.05, 0.25, 0.01]} />
          <meshStandardMaterial color="#d9d7d0" />
        </mesh>
      ))}
    </group>
  )
}

export function Jeepney() {
  const sign = useMemo(() => signboardTexture(), [])
  const wheels: [number, number][] = [
    [-0.11, 0.06],
    [0.11, 0.06],
    [-0.11, -0.06],
    [0.11, -0.06],
  ]
  return (
    <group rotation={[0, -0.45, 0]} scale={0.7}>
      {/* body */}
      <RoundedBox args={[0.34, 0.09, 0.13]} radius={0.015} position={[0.02, 0.07, 0]} castShadow>
        <meshStandardMaterial color="#d63a2f" metalness={0.3} roughness={0.4} />
      </RoundedBox>
      {/* stripe */}
      <mesh position={[0.02, 0.075, 0.066]}>
        <planeGeometry args={[0.32, 0.018]} />
        <meshStandardMaterial color="#f2c94c" />
      </mesh>
      {/* hood */}
      <RoundedBox args={[0.1, 0.06, 0.12]} radius={0.012} position={[-0.18, 0.055, 0]} castShadow>
        <meshStandardMaterial color="#c9ccd1" metalness={0.8} roughness={0.25} />
      </RoundedBox>
      {/* roof */}
      <RoundedBox args={[0.36, 0.02, 0.15]} radius={0.008} position={[0.02, 0.16, 0]} castShadow>
        <meshStandardMaterial color="#2e6bb8" />
      </RoundedBox>
      {/* windows */}
      <mesh position={[0.03, 0.135, 0.0655]}>
        <planeGeometry args={[0.28, 0.03]} />
        <meshStandardMaterial color="#1d2633" />
      </mesh>
      {/* signboard */}
      <mesh position={[-0.12, 0.185, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.13, 0.035]} />
        <meshBasicMaterial map={sign} side={THREE.DoubleSide} />
      </mesh>
      {/* chrome horse on the hood */}
      <mesh position={[-0.22, 0.1, 0]}>
        <coneGeometry args={[0.012, 0.04, 6]} />
        <meshStandardMaterial color="#e8e8e8" metalness={1} roughness={0.15} />
      </mesh>
      {wheels.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.025, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.02, 14]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
    </group>
  )
}

/** Sliding capiz window set into a real opening (W×H), half open so the street shows through. */
export const WINDOW = { w: 1.56, h: 1.26 }

export function CapizWindow({ night, rainy }: { night: boolean; rainy: boolean }) {
  // Local frame: x along the wall, y up, z into the room. The wall slab spans z ∈ [-0.22, -0.02].
  const { w, h } = WINDOW
  const LINING = 0.025 // boards lining the four sides of the opening (cover the raw wall edge)
  const wi = w - 2 * LINING
  const hi = h - 2 * LINING
  const sashW = wi / 2 + 0.03
  const pane = Math.min((sashW - 0.08) / 3, (hi - 0.08) / 5) - 0.022
  const step = pane + 0.022
  const glow = night ? '#2a3360' : rainy ? '#c9ced6' : '#fff0cf'
  const woodMat = <meshStandardMaterial map={wood()} color="#9a6a45" />
  const sash = (x: number, z: number) => (
    <group position={[x, 0, z]}>
      {[
        [0, hi / 2 - 0.02, sashW, 0.04],
        [0, -hi / 2 + 0.02, sashW, 0.04],
        [-sashW / 2 + 0.02, 0, 0.04, hi],
        [sashW / 2 - 0.02, 0, 0.04, hi],
      ].map(([px, py, sx, sy], i) => (
        <mesh key={i} position={[px, py, 0]} castShadow>
          <boxGeometry args={[sx, sy, 0.035]} />
          {woodMat}
        </mesh>
      ))}
      {/* capiz shells */}
      {Array.from({ length: 3 }, (_, c) =>
        Array.from({ length: 5 }, (_, r) => (
          <mesh key={`${c}-${r}`} position={[(c - 1) * step, (r - 2) * step, 0]}>
            <planeGeometry args={[pane, pane]} />
            <meshStandardMaterial color="#f4ecdc" emissive={glow} emissiveIntensity={night ? 0.35 : 0.9} roughness={0.35} metalness={0.1} side={THREE.DoubleSide} />
          </mesh>
        )),
      )}
      {/* muntins */}
      {[-0.5, 0.5].map((k) => (
        <mesh key={k} position={[k * step, 0, 0.004]}>
          <boxGeometry args={[0.018, hi - 0.06, 0.02]} />
          <meshStandardMaterial color={WOOD_DARK} />
        </mesh>
      ))}
      {[-1.5, -0.5, 0.5, 1.5].map((k) => (
        <mesh key={k} position={[0, k * step, 0.004]}>
          <boxGeometry args={[sashW - 0.06, 0.018, 0.02]} />
          <meshStandardMaterial color={WOOD_DARK} />
        </mesh>
      ))}
    </group>
  )
  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      {/* lining boards inside the opening, through the full wall depth */}
      {[
        [-w / 2 + LINING / 2, 0, LINING, h],
        [w / 2 - LINING / 2, 0, LINING, h],
        [0, h / 2 - LINING / 2, w, LINING],
        [0, -h / 2 + LINING / 2, w, LINING],
      ].map(([px, py, sx, sy], i) => (
        <mesh key={i} position={[px, py, -0.115]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, 0.21]} />
          <meshStandardMaterial map={wood()} color="#8a5a38" />
        </mesh>
      ))}
      {/* casing trim around the opening, on the wall face */}
      {[
        [-w / 2 - 0.03, 0.03, 0.06, h + 0.06],
        [w / 2 + 0.03, 0.03, 0.06, h + 0.06],
        [0, h / 2 + 0.03, w + 0.12, 0.06],
      ].map(([px, py, sx, sy], i) => (
        <mesh key={i} position={[px, py, -0.01]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, 0.02]} />
          <meshStandardMaterial map={wood()} color="#7a4a2a" />
        </mesh>
      ))}
      {/* sill, sticking out into the room */}
      <mesh position={[0, -h / 2 - 0.02, 0.04]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.2, 0.04, 0.14]} />
        <meshStandardMaterial map={wood()} color="#8a5a38" />
      </mesh>
      {/* left sash closed (front track), right sash slid behind it (back track): the right part is open */}
      {sash(-wi / 2 + sashW / 2, -0.06)}
      {sash(-wi / 2 + sashW / 2 + 0.14, -0.11)}
    </group>
  )
}

export function BaybayinScroll() {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let alive = true
    document.fonts
      .load('64px "Noto Sans Tagalog"', 'ᜆᜄᜊᜌ᜔')
      .catch(() => {})
      .finally(() => alive && setTex(baybayinTexture()))
    return () => {
      alive = false
    }
  }, [])
  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[0.5, 1.0]} />
        {/* keyed so the material recompiles once the texture exists */}
        <meshStandardMaterial key={tex ? 'tex' : 'plain'} map={tex} color={tex ? '#ffffff' : '#f1e4c4'} />
      </mesh>
      {[0.52, -0.52].map((y) => (
        <mesh key={y} position={[0, y, 0.03]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.022, 0.022, 0.6, 12]} />
          <meshStandardMaterial color={WOOD_DARK} />
        </mesh>
      ))}
    </group>
  )
}

export function Parol({ lit }: { lit: boolean }) {
  const geom = useMemo(() => {
    const s = new THREE.Shape()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.32 : 0.14
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      if (i === 0) s.moveTo(x, y)
      else s.lineTo(x, y)
    }
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 })
    g.center()
    return g
  }, [])
  return (
    <group>
      {/* string up to the ceiling line */}
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.55]} />
        <meshBasicMaterial color="#3a2a1a" />
      </mesh>
      <group rotation={[0, 0.6, 0]}>
        <mesh name="emit_parol" geometry={geom} castShadow>
          <meshStandardMaterial color="#f2b632" emissive="#ff9a2e" emissiveIntensity={lit ? 1.6 : 0.08} toneMapped={!lit} />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <torusGeometry args={[0.12, 0.012, 8, 32]} />
          <meshStandardMaterial color="#c2421b" emissive="#ff4a2e" emissiveIntensity={lit ? 1.2 : 0} />
        </mesh>
        {[-0.07, 0, 0.07].map((x, i) => (
          <mesh key={x} position={[x, -0.42 - (i === 1 ? 0.06 : 0), 0]}>
            <boxGeometry args={[0.025, 0.36 + (i === 1 ? 0.12 : 0), 0.004]} />
            <meshStandardMaterial color={i === 1 ? '#c2421b' : '#f2b632'} emissive="#ff9a2e" emissiveIntensity={lit ? 0.6 : 0} />
          </mesh>
        ))}
      </group>
      {lit && <pointLight intensity={4} distance={5} decay={1.5} color="#ffb05a" />}
    </group>
  )
}

export function Certificates() {
  const texA = useMemo(() => certificateTexture('IEEE TENCON 2026'), [])
  const texB = useMemo(() => certificateTexture('De La Salle University'), [])
  return (
    <group>
      {[
        [-0.32, 0, texA],
        [0.32, 0.08, texB],
      ].map(([x, y, tex], i) => (
        <group key={i} position={[x as number, y as number, 0]}>
          <mesh position={[0, 0, 0.01]} castShadow>
            <boxGeometry args={[0.5, 0.39, 0.03]} />
            <meshStandardMaterial color="#3b2416" />
          </mesh>
          <mesh position={[0, 0, 0.027]}>
            <planeGeometry args={[0.44, 0.33]} />
            <meshStandardMaterial map={tex as THREE.Texture} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** My Letterboxd top 4, as a row of framed posters (official art, loaded live from TMDB). */
export function Posters() {
  const textures = useMemo(() => letterboxd.favorites.map((_, i) => livePoster(i)), [])
  return (
    <group>
      {textures.map((tex, i) => (
        <group key={i} position={[(i - 1.5) * 0.44, 0, 0]}>
          {/* thin black frame */}
          <mesh position={[0, 0, 0.012]} castShadow>
            <boxGeometry args={[0.4, 0.58, 0.02]} />
            <meshStandardMaterial color="#141414" roughness={0.5} />
          </mesh>
          <mesh name={`nobake_poster_${i}`} position={[0, 0, 0.0225]}>
            <planeGeometry args={[0.37, 0.555]} />
            <meshStandardMaterial map={tex} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function RecordCabinet() {
  return (
    <group position={[2.0, 0, -2.65]}>
      <RoundedBox args={[1.3, 0.62, 0.55]} radius={0.02} position={[0, 0.31, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={wood()} roughness={0.6} />
      </RoundedBox>
      {/* records in the cabinet */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[-0.5 + i * 0.045, 0.31, 0.2]} castShadow>
          <boxGeometry args={[0.03, 0.4, 0.3]} />
          <meshStandardMaterial color={['#c0392b', '#2e6b5e', '#f2b632', '#3a5a8a', '#222'][i % 5]} />
        </mesh>
      ))}
    </group>
  )
}

export function RecordPlayer({ playing }: { playing: boolean }) {
  const disc = useRef<THREE.Mesh>(null!)
  useFrame((st, dt) => {
    if (!playing) return
    disc.current.rotation.y -= dt * 3.5
    st.invalidate()
  })
  return (
    <group position={[0.18, 0, 0]}>
      <RoundedBox args={[0.5, 0.08, 0.4]} radius={0.015} position={[0, 0.04, 0]} castShadow>
        <meshStandardMaterial color="#3b2416" roughness={0.5} />
      </RoundedBox>
      <mesh name="anim_record_disc" ref={disc} position={[-0.04, 0.085, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.008, 40]} />
        <meshStandardMaterial color="#111" roughness={0.25} metalness={0.3} />
      </mesh>
      <mesh position={[-0.04, 0.09, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.004, 24]} />
        <meshStandardMaterial color="#c0392b" />
      </mesh>
      <mesh position={[0.16, 0.11, -0.08]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.012, 0.012, 0.22]} />
        <meshStandardMaterial color="#d8d8d8" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  )
}

/* ---------- the rest of the bedroom ---------- */

export function Bed() {
  return (
    <group name="model_bed" position={[2.45, 0, 1.25]}>
      {/* frame */}
      <RoundedBox args={[1.05, 0.3, 2.05]} radius={0.02} position={[0, 0.2, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={wood()} />
      </RoundedBox>
      {/* headboard against the back */}
      <RoundedBox args={[1.05, 0.9, 0.06]} radius={0.02} position={[0, 0.55, -1.0]} castShadow>
        <meshStandardMaterial map={wood()} />
      </RoundedBox>
      {/* mattress */}
      <RoundedBox args={[0.98, 0.18, 1.95]} radius={0.06} smoothness={4} position={[0, 0.44, 0.02]} castShadow receiveShadow>
        <meshStandardMaterial color="#f2efe8" roughness={0.95} />
      </RoundedBox>
      {/* blanket */}
      <RoundedBox args={[1.02, 0.06, 1.3]} radius={0.03} smoothness={4} position={[0, 0.54, 0.35]} castShadow receiveShadow>
        <meshStandardMaterial color="#2e6b5e" roughness={1} />
      </RoundedBox>
      <mesh position={[0, 0.575, -0.28]}>
        <boxGeometry args={[1.02, 0.012, 0.08]} />
        <meshStandardMaterial color="#e8a33a" roughness={1} />
      </mesh>
      {/* pillows */}
      {[-0.22, 0.22].map((x) => (
        <RoundedBox key={x} args={[0.42, 0.12, 0.3]} radius={0.05} smoothness={4} position={[x, 0.59, -0.75]} rotation={[0.15, 0, 0]} castShadow>
          <meshStandardMaterial color="#fbf8f2" roughness={1} />
        </RoundedBox>
      ))}
    </group>
  )
}

export function Bookshelf() {
  // Books stand in a row from the left. One leans: it pivots on its bottom-left corner, placed so its
  // top edge just rests against the book before it (no overlap), and the row continues after it.
  const books = useMemo(() => {
    const colors = ['#c0392b', '#2e6b5e', '#f2b632', '#3a5a8a', '#6b4a7a', '#d9d2c2', '#2a2a2a']
    const GAP = 0.004
    const LEAN = 0.22
    const LEANER = 9
    const out: { x: number; w: number; h: number; c: string; tilt: number }[] = []
    let x = -0.5 // left edge of the next book
    for (let i = 0; x < 0.42; i++) {
      const w = 0.035 + ((i * 7) % 5) * 0.008
      const prevH = out.length ? out[out.length - 1].h : 0.3
      // the leaning book is a bit shorter than its neighbour so it actually rests on it
      const h = i === LEANER ? Math.min(prevH - 0.02, 0.22) : 0.2 + ((i * 11) % 6) * 0.02
      if (i === LEANER) {
        const pivot = x + h * Math.sin(LEAN) // top-left corner lands on the previous book
        out.push({ x: pivot, w, h, c: colors[i % colors.length], tilt: LEAN })
        x = pivot + w * Math.cos(LEAN) + GAP * 2
      } else {
        out.push({ x, w, h, c: colors[i % colors.length], tilt: 0 })
        x += w + GAP
      }
    }
    return out
  }, [])
  return (
    <group position={[2.9, 1.55, -1.0]} rotation={[0, -Math.PI / 2, 0]}>
      {[0, 0.4].map((y) => (
        <mesh key={y} position={[0, y, 0.11]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.03, 0.22]} />
          <meshStandardMaterial map={wood()} />
        </mesh>
      ))}
      {books.map((b, i) => (
        // pivot = the book's bottom-left corner, sitting on the shelf
        <group key={i} position={[b.x, 0.015, 0.11]} rotation={[0, 0, b.tilt]}>
          <mesh position={[b.w / 2, b.h / 2, 0]} castShadow>
            <boxGeometry args={[b.w, b.h, 0.16]} />
            <meshStandardMaterial color={b.c} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* a little jeepney-red radio on the top shelf */}
      <RoundedBox args={[0.28, 0.16, 0.12]} radius={0.02} position={[-0.25, 0.5, 0.11]} castShadow>
        <meshStandardMaterial color="#b8261b" roughness={0.5} />
      </RoundedBox>
      <mesh position={[0.25, 0.5, 0.11]} castShadow>
        <cylinderGeometry args={[0.06, 0.05, 0.16, 16]} />
        <meshStandardMaterial color="#b5562f" />
      </mesh>
    </group>
  )
}

/** Analog clock that shows the real time in Manila. */
export function WallClock({ face }: { face: THREE.Texture }) {
  const hour = useRef<THREE.Group>(null!)
  const minute = useRef<THREE.Group>(null!)
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => {
    const tick = () => {
      setHands()
      invalidate()
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidate])
  const setHands = () => {
    if (!hour.current || !minute.current) return
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date())
      .reduce<Record<string, number>>((acc, p) => (p.type === 'hour' || p.type === 'minute' ? { ...acc, [p.type]: Number(p.value) } : acc), {})
    const m = parts.minute ?? 0
    const h = (parts.hour ?? 0) % 12
    minute.current.rotation.z = -(m / 60) * Math.PI * 2
    hour.current.rotation.z = -((h + m / 60) / 12) * Math.PI * 2
  }
  return (
    <group position={[0.5, 2.45, 2.98]} rotation={[0, Math.PI, 0]}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.04, 40]} />
        <meshStandardMaterial color="#3b2416" />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <circleGeometry args={[0.215, 40]} />
        <meshStandardMaterial map={face} />
      </mesh>
      <group position={[0, 0, 0.03]}>
        <group name="anim_clock_hour" ref={hour}>
          <mesh position={[0, 0.055, 0]}>
            <boxGeometry args={[0.014, 0.11, 0.004]} />
            <meshStandardMaterial color="#1a120c" />
          </mesh>
        </group>
        <group name="anim_clock_minute" ref={minute}>
          <mesh position={[0, 0.08, 0.004]}>
            <boxGeometry args={[0.009, 0.16, 0.004]} />
            <meshStandardMaterial color="#1a120c" />
          </mesh>
        </group>
      </group>
    </group>
  )
}

export function Door() {
  return (
    <group position={[-1.3, 0, 2.98]} rotation={[0, Math.PI, 0]}>
      {/* casing */}
      {[
        [0, 2.13, 1.06, 0.08],
        [-0.5, 1.06, 0.07, 2.12],
        [0.5, 1.06, 0.07, 2.12],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.01]} castShadow>
          <boxGeometry args={[w, h, 0.04]} />
          <meshStandardMaterial map={wood()} color="#6a3d20" />
        </mesh>
      ))}
      <mesh position={[0, 1.04, 0]} receiveShadow>
        <boxGeometry args={[0.92, 2.08, 0.04]} />
        <meshStandardMaterial map={wood()} color="#a87048" />
      </mesh>
      {/* panels */}
      {[0.55, 1.5].map((y) => (
        <mesh key={y} position={[0, y, 0.022]}>
          <boxGeometry args={[0.7, 0.7, 0.01]} />
          <meshStandardMaterial map={wood()} color="#946040" />
        </mesh>
      ))}
      <mesh position={[0.36, 1.0, 0.05]}>
        <sphereGeometry args={[0.03, 16, 16]} />
        <meshStandardMaterial color="#d8b06a" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* light switch */}
      <mesh position={[0.72, 1.2, 0.01]}>
        <boxGeometry args={[0.08, 0.12, 0.015]} />
        <meshStandardMaterial color="#f4f1ea" />
      </mesh>
    </group>
  )
}

export function CeilingLight({ on }: { on: boolean }) {
  return (
    <group position={[0, 2.97, 0]}>
      <mesh name="emit_ceiling" rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.24, 0.06, 40]} />
        <meshStandardMaterial color="#f7f3ea" emissive="#ffd9a0" emissiveIntensity={on ? 1.4 : 0} />
      </mesh>
      {on && <pointLight position={[0, -0.25, 0]} intensity={6} distance={9} decay={1.6} color="#ffd6a0" />}
    </group>
  )
}

/** The classic aparador (wardrobe) — every Filipino bedroom has one. */
export function Aparador() {
  return (
    <group position={[0.5, 0, 2.7]} rotation={[0, Math.PI, 0]}>
      <RoundedBox args={[1.1, 2.0, 0.55]} radius={0.02} position={[0, 1.0, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={wood()} color="#9a6a45" />
      </RoundedBox>
      {[-0.275, 0.275].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.08, 0.28]}>
            <boxGeometry args={[0.5, 1.7, 0.02]} />
            <meshStandardMaterial map={wood()} color="#8a5a38" />
          </mesh>
          <mesh position={[x * 0.12, 1.1, 0.3]}>
            <boxGeometry args={[0.02, 0.14, 0.02]} />
            <meshStandardMaterial color="#d8b06a" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
      <mesh position={[0.275, 1.25, 0.292]}>
        <planeGeometry args={[0.36, 1.0]} />
        <meshStandardMaterial color="#cfd8de" metalness={0.9} roughness={0.08} />
      </mesh>
    </group>
  )
}

/** Realtime-room stand-in for the acoustic guitar (the baked room uses the detailed Blender model). */
export function GuitarStandIn() {
  return (
    <group name="model_guitar" rotation={[0, 0.42, 0]}>
      <group rotation={[-0.26, 0, 0]} position={[0, 0.12, 0]}>
        <mesh position={[0, 0.25, 0]} scale={[1, 1.25, 0.28]} castShadow>
          <sphereGeometry args={[0.17, 24, 16]} />
          <meshStandardMaterial color="#c99a62" />
        </mesh>
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[0.05, 0.48, 0.025]} />
          <meshStandardMaterial color="#3a2416" />
        </mesh>
      </group>
      <mesh position={[0, 0.04, 0.08]}>
        <boxGeometry args={[0.32, 0.03, 0.3]} />
        <meshStandardMaterial color="#1d1e21" />
      </mesh>
    </group>
  )
}

/** A loose stack of printed papers with a binder clip — the top page is my TagaBaybay paper. */
export function PaperStack() {
  const page = useMemo(() => paperPageTexture(papers[0].title, papers[0].authors), [])
  const sheets = useMemo(() => {
    const out: { y: number; rot: number; dx: number; dz: number }[] = []
    let r = 11
    const rnd = () => ((r = (r * 16807) % 2147483647) - 1) / 2147483646
    for (let i = 0; i < 14; i++) out.push({ y: 0.0009 + i * 0.0016, rot: (rnd() - 0.5) * 0.12, dx: (rnd() - 0.5) * 0.012, dz: (rnd() - 0.5) * 0.012 })
    return out
  }, [])
  const top = sheets[sheets.length - 1]
  return (
    <group rotation={[0, 0.18, 0]}>
      {sheets.map((s, i) => (
        <mesh key={i} position={[s.dx, s.y, s.dz]} rotation={[0, s.rot, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.21, 0.0014, 0.297]} />
          <meshStandardMaterial color={i % 3 === 0 ? '#f3f1ea' : '#faf8f2'} roughness={0.9} />
        </mesh>
      ))}
      {/* printed first page on top */}
      <mesh position={[top.dx, top.y + 0.0008, top.dz]} rotation={[-Math.PI / 2, 0, -top.rot]}>
        <planeGeometry args={[0.205, 0.29]} />
        <meshStandardMaterial map={page} roughness={0.9} />
      </mesh>
      {/* black binder clip on the top edge */}
      <group position={[top.dx, top.y + 0.006, top.dz - 0.14]} rotation={[0, top.rot, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.045, 0.012, 0.025]} />
          <meshStandardMaterial color="#141416" roughness={0.4} metalness={0.3} />
        </mesh>
        {[-0.016, 0.016].map((x) => (
          <mesh key={x} position={[x, 0.02, -0.012]} rotation={[0.9, 0, 0]}>
            <torusGeometry args={[0.012, 0.0015, 6, 16, Math.PI]} />
            <meshStandardMaterial color="#c9ccd1" metalness={1} roughness={0.25} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ---------- my real desk setup ---------- */

/** Aluminium laptop stand with the MacBook open on it (tilted toward you). */
export function LaptopOnStand() {
  const alu = <meshStandardMaterial color="#c4c8cd" metalness={0.85} roughness={0.3} />
  const tilt = 0.32
  return (
    <group>
      {/* base, two angled struts, tilted platform with a front lip */}
      <RoundedBox args={[0.22, 0.006, 0.2]} radius={0.003} position={[0, 0.003, 0]} castShadow>
        {alu}
      </RoundedBox>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.09, 0.06, -0.06]} rotation={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[0.012, 0.13, 0.02]} />
          {alu}
        </mesh>
      ))}
      <group position={[0, 0.085, 0]} rotation={[tilt, 0, 0]}>
        <RoundedBox args={[0.25, 0.006, 0.26]} radius={0.003} castShadow receiveShadow>
          {alu}
        </RoundedBox>
        <mesh position={[0, 0.012, 0.125]}>
          <boxGeometry args={[0.24, 0.018, 0.008]} />
          {alu}
        </mesh>
        <group position={[0, 0.0095, -0.005]}>
          <Laptop />
        </group>
      </group>
    </group>
  )
}

/** 27" external monitor on a stand; its screen is the main way into my computer. */
export function Monitor() {
  const screen = useMemo(() => monitorTexture(), [])
  const { w, h } = SCREEN_SIZE.monitor
  const black = <meshStandardMaterial color="#141416" roughness={0.4} metalness={0.3} />
  return (
    <group>
      <RoundedBox args={[0.26, 0.012, 0.19]} radius={0.005} position={[0, 0.006, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#c4c8cd" metalness={0.85} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0.135, -0.05]} rotation={[-0.08, 0, 0]} castShadow>
        <boxGeometry args={[0.06, 0.26, 0.02]} />
        <meshStandardMaterial color="#c4c8cd" metalness={0.85} roughness={0.3} />
      </mesh>
      <group position={[0, 0.36, -0.035]} rotation={[-0.06, 0, 0]}>
        <RoundedBox args={[w + 0.018, h + 0.02, 0.022]} radius={0.006} castShadow>
          {black}
        </RoundedBox>
        {/* back housing */}
        <RoundedBox args={[w * 0.7, h * 0.6, 0.03]} radius={0.01} position={[0, -0.01, -0.02]} castShadow>
          {black}
        </RoundedBox>
        <mesh
          name="nobake_screen_monitor"
          position={[0, 0, 0.0115]}
          ref={(m) => {
            screens.monitor = m
          }}
        >
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Low-profile Bluetooth keyboard (aluminium body, white keys). */
export function Keyboard() {
  const keys = useMemo(() => keyboardTexture(), [])
  return (
    <group rotation={[0.04, 0, 0]}>
      <RoundedBox args={[0.42, 0.011, 0.125]} radius={0.004} position={[0, 0.0055, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#c4c8cd" metalness={0.8} roughness={0.32} />
      </RoundedBox>
      <mesh position={[0, 0.0112, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.4, 0.11]} />
        <meshStandardMaterial map={keys} roughness={0.55} />
      </mesh>
    </group>
  )
}

/** Mousepad with a stitched edge, and the mouse on it. */
export function MouseAndPad() {
  return (
    <group>
      <RoundedBox args={[0.32, 0.003, 0.26]} radius={0.0015} position={[0, 0.0015, 0]} receiveShadow>
        <meshStandardMaterial color="#2b2d31" roughness={0.95} />
      </RoundedBox>
      <mesh position={[0.02, 0.008, 0.03]} rotation={[0, 0.25, 0]} scale={[0.6, 0.22, 1]} castShadow>
        <sphereGeometry args={[0.055, 32, 20]} />
        <meshStandardMaterial color="#f4f4f2" roughness={0.3} />
      </mesh>
    </group>
  )
}

/** Corkboard on the wall: wooden frame + a live-drawn cork face (click it to zoom in). */
export function Corkboard() {
  const face = useMemo(() => liveCorkboard(), [])
  const frame = <meshStandardMaterial map={oak()} roughness={0.6} />
  const { w, h } = CORK
  const t = 0.035
  return (
    <group>
      {[
        [0, h / 2 + t / 2, w + 2 * t, t],
        [0, -h / 2 - t / 2, w + 2 * t, t],
        [-w / 2 - t / 2, 0, t, h],
        [w / 2 + t / 2, 0, t, h],
      ].map(([x, y, sx, sy], i) => (
        <mesh key={i} position={[x, y, 0.02]} castShadow>
          <boxGeometry args={[sx, sy, 0.03]} />
          {frame}
        </mesh>
      ))}
      <mesh position={[0, 0, 0.008]}>
        <boxGeometry args={[w, h, 0.012]} />
        <meshStandardMaterial color="#9c7046" roughness={1} />
      </mesh>
      <mesh
        name="nobake_cork"
        position={[0, 0, 0.0145]}
        ref={(m) => {
          focusTargets.cork.mesh = m
        }}
      >
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={face} roughness={0.95} />
      </mesh>
    </group>
  )
}
