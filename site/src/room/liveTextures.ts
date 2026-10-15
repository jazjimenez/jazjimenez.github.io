import * as THREE from 'three'
import { corkboard, letterboxd } from '../data/content'
import { posterTexture } from './textures'

/**
 * Textures drawn or loaded in the browser at runtime (not baked): the film posters (official art
 * from TMDB) and the corkboard (drawn from content.ts). Editing their content never needs a re-bake.
 * Components subscribe to `onLiveTextureChange` to redraw when an image or font finishes loading.
 */

const listeners = new Set<() => void>()
export function onLiveTextureChange(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
const changed = () => listeners.forEach((fn) => fn())

const cache = new Map<string, THREE.Texture>()

/** Poster i of the Letterboxd top 4: typographic placeholder first, official poster once loaded. */
export function livePoster(i: number): THREE.Texture {
  const key = `poster-${i}`
  const hit = cache.get(key)
  if (hit) return hit
  const f = letterboxd.favorites[i]
  const tex: THREE.Texture = posterTexture(f.title, f.year, f.poster.top, f.poster.bottom, f.poster.accent, i + 1)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    tex.image = img
    tex.needsUpdate = true
    changed()
  }
  img.src = f.posterUrl
  cache.set(key, tex)
  return tex
}

// ---------------------------------------------------------------- corkboard

export const CORK = { w: 1.0, h: 0.7 } // metres
const PX = { w: 1600, h: 1120 }

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function wrap(g: CanvasRenderingContext2D, text: string, width: number) {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const w of para.split(' ')) {
      const test = line ? `${line} ${w}` : w
      if (g.measureText(test).width > width && line) {
        out.push(line)
        line = w
      } else line = test
    }
    out.push(line)
  }
  return out
}

