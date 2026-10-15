import { useMemo } from 'react'
import * as THREE from 'three'
import { WINDOW_CENTER } from './layout'
import { WOOD_DARK, WINDOW } from './props'
import { floorTexture, normalMapFor, outsideTexture, plasterTexture } from './textures'

// Interior is x,z ∈ [-3, 3], y ∈ [0, 3]. Walls are 0.2 thick, just outside that box.
const H = 3
const T = 0.2
// >1 so the bloom pass makes daylight through the window glow
const SKY_DAY = new THREE.Color(1.7, 1.7, 1.7)
const SKY_NIGHT = new THREE.Color(1, 1, 1)

/** Floor, four walls (left one with a real window opening), ceiling, and the street outside. */
export default function Shell({ night, rainy, cutaway = false }: { night: boolean; rainy: boolean; cutaway?: boolean }) {
  const floor = useMemo(() => floorTexture(), [])
  const floorNormal = useMemo(() => normalMapFor(floor, 1.5), [floor])
  const plasterA = useMemo(() => plasterTexture('#efe3cf'), [])
  const plasterB = useMemo(() => plasterTexture('#e7d6bb'), [])
  const plasterNormal = useMemo(() => normalMapFor(plasterA, 2.5), [plasterA])
  const ceiling = useMemo(() => plasterTexture('#f6f1e8'), [])
  const outside = useMemo(() => outsideTexture(night, rainy), [night, rainy])

  // Hole in the left wall (z along the wall, y up)
  const z0 = WINDOW_CENTER[2] - WINDOW.w / 2
  const z1 = WINDOW_CENTER[2] + WINDOW.w / 2
  const y0 = WINDOW_CENTER[1] - WINDOW.h / 2
  const y1 = WINDOW_CENTER[1] + WINDOW.h / 2
  const wallMat = (m: THREE.Texture) => <meshStandardMaterial map={m} normalMap={plasterNormal} normalScale={[0.25, 0.25]} roughness={0.95} />

  return (
    <group>
      {/* floor */}
      <mesh receiveShadow position={[0, -0.1, 0]}>
        <boxGeometry args={[6.4, 0.2, 6.4]} />
        {/* lightly polished: picks up soft reflections from the window */}
        <meshStandardMaterial map={floor} normalMap={floorNormal} normalScale={[0.5, 0.5]} roughness={0.42} metalness={0.02} />
      </mesh>

      {/* left wall: one continuous slab with the window cut out (no seams between pieces) */}
      <WindowWall plaster={plasterB} normal={plasterNormal} hole={[z0, z1, y0, y1]} />

      {/* back, right, front walls */}
      <mesh castShadow receiveShadow position={[0, H / 2, -3 - T / 2]}>
        <boxGeometry args={[6 + 2 * T, H, T]} />
        {wallMat(plasterA)}
      </mesh>
      {/* right wall, front wall, ceiling and the street are hidden in the welcome page's cutaway view */}
      <mesh castShadow receiveShadow position={[3 + T / 2, H / 2, 0]} visible={!cutaway}>
        <boxGeometry args={[T, H, 6 + 2 * T]} />
        {wallMat(plasterB)}
      </mesh>
      <mesh castShadow receiveShadow position={[0, H / 2, 3 + T / 2]} visible={!cutaway}>
        <boxGeometry args={[6 + 2 * T, H, T]} />
        {wallMat(plasterA)}
      </mesh>

      {/* ceiling — casts shadows so daylight only comes in through the window */}
      <mesh castShadow receiveShadow position={[0, H + T / 2, 0]} visible={!cutaway}>
        <boxGeometry args={[6 + 2 * T, T, 6 + 2 * T]} />
        <meshStandardMaterial map={ceiling} roughness={1} />
      </mesh>

      {/* baseboards & crown trim */}
      {(
        [
          [[-2.985, 0.07, 0], [0.03, 0.14, 6]],
          [[2.985, 0.07, 0], [0.03, 0.14, 6]],
          [[0, 0.07, -2.985], [6, 0.14, 0.03]],
          [[0, 0.07, 2.985], [6, 0.14, 0.03]],
          [[-2.985, H - 0.04, 0], [0.03, 0.08, 6]],
          [[2.985, H - 0.04, 0], [0.03, 0.08, 6]],
          [[0, H - 0.04, -2.985], [6, 0.08, 0.03]],
          [[0, H - 0.04, 2.985], [6, 0.08, 0.03]],
        ] as [[number, number, number], [number, number, number]][]
      ).map(([p, s], i) => (
        // trim on the right (x=+3) and front (z=+3) walls hides with those walls in the cutaway view
        <mesh key={i} position={p} visible={!(cutaway && (p[0] > 2.9 || p[2] > 2.9))}>
          <boxGeometry args={s} />
          <meshStandardMaterial color={i < 4 ? WOOD_DARK : '#f3ece0'} />
        </mesh>
      ))}

      {/* the street outside the window */}
      <mesh visible={!cutaway} name="nobake_outside" position={[-5.2, WINDOW_CENTER[1] + 0.2, WINDOW_CENTER[2]]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7, 3.5]} />
        <meshBasicMaterial map={outside} color={night ? SKY_NIGHT : SKY_DAY} toneMapped={false} />
      </mesh>

    </group>
  )
}

/**
 * The window wall as a single extruded slab with a rectangular hole, so the plaster and the baked
 * light run continuously across it. UVs are in metres; the texture repeat is set to match the
 * other walls' plaster scale.
 */
function WindowWall({ plaster, normal, hole }: { plaster: THREE.Texture; normal: THREE.Texture; hole: [number, number, number, number] }) {
  const { geometry, map, nmap } = useMemo(() => {
    const [z0, z1, y0, y1] = hole
    // shape x = world z, shape y = height
    const shape = new THREE.Shape()
    shape.moveTo(-3, 0)
    shape.lineTo(3, 0)
    shape.lineTo(3, H)
    shape.lineTo(-3, H)
    shape.closePath()
    const opening = new THREE.Path()
    opening.moveTo(z0, y0)
    opening.lineTo(z0, y1)
    opening.lineTo(z1, y1)
    opening.lineTo(z1, y0)
    opening.closePath()
    shape.holes.push(opening)
    const g = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
    // the other walls show one plaster tile per ~2.13 m × 1.5 m
    const scale = (t: THREE.Texture) => {
      const c = t.clone()
      c.wrapS = c.wrapT = THREE.RepeatWrapping
      c.repeat.set(1 / 2.13, 1 / 1.5)
      c.needsUpdate = true
      return c
    }
    return { geometry: g, map: scale(plaster), nmap: scale(normal) }
  }, [plaster, normal, hole])
  // rotate so shape x runs along world z and the extrusion goes outward (−x)
  return (
    <mesh geometry={geometry} position={[-3, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow>
      <meshStandardMaterial map={map} normalMap={nmap} normalScale={[0.25, 0.25]} roughness={0.95} />
    </mesh>
  )
}
