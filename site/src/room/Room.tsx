import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, useCursor } from '@react-three/drei'
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import FirstPersonRig, { type IntroMode, type LaptopMode } from './FirstPersonRig'
import { activeScreen, type FocusId, type ScreenId } from './screenPortal'
import { onLiveTextureChange } from './liveTextures'
import { SEAT_EYE, SUN_POSITION, WINDOW_CENTER } from './layout'
import {
  BaybayinScroll,
  Aparador,
  Bed,
  Bookshelf,
  CapizWindow,
  CeilingLight,
  Certificates,
  Desk,
  DeskLamp,
  Door,
  Jeepney,
  Corkboard,
  Keyboard,
  LaptopOnStand,
  Monitor,
  MonoblocChair,
  MouseAndPad,
  HotCoffeeMug,
  IcedCoffeeJar,
  Parol,
  Posters,
  RecordCabinet,
  RecordPlayer,
  GuitarStandIn,
  PaperStack,
  WallClock,
} from './props'
import BakedScene, { BAKED_GLB, type ClickSpec } from './BakedScene'
import Shell from './Shell'
import SunShafts from './SunShafts'
import { clockFaceTexture } from './textures'

export type RoomExtraKey = 'films' | 'music' | 'baybayin' | 'parol' | 'jeepney' | 'guitar' | 'papers'

type Props = {
  night: boolean
  /** Night with only the desk lamp, laptop and window lit (ceiling light and parol off). */
  cozy: boolean
  onLamp: () => void
  rainy: boolean
  /** Stop rendering while the desktop covers the room. */
  paused: boolean
  laptopMode: LaptopMode
  /** Welcome page (third-person view) → flying in → seated. */
  intro: IntroMode
  onArrived: () => void
  onEnteredLaptop: () => void
  onLeftLaptop: () => void
  onOpenLaptop: () => void
  /** Zoomed in on something from the chair (the corkboard), or null. */
  focus: FocusId | null
  onFocus: (f: FocusId | null) => void
  onOpenCredentials: () => void
  onToggleNight: () => void
  onExtra: (key: RoomExtraKey) => void
  /** Which of the three views you're looking at (0 left, 1 center, 2 right). */
  look: number
  onLookRequest: (dir: -1 | 1) => void
}

/**
 * Quality tiers, picked automatically from measured frame times:
 *   2 — ambient occlusion + bloom, up to 2× pixel density
 *   1 — bloom only, 1.25×
 *   0 — no post-processing, 1×
 */
type Tier = 0 | 1 | 2
const TIER_DPR: Record<Tier, number> = { 0: 1, 1: 1.25, 2: 2 }
const START_TIER: Tier = typeof window !== 'undefined' && window.innerWidth < 720 ? 1 : 2

/** Use the Blender-baked room when its files are deployed; otherwise the realtime-lit room. */
function useBakedAvailable() {
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => {
    // ?realtime forces the realtime-lit room (used when exporting the scene for a re-bake)
    if (new URLSearchParams(location.search).has('realtime')) return setOk(false)
    fetch(BAKED_GLB, { method: 'HEAD' })
      // dev servers answer missing files with index.html, so check it isn't HTML
      .then((r) => setOk(r.ok && !(r.headers.get('content-type') ?? '').includes('text/html')))
      .catch(() => setOk(false))
  }, [])
  return ok
}