function pin(g: CanvasRenderingContext2D, x: number, y: number, color: string) {
  g.save()
  g.fillStyle = 'rgba(0,0,0,.25)'
  g.beginPath()
  g.arc(x + 4, y + 6, 13, 0, Math.PI * 2)
  g.fill()
  const grad = g.createRadialGradient(x - 4, y - 4, 2, x, y, 14)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(0.25, color)
  grad.addColorStop(1, color)
  g.fillStyle = grad
  g.beginPath()
  g.arc(x, y, 13, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

/** A little illustrated "photo" for polaroids without a real picture yet. */
function placeholderPhoto(g: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const r = seeded(seed * 53 + 9)
  const sky = g.createLinearGradient(0, 0, 0, h)
  const palettes = [
    ['#ff9a5a', '#ffd38a', '#4a3a5a'],
    ['#7fb6e8', '#cfe8f7', '#2f5a3e'],
    ['#2b2550', '#c45a6a', '#1a1a2a'],
  ]
  const [a, b, land] = palettes[seed % palettes.length]
  sky.addColorStop(0, a)
  sky.addColorStop(1, b)
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(255,255,255,.75)'
  g.beginPath()
  g.arc(w * (0.25 + r() * 0.5), h * (0.25 + r() * 0.2), 22 + r() * 14, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = land
  g.beginPath()
  g.moveTo(0, h)
  for (let x = 0; x <= w; x += 20) g.lineTo(x, h * 0.62 + Math.sin(x / 40 + seed) * 18 + r() * 10)
  g.lineTo(w, h)
  g.fill()
}

let corkTex: THREE.CanvasTexture | null = null
const photoImages = new Map<string, HTMLImageElement>()

function drawCork(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!
  const r = seeded(17)
  // cork
  g.fillStyle = '#b98a5c'
  g.fillRect(0, 0, PX.w, PX.h)
  for (let i = 0; i < 26000; i++) {
    const v = r()
    g.fillStyle = v < 0.5 ? `rgba(90,55,25,${0.08 + r() * 0.18})` : `rgba(240,205,160,${0.06 + r() * 0.14})`
    const s = 1 + r() * 3.5
    g.fillRect(r() * PX.w, r() * PX.h, s, s)
  }

  const shadow = () => {
    g.shadowColor = 'rgba(0,0,0,.35)'
    g.shadowBlur = 18
    g.shadowOffsetX = 4
    g.shadowOffsetY = 8
  }
  const noShadow = () => {
    g.shadowColor = 'transparent'
    g.shadowBlur = 0
    g.shadowOffsetX = 0
    g.shadowOffsetY = 0
  }

  // polaroids
  const photoSpots: [number, number, number][] = [
    [80, 80, -4],
    [470, 470, 5],
    [1210, 430, -3],
  ]
  corkboard.photos.slice(0, photoSpots.length).forEach((p, i) => {
    const [x, y, rot] = photoSpots[i]
    g.save()
    g.translate(x + 150, y + 175)
    g.rotate((rot * Math.PI) / 180)
    shadow()
    g.fillStyle = '#fbfaf5'
    g.fillRect(-150, -175, 300, 350)
    noShadow()
    g.save()
    g.translate(-130, -155)
    const img = p.src ? photoImages.get(p.src) : undefined
    if (img?.complete && img.naturalWidth) {
      const s = Math.max(260 / img.naturalWidth, 250 / img.naturalHeight)
      g.beginPath()
      g.rect(0, 0, 260, 250)
      g.clip()
      g.drawImage(img, (260 - img.naturalWidth * s) / 2, (250 - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s)
    } else placeholderPhoto(g, 260, 250, i)
    g.restore()
    g.fillStyle = '#33302c'
    g.font = '600 38px Caveat, cursive'
    g.textAlign = 'center'
    g.fillText(p.caption, 0, 150)
    g.restore()
    pin(g, x + 150, y + 18, '#3a6fd8')
  })

  // sticky notes
  const noteSpots: [number, number, number][] = [
    [450, 70, 3],
    [760, 90, -4],
    [1080, 60, 4],
    [90, 520, -3],
    [820, 450, 2],
    [130, 830, 4],
    [880, 800, -3],
  ]
  corkboard.notes.slice(0, noteSpots.length).forEach((n, i) => {
    const [x, y, rot] = noteSpots[i]
    g.save()
    g.translate(x + 125, y + 125)
    g.rotate((rot * Math.PI) / 180)
    shadow()
    g.fillStyle = n.color
    g.fillRect(-125, -125, 250, 250)
    noShadow()
    g.fillStyle = 'rgba(0,0,0,.06)' // sticky strip
    g.fillRect(-125, -125, 250, 34)
    g.fillStyle = '#2a2724'
    g.font = '600 42px Caveat, cursive'
    g.textAlign = 'center'
    const lines = wrap(g, n.text, 215)
    lines.forEach((l, k) => g.fillText(l, 0, -((lines.length - 1) * 46) / 2 + k * 46 + 14))
    g.restore()
    pin(g, x + 125, y + 16, ['#d8443a', '#2e9e6a', '#e8a33a'][i % 3])
  })

  // a movie ticket stub — the #1 favourite
  const fav = letterboxd.favorites[0]
  g.save()
  g.translate(1230 + 160, 860 + 70)
  g.rotate((-6 * Math.PI) / 180)
  shadow()
  g.fillStyle = '#f1e2c2'
  g.fillRect(-160, -70, 320, 140)
  noShadow()
  g.strokeStyle = '#b5562f'
  g.setLineDash([6, 6])
  g.strokeRect(-148, -58, 296, 116)
  g.setLineDash([])
  g.fillStyle = '#b5562f'
  g.textAlign = 'center'
  g.font = '800 22px Inter, sans-serif'
  g.fillText('ADMIT ONE', 0, -22)
  g.font = '700 30px Georgia, serif'
  g.fillText(fav.title, 0, 18)
  g.font = '500 16px Inter, sans-serif'
  g.fillText(`${fav.year} · seat 7F`, 0, 44)
  g.restore()
  pin(g, 1390, 806, '#d8443a')
}

/** The corkboard face, drawn from content.ts. Redraws once the handwriting font / photos load. */
export function liveCorkboard(): THREE.CanvasTexture {
  if (corkTex) return corkTex
  const c = document.createElement('canvas')
  c.width = PX.w
  c.height = PX.h
  drawCork(c)
  corkTex = new THREE.CanvasTexture(c)
  corkTex.colorSpace = THREE.SRGBColorSpace
  corkTex.anisotropy = 8
  const redraw = () => {
    drawCork(c)
    corkTex!.needsUpdate = true
    changed()
  }
  document.fonts.load('600 42px Caveat').then(redraw).catch(() => {})
  for (const p of corkboard.photos) {
    if (!p.src) continue
    const img = new Image()
    img.onload = redraw
    img.src = `${import.meta.env.BASE_URL}corkboard/${p.src}`
    photoImages.set(p.src, img)
  }
  return corkTex
}
