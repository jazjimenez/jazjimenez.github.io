import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

/**
 * Dev-only: export the live room scene as a GLB and save it to /blender/room_source.glb via the
 * dev server, so Blender can bake lighting for exactly the geometry the site renders.
 * Run from the browser console: await __room.exportScene()
 */
export async function exportRoomScene(scene: THREE.Scene) {
  if (scene.getObjectByName('nobake_outside')?.visible === false) return 'Enter the room first (the welcome view hides some walls).'
  const hidden: THREE.Object3D[] = []
  const scaled: [THREE.Object3D, THREE.Vector3][] = []
  // screens, posters and the corkboard get their pictures at runtime: don't ship them in the GLB
  const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = []
  const plain = new THREE.MeshStandardMaterial({ color: '#808080', roughness: 0.6 })
  scene.traverse((o) => {
    // lights are set up in Blender; the sunbeam overlay stays a realtime effect
    if ((o as THREE.Light).isLight || o.name.startsWith('exclude_')) {
      if (o.visible) hidden.push(o)
      o.visible = false
    }
    // both cups (day mug + night jar) go to Blender; the site shows one at a time
    if (o.name.startsWith('cup_')) {
      o.traverseAncestors((p) => {
        if (!p.visible) {
          hidden.push(p) // restored below (set back to hidden)
          p.visible = true
        }
      })
    }
    if ((o as THREE.Mesh).isMesh && /^nobake_(screen_|poster_|cork)/.test(o.name)) {
      const m = o as THREE.Mesh
      swapped.push([m, m.material])
      m.material = plain
    }
    if (o.name.startsWith('clk_') && !o.scale.equals(new THREE.Vector3(1, 1, 1))) {
      scaled.push([o, o.scale.clone()])
      o.scale.set(1, 1, 1)
    }
  })
  try {
    const glb = (await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 2048 })) as ArrayBuffer
    const res = await fetch('/__save?name=room_source.glb', { method: 'POST', body: glb })
    return `${res.status} ${await res.text()} (${(glb.byteLength / 1e6).toFixed(1)} MB)`
  } finally {
    hidden.forEach((o) => (o.visible = !o.visible))
    scaled.forEach(([o, s]) => o.scale.copy(s))
    swapped.forEach(([m, mat]) => (m.material = mat))
  }
}