export default function Room(props: Props) {
  const [tier, setTier] = useState<Tier>(START_TIER)
  const baked = useBakedAvailable()
  if (baked === null) return <div className="room" />
  return (
    <div className="room">
      <Canvas
        // baked lighting already contains the shadows
        shadows={baked ? false : 'variance'}
        dpr={Math.min(TIER_DPR[tier], window.devicePixelRatio || 1)}
        // Only draw when something changes: a still room costs ~nothing.
        frameloop={props.paused ? 'never' : 'demand'}
        camera={{ fov: 62, position: SEAT_EYE.toArray(), near: 0.05, far: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance', stencil: false }}
      >
        {/* dark "showcase" backdrop behind the dollhouse on the welcome page */}
        <color attach="background" args={[props.intro !== 'done' ? '#1f1a24' : props.night ? '#0d0b14' : '#d9cbb5']} />
        {baked ? <BakedRoomScene {...props} /> : <Scene {...props} />}
        {!baked && <StaticShadows deps={[props.night, props.rainy]} />}
        <QualityGovernor tier={tier} onChange={setTier} />
        {/* ambient occlusion is baked in, so the baked room only needs bloom */}
        {tier > 0 && <Effects night={props.night} ao={!baked && tier === 2} />}
      </Canvas>
      <div className="room-labels" id="room-labels" />
    </div>
  )
}

const NO_CLICKS: ClickSpec[] = []

/** Open the desktop on the screen you clicked (the monitor or the MacBook). */
function openOn(p: Props, id: ScreenId) {
  activeScreen.id = id
  p.onOpenLaptop()
}

function lampLabel(p: Props) {
  if (!p.night) return 'Desk lamp — click for a cozy night'
  return p.cozy ? 'Turn the big light back on' : 'Just the desk lamp, please'
}

/** Baked room: same camera, sunbeams and interactions, but all lighting comes from the lightmaps. */
function BakedRoomScene(p: Props) {
  const [playing, setPlaying] = useState(false)
  const clickables: ClickSpec[] = [
    { id: 'monitor', label: 'Open my computer', labelY: 0.7, hint: p.laptopMode === 'seat' && p.intro === 'done' && !p.focus, onClick: () => openOn(p, 'monitor') },
    { id: 'laptop', label: 'My MacBook', labelY: 0.36, onClick: () => openOn(p, 'laptop') },
    { id: 'cork', label: 'Corkboard — take a closer look', labelY: 0.45, onClick: () => p.onFocus('cork') },
    { id: 'jeepney', label: 'Jeepney', labelY: 0.3, onClick: () => p.onExtra('jeepney') },
    { id: 'credentials', label: 'Credentials', labelY: 0.4, onClick: p.onOpenCredentials },
    { id: 'parol', label: p.night ? 'Parol — turn the day back on' : 'Parol — make it night', labelY: -0.75, onClick: p.onToggleNight },
    { id: 'baybayin', label: 'Baybayin scroll', labelY: 0.7, onClick: () => p.onExtra('baybayin') },
    { id: 'lamp', label: lampLabel(p), labelY: 0.82, onClick: p.onLamp },
    { id: 'papers', label: 'My papers', labelY: 0.12, onClick: () => p.onExtra('papers') },
    { id: 'guitar', label: 'Guitar', labelY: 1.15, onClick: () => p.onExtra('guitar') },
    { id: 'films', label: 'My top 4 films', labelY: 0.42, onClick: () => p.onExtra('films') },
    {
      id: 'record',
      label: 'Record player',
      labelY: 0.35,
      onClick: () => {
        setPlaying((x) => !x)
        p.onExtra('music')
      },
    },
  ]
  return (
    <>
      <FirstPersonRig mode={p.laptopMode} onEntered={p.onEnteredLaptop} onLeft={p.onLeftLaptop} look={p.look} onLookRequest={p.onLookRequest} intro={p.intro} onArrived={p.onArrived} focus={p.focus} />
      <EnvironmentLight night={p.night} />
      <SunShafts strength={p.night ? 0 : p.rainy ? 0.3 : 1} />
      <BakedScene night={p.night} cozy={p.cozy} rainy={p.rainy} playing={playing} clickables={p.intro === 'done' ? clickables : NO_CLICKS} cutaway={p.intro !== 'done'} />
    </>
  )
}

function Scene(p: Props) {
  const clockFace = useMemo(() => clockFaceTexture(), [])
  const invalidate = useThree((s) => s.invalidate)
  // posters / corkboard photos arrive after load: redraw once they do
  useEffect(() => onLiveTextureChange(invalidate), [invalidate])
  const [playing, setPlaying] = useState(false)
  return (
    <>
      <Lights night={p.night} rainy={p.rainy} />
      <FirstPersonRig mode={p.laptopMode} onEntered={p.onEnteredLaptop} onLeft={p.onLeftLaptop} look={p.look} onLookRequest={p.onLookRequest} intro={p.intro} onArrived={p.onArrived} focus={p.focus} />

      <Shell night={p.night} rainy={p.rainy} cutaway={p.intro !== 'done'} />
      <SunShafts strength={p.night ? 0 : p.rainy ? 0.3 : 1} />
      <CeilingLight on={p.night && !p.cozy} />

      {/* the desk in front of you */}
      <Desk />
      {/* my actual setup: monitor in the middle, the MacBook on a stand, keyboard, mouse */}
      <Clickable id="monitor" position={[0.08, 0.75, -2.8]} label="Open my computer" onClick={() => openOn(p, 'monitor')} hint={p.laptopMode === 'seat' && p.intro === 'done' && !p.focus} labelY={0.7}>
        <Monitor />
      </Clickable>
      <Clickable id="laptop" position={[-0.52, 0.75, -2.64]} label="My MacBook" onClick={() => openOn(p, 'laptop')} labelY={0.36}>
        <group rotation={[0, 0.5, 0]}>
          <LaptopOnStand />
        </group>
      </Clickable>
      <group position={[0.08, 0.75, -2.36]}>
        <Keyboard />
      </group>
      <group position={[0.54, 0.75, -2.38]}>
        <MouseAndPad />
      </group>
      <Clickable id="lamp" position={[-0.88, 0.75, -2.84]} label={lampLabel(p)} onClick={p.onLamp} labelY={0.82}>
        {/* turned so the shade hangs over the papers */}
        <group rotation={[0, -0.85, 0]}>
          <DeskLamp night={p.night} />
        </group>
      </Clickable>
      <Clickable id="cork" position={[-1.45, 1.85, -2.98]} label="Corkboard — take a closer look" onClick={() => p.onFocus('cork')} labelY={0.45}>
        <Corkboard />
      </Clickable>
      {/* hot coffee by day, iced coffee at night */}
      <group visible={!p.night}>
        <HotCoffeeMug />
      </group>
      <group visible={p.night}>
        <IcedCoffeeJar />
      </group>
      {/* right in the desk lamp's pool of light */}
      <Clickable id="papers" position={[-0.8, 0.75, -2.36]} label="My papers" onClick={() => p.onExtra('papers')} labelY={0.12}>
        <PaperStack />
      </Clickable>
      <MonoblocChair />
      <Clickable id="jeepney" position={[0.72, 0.75, -2.86]} label="Jeepney" onClick={() => p.onExtra('jeepney')} labelY={0.3}>
        <Jeepney />
      </Clickable>
      <Clickable id="credentials" position={[-0.3, 2.2, -2.98]} label="Credentials" onClick={p.onOpenCredentials} labelY={0.4}>
        <Certificates />
      </Clickable>

      {/* to your left: the window wall */}
      {/* decoration only — not clickable */}
      <group position={[WINDOW_CENTER[0] + 0.02, WINDOW_CENTER[1], WINDOW_CENTER[2]]}>
        <CapizWindow night={p.night} rainy={p.rainy} />
      </group>
      <Clickable id="parol" position={[-2.2, 2.4, -1.9]} label={p.night ? 'Parol — turn the day back on' : 'Parol — make it night'} onClick={p.onToggleNight} labelY={-0.75}>
        <Parol lit={p.night && !p.cozy} />
      </Clickable>
      <Clickable id="baybayin" position={[-2.98, 1.75, 1.4]} label="Baybayin scroll" onClick={() => p.onExtra('baybayin')} labelY={0.7}>
        <BaybayinScroll />
      </Clickable>

      {/* to your right: music, films, bed */}
      <Clickable id="films" position={[2.0, 2.0, -2.98]} label="My top 4 films" onClick={() => p.onExtra('films')} labelY={0.42}>
        <Posters />
      </Clickable>
      <RecordCabinet />
      <Clickable id="record" position={[2.0, 0.66, -2.65]} label="Record player" onClick={() => {
          setPlaying((x) => !x)
          p.onExtra('music')
        }}
        labelY={0.35}
      >
        <RecordPlayer playing={playing} />
      </Clickable>
      <Bookshelf />
      <Clickable id="guitar" position={[1.6, 0, -0.05]} label="Guitar" onClick={() => p.onExtra('guitar')} labelY={1.15}>
        <GuitarStandIn />
      </Clickable>
      <Bed />

      {/* behind you (hidden in the welcome page's cutaway, where their backs would face the camera) */}
      <group visible={p.intro === 'done'}>
        <Door />
        <Aparador />
        <WallClock face={clockFace} />
      </group>
    </>
  )
}

function Lights({ night, rainy }: { night: boolean; rainy: boolean }) {
  const sun = night ? '#6f80c8' : rainy ? '#dfe4ea' : '#ffd9a0'
  return (
    <>
      <ambientLight intensity={night ? 0.06 : 0.18} color={night ? '#7f86c0' : '#fff1dc'} />
      {/* Sun (or moon) — the only way in is through the window, so it paints a window-shaped patch */}
      <directionalLight
        castShadow
        position={SUN_POSITION.toArray()}
        intensity={night ? 0.5 : rainy ? 1.6 : 4.2}
        color={sun}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={1}
        shadow-camera-far={25}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={6}
        shadow-blurSamples={12}
      />
      {/* Soft skylight bouncing in from the window */}
      <pointLight position={[-2.4, 1.9, -0.6]} intensity={night ? 0.6 : rainy ? 2.5 : 4} distance={7} decay={1.4} color={night ? '#5a6ab0' : '#fff2dc'} />
      <EnvironmentLight night={night} />
    </>
  )
}

/** Image-based lighting built from simple light cards — no downloads. Rendered once. */
function EnvironmentLight({ night }: { night: boolean }) {
  return (
    <>
      <Environment resolution={128} environmentIntensity={night ? 0.12 : 0.8}>
        <Lightformer form="rect" intensity={night ? 0.4 : 3} color={night ? '#5a6ab0' : '#fff4e0'} position={[-5, 2, -0.6]} rotation-y={Math.PI / 2} scale={[2, 1.4, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#f3e2c8" position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
        <Lightformer form="rect" intensity={0.35} color="#e8c9a0" position={[5, 1.5, 0]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} />
      </Environment>
    </>
  )
}

function Effects({ night, ao }: { night: boolean; ao: boolean }) {
  const bloom = <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={night ? 0.9 : 0.45} />
  const vignette = <Vignette offset={0.28} darkness={0.55} />
  const tone = <ToneMapping mode={ToneMappingMode.AGX} />
  // SMAA (post-process anti-aliasing) keeps thin edges — window grid, book spines, shelf edges —
  // smooth instead of jagged and crawling while you turn. (MSAA renders black with this pipeline.)
  const aa = <SMAA />
  // Two fixed composers: EffectComposer wants a stable list of effects.
  return ao ? (
    <EffectComposer multisampling={0}>
      <N8AO aoRadius={0.55} distanceFalloff={0.6} intensity={night ? 2 : 2.6} halfRes quality="medium" />
      {bloom}
      {vignette}
      {tone}
      {aa}
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0}>
      {bloom}
      {vignette}
      {tone}
      {aa}
    </EffectComposer>
  )
}

/**
 * The sun never moves, so render its shadow map once (and again on day/night or weather changes)
 * instead of every frame.
 */
function StaticShadows({ deps }: { deps: unknown[] }) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    const refresh = () => {
      gl.shadowMap.needsUpdate = true
      invalidate()
    }
    refresh()
    // late-arriving textures/fonts can change what's on screen; refresh once more shortly after
    const id = setTimeout(refresh, 800)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, invalidate, ...deps])
  return null
}

