import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { useCursor, useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { liveCorkboard, livePoster, onLiveTextureChange } from './liveTextures'
import { focusTargets, type ScreenId, screens } from './screenPortal'
import { codeEditorTexture, monitorTexture, outsideTexture } from './textures'

/**
 * The room with lighting baked in Blender (see /blender/bake_room.py).
 *
 * Every surface is drawn as   base texture × baked lightmap   with no realtime lights, shadows or
 * ambient occlusion — Cycles already computed sunlight, bounce light and soft shadows offline.
 * Day/night is just a swap of the lightmap texture.
 */

const BASE = import.meta.env.BASE_URL
export const BAKED_GLB = `${BASE}room/room_baked.glb`
const LIGHTMAP_DAY = `${BASE}room/lightmap_day.webp`
const LIGHTMAP_NIGHT = `${BASE}room/lightmap_night.webp`
const LIGHTMAP_COZY = `${BASE}room/lightmap_cozy.webp`

// On-screen brightness of the baked light, like a camera's exposure for the interior.
// Lightmaps are stored normalized (1.0 ≈ the brightest interior light), so these are relative gains.
const EXPOSURE = { day: 1.6, night: 1.25, cozy: 0.72 }

// Light-emitting things glow at night (values > 1 feed the bloom pass).
const HOT: Record<string, THREE.Color> = {
  emit_parol: new THREE.Color(3.2, 1.7, 0.5),
  emit_bulb: new THREE.Color(6, 4.2, 2.2),
  emit_ceiling: new THREE.Color(2.4, 2.05, 1.6),
}
const SKY_DAY = new THREE.Color(1.7, 1.7, 1.7)
const SKY_NIGHT = new THREE.Color(1, 1, 1)

export type ClickSpec = { id: string; label: string; labelY: number; hint?: boolean; onClick: () => void }

type Props = {
  night: boolean
  /** night with just the desk lamp, laptop and window */
  cozy: boolean
  rainy: boolean
  playing: boolean
  clickables: ClickSpec[]
  /** Seen from outside (welcome page): hide the street backdrop that would float behind the room. */
  cutaway: boolean
}

/** Name of the nearest clk_* ancestor, i.e. which interactive object was hit. */
function clickId(o: THREE.Object3D | null): string | null {
  for (; o; o = o.parent) if (o.name.startsWith('clk_')) return o.name.slice(4)
  return null
}
const tagged = (o: THREE.Object3D, prefix: string) => o.name.startsWith(prefix) || !!o.parent?.name.startsWith(prefix)

export default function BakedScene({ night, cozy, rainy, playing, clickables, cutaway }: Props) {
  const invalidate = useThree((s) => s.invalidate)
  const gltf = useGLTF(BAKED_GLB)
  const [dayMap, nightMap, cozyMap] = useLoader(THREE.TextureLoader, [LIGHTMAP_DAY, LIGHTMAP_NIGHT, LIGHTMAP_COZY])

  // One-time material conversion: original texture/colour + baked lightmap (2nd UV set).
  const scene = useMemo(() => {
    for (const t of [dayMap, nightMap, cozyMap]) {
      t.flipY = false // glTF UV convention
      t.colorSpace = THREE.SRGBColorSpace
      t.channel = 1 // TEXCOORD_1 = lightmap UVs
      // Mipmaps + anisotropic filtering: without them, small far-away surfaces (books, window grid)
      // pick lightmap texels almost at random and sparkle as the view moves. The bake leaves wide
      // padding around each atlas island, so the smaller mip levels don't bleed between islands.
      t.generateMipmaps = true
      t.minFilter = THREE.LinearMipmapLinearFilter
      t.magFilter = THREE.LinearFilter
      t.anisotropy = 8
    }
    const baked: (THREE.MeshBasicMaterial | THREE.MeshStandardMaterial)[] = []
    const emitters: { key: string; mesh: THREE.Mesh; normal: THREE.Material; hot: THREE.Material }[] = []
    const screenMats: THREE.MeshBasicMaterial[] = []
    let outside: THREE.Mesh | null = null
    const nodes: Record<string, THREE.Object3D> = {}
    // Long, thin trim (baseboards/crown) along the front and right walls: hidden in the cutaway view,
    // where those walls are invisible and the trim would float.
    const cutawayTrim: THREE.Mesh[] = []
    const box = new THREE.Box3()
    const dims = new THREE.Vector3()

    gltf.scene.traverse((o) => {
      if (o.name) nodes[o.name] = o
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as THREE.MeshStandardMaterial
      box.setFromObject(mesh).getSize(dims)
      const alongX = dims.x > 5 && dims.z < 0.08 && box.min.z > 2.9
      const alongZ = dims.z > 5 && dims.x < 0.08 && box.min.x > 2.9
      // …and things standing against the front wall (wardrobe, door, clock) whose backs would face the camera
      const againstFrontWall = (box.min.z + box.max.z) / 2 > 2.35
      if (alongX || alongZ || againstFrontWall) cutawayTrim.push(mesh)
      if (tagged(mesh, 'nobake_outside')) {
        outside = mesh
        return
      }
      // Screens, posters and the corkboard: textures are drawn/loaded at runtime (they aren't in the GLB).
      if (mesh.name.startsWith('nobake_screen_')) {
        const id = mesh.name.slice('nobake_screen_'.length) as ScreenId
        const m = new THREE.MeshBasicMaterial({ map: id === 'monitor' ? monitorTexture() : codeEditorTexture(), toneMapped: false })
        screenMats.push(m)
        mesh.material = m
        screens[id] = mesh
        return
      }
      // Posters and the corkboard face are baked like everything else (they get the room's light and
      // shadows); only their picture is live, drawn/loaded in the browser instead of stored in the GLB.
      const poster = /^live_poster_(\d+)/.exec(mesh.name)
      const liveMap = poster ? livePoster(Number(poster[1])) : mesh.name === 'live_cork' ? liveCorkboard() : null
      if (mesh.name === 'live_cork') focusTargets.cork.mesh = mesh
      // The office chair's woven mesh is a cut-out texture: see-through gaps, solid threads.
      const cutout = src.alphaTest > 0 || src.name.startsWith('hd_mesh')
      const common = {
        map: liveMap ?? src.map,
        color: liveMap ? new THREE.Color(1, 1, 1) : src.color,
        // Draw everything opaque (cut-outs use alpha testing instead). Overlapping translucent layers
        // — the two capiz sashes — can't be depth-sorted reliably and flicker as the camera moves.
        transparent: false,
        opacity: 1,
        side: cutout ? THREE.DoubleSide : src.side,
        alphaTest: cutout ? Math.max(src.alphaTest, 0.5) : 0,
        lightMap: dayMap,
      }
      // The mason jar's glass: see-through, with sharp environment reflections.
      if (src.name.startsWith('glass')) {
        const g = new THREE.MeshStandardMaterial({
          color: src.color,
          transparent: true,
          opacity: Math.min(src.opacity, 0.3),
          roughness: 0.05,
          metalness: 0,
          envMapIntensity: 1.3,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
        // no lightmap: glass has no diffuse surface to bake light onto — it's lit by reflections only
        mesh.material = g
        mesh.renderOrder = 5
        return
      }
      // Polished things (floor, lacquered desk, metal) keep cheap environment reflections.
      const glossy = src.roughness <= 0.5 || src.metalness >= 0.5
      const m = glossy
        ? new THREE.MeshStandardMaterial({ ...common, roughness: src.roughness, metalness: src.metalness, envMapIntensity: 0.45 })
        : new THREE.MeshBasicMaterial(common)
      baked.push(m)
      mesh.material = m
      const hotKey = Object.keys(HOT).find((k) => tagged(mesh, k))
      if (hotKey) emitters.push({ key: hotKey, mesh, normal: m, hot: new THREE.MeshBasicMaterial({ color: HOT[hotKey], toneMapped: false }) })
    })
    focusTargets.certs.mesh = nodes.clk_credentials ?? null
    return { baked, emitters, outside: outside as THREE.Mesh | null, nodes, cutawayTrim, screenMats }
  }, [gltf, dayMap, nightMap, cozyMap])

  // Day / night / rain: swap the lightmap, light up the emitters, change the view outside.
  const outsideTex = useMemo(() => outsideTexture(night, rainy), [night, rainy])
  useEffect(() => {
    const mode = !night ? 'day' : cozy ? 'cozy' : 'night'
    const map = mode === 'day' ? dayMap : mode === 'cozy' ? cozyMap : nightMap
    // ×π: three.js divides lightmap irradiance by π for Lambertian surfaces
    const k = (mode === 'day' ? EXPOSURE.day * (rainy ? 0.7 : 1) : EXPOSURE[mode]) * Math.PI
    for (const m of scene.baked) {
      m.lightMap = map
      m.lightMapIntensity = k
    }
    // cozy: only the desk lamp glows (ceiling light and parol are off)
    for (const e of scene.emitters) e.mesh.material = night && (!cozy || e.key === 'emit_bulb') ? e.hot : e.normal
    // hot coffee by day, iced coffee at night
    if (scene.nodes.cup_day) scene.nodes.cup_day.visible = !night
    if (scene.nodes.cup_night) scene.nodes.cup_night.visible = night
    // the screens are light sources too — a touch brighter in the dark
    for (const m of scene.screenMats) m.color.setScalar(mode === 'cozy' ? 1.35 : 1)
    if (scene.outside) scene.outside.material = new THREE.MeshBasicMaterial({ map: outsideTex, color: night ? SKY_NIGHT : SKY_DAY, toneMapped: false })
    invalidate()
  }, [night, cozy, rainy, scene, dayMap, nightMap, cozyMap, outsideTex, invalidate])


  // Pre-warm the GPU: upload every texture (all three lightmaps included) and compile every shader
  // up front. Otherwise each is uploaded the first time it comes into view, and the first turn
  // toward a new part of the room, or the first day/night switch, stutters.
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    const seen = new Set<THREE.Texture>()
    const add = (t: THREE.Texture | null | undefined) => {
      if (t && !seen.has(t)) {
        seen.add(t)
        gl.initTexture(t)
      }
    }
    for (const t of [dayMap, nightMap, cozyMap]) add(t)
    gltf.scene.traverse((o) => {
      const mats = (o as THREE.Mesh).material
      for (const mat of Array.isArray(mats) ? mats : mats ? [mats] : []) {
        const mm = mat as THREE.MeshStandardMaterial
        add(mm.map)
        add(mm.lightMap)
      }
    })
    // compile with everything visible (the hidden cup too) so no shader is left to build later
    const hidden: THREE.Object3D[] = []
    gltf.scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o)
        o.visible = true
      }
    })
    gl.compileAsync(gltf.scene, camera)
      .catch(() => {})
      .finally(() => {
        hidden.forEach((o) => (o.visible = false))
        invalidate()
      })
  }, [gl, camera, gltf, dayMap, nightMap, cozyMap, invalidate])

  // posters / corkboard photos arrive after load: redraw once they do
  useEffect(() => onLiveTextureChange(invalidate), [invalidate])

  // ---- interaction: one handler on the whole room, resolved to the clk_* object that was hit ----
  const [hover, setHover] = useState<string | null>(null)
  useCursor(!!hover)
  useEffect(() => {
    if (scene.outside) scene.outside.visible = !cutaway
    for (const m of scene.cutawayTrim) m.visible = !cutaway
    if (cutaway) setHover(null)
    invalidate()
  }, [cutaway, scene, invalidate])
  const byId = useMemo(() => Object.fromEntries(clickables.map((c) => [c.id, c])), [clickables])

  // ---- animated parts ----
  useFrame((st, dt) => {
    const n = scene.nodes
    if (playing && n.anim_record_disc) {
      n.anim_record_disc.rotation.y -= dt * 3.5
      st.invalidate()
    }
  })
  useEffect(() => {
    const tick = () => {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date())
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
      const m = get('minute')
      const h = get('hour') % 12
      if (scene.nodes.anim_clock_minute) scene.nodes.anim_clock_minute.rotation.z = -(m / 60) * Math.PI * 2
      if (scene.nodes.anim_clock_hour) scene.nodes.anim_clock_hour.rotation.z = -((h + m / 60) / 12) * Math.PI * 2
      invalidate()
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [scene, invalidate])

  return (
    <>
      <primitive
        object={gltf.scene}
        onPointerMove={(e: { object: THREE.Object3D; stopPropagation: () => void }) => {
          e.stopPropagation()
          const id = clickId(e.object)
          if (id !== hover) setHover(id && byId[id] ? id : null)
        }}
        onPointerOut={() => setHover(null)}
        onClick={(e: { object: THREE.Object3D; stopPropagation: () => void }) => {
          const id = clickId(e.object)
          if (!id || !byId[id]) return
          e.stopPropagation()
          setHover(null)
          byId[id].onClick()
        }}
      />
      {clickables.map((c) => (
        <HoverLabel key={c.id} node={scene.nodes[`clk_${c.id}`]} text={c.label} labelY={c.labelY} hovered={hover === c.id} hint={!!c.hint} />
      ))}
    </>
  )
}

