import { useMemo } from 'react'
import * as THREE from 'three'
import { SUN_POSITION, WINDOW_CENTER } from './layout'
import { WINDOW } from './props'

const LAYERS = 5

/**
 * Fake volumetric light: a static prism from the window opening down to the floor along the sun
 * direction, drawn additively with a fade. Looks like light through dusty air, costs one draw call
 * and no extra render passes.
 */
export default function SunShafts({ strength }: { strength: number }) {
  const geometry = useMemo(() => {
    const d = new THREE.Vector3().copy(SUN_POSITION).negate() // light travels toward the origin
    const [x, cy, cz] = WINDOW_CENTER
    const ys = [cy - WINDOW.h / 2, cy + WINDOW.h / 2]
    const zs = [cz - WINDOW.w / 2, cz + WINDOW.w / 2]
    const win = [
      new THREE.Vector3(x, ys[0], zs[0]),
      new THREE.Vector3(x, ys[0], zs[1]),
      new THREE.Vector3(x, ys[1], zs[1]),
      new THREE.Vector3(x, ys[1], zs[0]),
    ]
    // where each corner's ray meets the floor
    const floor = win.map((p) => p.clone().addScaledVector(d, -p.y / d.y))
    const winC = win.reduce((c, p) => c.add(p), new THREE.Vector3()).multiplyScalar(0.25)
    const floorC = floor.reduce((c, p) => c.add(p), new THREE.Vector3()).multiplyScalar(0.25)
    const pos: number[] = []
    const t: number[] = []
    // Several nested beams, each a bit thinner: they add up brighter in the middle, so edges fade softly.
    for (let layer = 0; layer < LAYERS; layer++) {
      const k = 1 - layer * 0.13
      const w = win.map((p) => p.clone().sub(winC).multiplyScalar(k).add(winC))
      const f = floor.map((p) => p.clone().sub(floorC).multiplyScalar(k).add(floorC))
      for (let i = 0; i < 4; i++) {
        const a = w[i]
        const b = w[(i + 1) % 4]
        const c = f[(i + 1) % 4]
        const e = f[i]
        for (const [p, kk] of [
          [a, 0],
          [b, 0],
          [c, 1],
          [a, 0],
          [c, 1],
          [e, 1],
        ] as [THREE.Vector3, number][]) {
          pos.push(p.x, p.y, p.z)
          t.push(kk)
        }
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1))
    g.computeVertexNormals()
    return g
  }, [])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uStrength: { value: 1 }, uColor: { value: new THREE.Color('#ffdcaa') } },
        vertexShader: /* glsl */ `
          attribute float aT;
          varying float vT;
          varying float vFacing;
          void main() {
            vT = aT;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec3 n = normalize(normalMatrix * normal);
            vFacing = abs(dot(n, normalize(-mv.xyz)));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uStrength;
          uniform vec3 uColor;
          varying float vT;
          varying float vFacing;
          void main() {
            float along = pow(1.0 - vT, 1.6) * smoothstep(0.0, 0.08, vT + 0.02);
            float edge = smoothstep(0.15, 0.9, vFacing);
            gl_FragColor = vec4(uColor * along * edge * 0.022 * uStrength, 1.0);
          }`,
      }),
    [],
  )
  material.uniforms.uStrength.value = strength
  if (strength <= 0) return null
  return <mesh name="exclude_shafts" geometry={geometry} material={material} renderOrder={10} />
}