/**
 * Watches real frame times while something is animating and steps quality down if the device
 * struggles (under ~40 fps), or back up once if it's comfortably fast. Never flip-flops.
 */
function QualityGovernor({ tier, onChange }: { tier: Tier; onChange: (t: Tier) => void }) {
  const samples = useRef<number[]>([])
  const wentDown = useRef(false)
  useFrame((_, dt) => {
    if (dt > 0.25) return // idle gap between on-demand frames, not a slow frame
    const s = samples.current
    s.push(dt)
    if (s.length < 90) return
    const avg = s.reduce((a, b) => a + b, 0) / s.length
    samples.current = []
    if (avg > 1 / 40 && tier > 0) {
      wentDown.current = true
      onChange((tier - 1) as Tier)
    } else if (avg < 1 / 58 && tier < 2 && !wentDown.current) {
      onChange((tier + 1) as Tier)
    }
  })
  return null
}

/* ---------- interaction ---------- */

function Clickable({
  id,
  position,
  label,
  onClick,
  children,
  labelY = 0.5,
  hint = false,
}: {
  /** Stable name (clk_<id>) so the object survives the Blender round trip. */
  id: string
  position: [number, number, number]
  label: string
  onClick: () => void
  children: ReactNode
  labelY?: number
  hint?: boolean
}) {
  const ref = useRef<THREE.Group>(null!)
  const [hover, setHover] = useState(false)
  useCursor(hover)
  const target = useMemo(() => new THREE.Vector3(), [])
  const anchor = useMemo(() => new THREE.Vector3(), [])

  // Plain DOM label positioned over the canvas each frame (cheaper and steadier than a React portal per object).
  const el = useMemo(() => {
    const wrap = document.createElement('div')
    wrap.className = 'room-label-anchor'
    wrap.appendChild(document.createElement('div'))
    return wrap
  }, [])
  useEffect(() => {
    document.getElementById('room-labels')?.appendChild(el)
    return () => el.remove()
  }, [el])
  useEffect(() => {
    const inner = el.firstChild as HTMLDivElement
    inner.textContent = label
    inner.className = `room-label${hover || hint ? ' room-label--on' : ''}${hint && !hover ? ' room-label--hint' : ''}`
  }, [el, label, hover, hint])

  useFrame(({ camera, size, invalidate }, dt) => {
    const s = hover ? 1.06 : 1
    ref.current.scale.lerp(target.set(s, s, s), 1 - Math.exp(-dt * 14))
    if (Math.abs(ref.current.scale.x - s) > 0.001) invalidate()
    if (!hover && !hint) return
    anchor.set(0, labelY, 0)
    ref.current.localToWorld(anchor).project(camera)
    const x = ((anchor.x + 1) / 2) * size.width
    const y = ((1 - anchor.y) / 2) * size.height
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    el.style.visibility = anchor.z < 1 ? 'visible' : 'hidden'
  })

  return (
    <group
      ref={ref}
      name={`clk_${id}`}
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
      }}
      onPointerOut={() => setHover(false)}
      onClick={(e) => {
        e.stopPropagation()
        setHover(false)
        onClick()
      }}
    >
      {children}
    </group>
  )
}