/** Floating DOM label + gentle hover "lift" for an interactive object (same look as the realtime room). */
function HoverLabel({ node, text, labelY, hovered, hint }: { node?: THREE.Object3D; text: string; labelY: number; hovered: boolean; hint: boolean }) {
  const el = useMemo(() => {
    const wrap = document.createElement('div')
    wrap.className = 'room-label-anchor'
    wrap.appendChild(document.createElement('div'))
    return wrap
  }, [])
  const anchor = useMemo(() => new THREE.Vector3(), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  useEffect(() => {
    document.getElementById('room-labels')?.appendChild(el)
    return () => el.remove()
  }, [el])
  useEffect(() => {
    const inner = el.firstChild as HTMLDivElement
    inner.textContent = text
    inner.className = `room-label${hovered || hint ? ' room-label--on' : ''}${hint && !hovered ? ' room-label--hint' : ''}`
  }, [el, text, hovered, hint])
  useFrame(({ camera, size, invalidate }, dt) => {
    if (!node) return
    const s = hovered ? 1.06 : 1
    node.scale.lerp(target.set(s, s, s), 1 - Math.exp(-dt * 14))
    if (Math.abs(node.scale.x - s) > 0.001) invalidate()
    if (!hovered && !hint) return
    anchor.set(0, labelY, 0)
    node.localToWorld(anchor).project(camera)
    el.style.transform = `translate(${(((anchor.x + 1) / 2) * size.width).toFixed(1)}px, ${(((1 - anchor.y) / 2) * size.height).toFixed(1)}px)`
    el.style.visibility = anchor.z < 1 ? 'visible' : 'hidden'
  })
  return null
}
