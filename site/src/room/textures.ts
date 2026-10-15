import * as THREE from 'three'

// Small canvas-drawn textures, so the room needs no image files.

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Woven banig mat: natural straw with faded dyed bands. */
export function banigTexture() {
  return canvasTexture(512, 512, (g) => {
    const r = rand(3)
    const s = 12
    const bands = ['#d9c08c', '#a3523f', '#d9c08c', '#4f7464', '#d9c08c', '#c99a3f']
    for (let y = 0; y < 512; y += s)
      for (let x = 0; x < 512; x += s) {
        const band = bands[Math.floor(y / 72) % bands.length]
        const over = (x / s + y / s) % 2 === 0
        g.fillStyle = over ? band : '#e2cfa3'
        g.fillRect(x, y, s, s)
        // straw fibres
        g.fillStyle = `rgba(90,60,25,${0.08 + r() * 0.1})`
        if (over) g.fillRect(x, y + s / 2 - 0.5, s, 1)
        else g.fillRect(x + s / 2 - 0.5, y, 1, s)
        g.strokeStyle = 'rgba(80,50,20,.18)'
        g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
      }
    g.strokeStyle = '#8a6a3e'
    g.lineWidth = 14
    g.strokeRect(7, 7, 498, 498)
  })
}

/** Tiny desktop shown on the laptop screen in the room. */
export function laptopScreenTexture() {
  return canvasTexture(512, 320, (g) => {
    const grad = g.createLinearGradient(0, 0, 512, 320)
    grad.addColorStop(0, '#3a2e5a')
    grad.addColorStop(0.6, '#8a4a5a')
    grad.addColorStop(1, '#e8a33a')
    g.fillStyle = grad
    g.fillRect(0, 0, 512, 320)
    g.fillStyle = 'rgba(0,0,0,.35)'
    g.fillRect(0, 0, 512, 18)
    g.fillStyle = '#fff'
    g.font = '600 12px Inter, sans-serif'
    g.fillText('Jaztin', 12, 13)
    // icons
    const icons = ['#4a8ad8', '#ffffff', '#ffffff', '#4a8ad8', '#2e6b5e']
    icons.forEach((c, i) => {
      g.fillStyle = c
      g.beginPath()
      g.roundRect(460, 32 + i * 48, 34, 30, 6)
      g.fill()
    })
    // dock
    g.fillStyle = 'rgba(255,255,255,.3)'
    g.beginPath()
    g.roundRect(150, 276, 212, 36, 10)
    g.fill()
    ;['#4a8ad8', '#222', '#2e6b5e', '#c0392b', '#e8a33a'].forEach((c, i) => {
      g.fillStyle = c
      g.beginPath()
      g.roundRect(160 + i * 40, 282, 28, 24, 6)
      g.fill()
    })
    g.fillStyle = 'rgba(255,255,255,.92)'
    g.font = '600 22px Inter, sans-serif'
    g.fillText("Jaztin's laptop", 60, 160)
  })
}

/** A made-up film poster. */
/** A typographic film poster (my own design — title, year, colour mood; no official artwork). */
export function posterTexture(title: string, year: number, top: string, bottom: string, accent: string, seed = 1) {
  return canvasTexture(512, 768, (g) => {
    const r = rand(seed * 97 + 13)
    const grad = g.createLinearGradient(0, 0, 0, 768)
    grad.addColorStop(0, top)
    grad.addColorStop(1, bottom)
    g.fillStyle = grad
    g.fillRect(0, 0, 512, 768)
    // a soft abstract "moon" and horizon line — each poster a little different
    g.globalAlpha = 0.22
    g.fillStyle = accent
    g.beginPath()
    g.arc(140 + r() * 230, 200 + r() * 120, 70 + r() * 60, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = 0.35
    g.fillRect(48, 470, 416, 2)
    g.globalAlpha = 1
    // film grain
    for (let i = 0; i < 9000; i++) {
      const v = r() > 0.5 ? 255 : 0
      g.fillStyle = `rgba(${v},${v},${v},${0.03 + r() * 0.04})`
      g.fillRect(r() * 512, r() * 768, 1.5, 1.5)
    }
    g.fillStyle = accent
    g.textAlign = 'left'
    g.font = '600 18px Inter, sans-serif'
    g.globalAlpha = 0.8
    g.fillText("JAZU_'S FAVOURITE", 48, 70)
    g.globalAlpha = 1
    // title, wrapped to the poster width
    g.font = '800 64px Inter, sans-serif'
    const words = title.toUpperCase().split(' ')
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (g.measureText(test).width > 416 && line) {
        lines.push(line)
        line = w
      } else line = test
    }
    lines.push(line)
    const startY = 690 - (lines.length - 1) * 66 - 60
    lines.forEach((l, i) => g.fillText(l, 48, startY + i * 66))
    g.font = '500 26px Inter, sans-serif'
    g.globalAlpha = 0.85
    g.fillText(String(year), 48, 712)
    g.globalAlpha = 1
  })
}

/** A printed first page of a paper: title, authors, two columns of text (IEEE-ish layout). */
export function paperPageTexture(title: string, authors: string, seed = 3) {
  return canvasTexture(512, 724, (g) => {
    const r = rand(seed * 31 + 7)
    g.fillStyle = '#fbfaf6'
    g.fillRect(0, 0, 512, 724)
    g.fillStyle = '#1d1d1f'
    g.textAlign = 'center'
    g.font = '700 22px Georgia, serif'
    // wrap the title
    const words = title.split(' ')
    const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (g.measureText(test).width > 420 && line) {
        lines.push(line)
        line = w
      } else line = test
    }
    lines.push(line)
    lines.forEach((l, i) => g.fillText(l, 256, 58 + i * 27))
    let y = 58 + lines.length * 27 + 6
    g.font = 'italic 13px Georgia, serif'
    g.fillStyle = '#3a3a3c'
    g.fillText(authors, 256, y)
    y += 30
    // abstract block, then two columns of "text"
    g.fillStyle = '#9a9a9e'
    for (let i = 0; i < 6; i++) g.fillRect(48, y + i * 11, 416 - (i === 5 ? 160 : r() * 20), 4)
    y += 6 * 11 + 18
    for (const x0 of [40, 266]) {
      let yy = y
      for (let i = 0; yy < 690; i++) {
        if (r() < 0.06) {
          g.fillStyle = '#c8c8cc' // a figure or table
          g.fillRect(x0, yy, 206, 70)
          yy += 84
          continue
        }
        g.fillStyle = r() < 0.08 ? '#55555a' : '#a4a4a8'
        g.fillRect(x0, yy, 206 - (r() < 0.15 ? r() * 90 : r() * 10), 4)
        yy += 10
      }
    }
  })
}

/** Paper scroll with "TagaBaybay" in baybayin. Call after the font has loaded. */
export function baybayinTexture() {
  return canvasTexture(256, 512, (g) => {
    g.fillStyle = '#f1e4c4'
    g.fillRect(0, 0, 256, 512)
    g.fillStyle = '#6b4a2a'
    g.fillRect(0, 0, 256, 18)
    g.fillRect(0, 494, 256, 18)
    g.fillStyle = '#2a1a10'
    g.textAlign = 'center'
    g.font = '64px "Noto Sans Tagalog", sans-serif'
    const glyphs = ['ᜆ', 'ᜄ', 'ᜊᜌ᜔', 'ᜊᜌ᜔']
    glyphs.forEach((ch, i) => g.fillText(ch, 128, 110 + i * 100))
  })
}

/** Certificate on the wall. */
export function certificateTexture(line: string) {
  return canvasTexture(320, 240, (g) => {
    g.fillStyle = '#fbf7ee'
    g.fillRect(0, 0, 320, 240)
    g.strokeStyle = '#c9a050'
    g.lineWidth = 6
    g.strokeRect(14, 14, 292, 212)
    g.fillStyle = '#3a2a1a'
    g.textAlign = 'center'
    g.font = '700 22px Georgia, serif'
    g.fillText('Certificate', 160, 80)
    g.font = '14px Georgia, serif'
    g.fillText(line, 160, 120)
    g.fillStyle = '#c0392b'
    g.beginPath()
    g.arc(160, 180, 18, 0, Math.PI * 2)
    g.fill()
  })
}

/** Jeepney signboard. */
export function signboardTexture() {
  return canvasTexture(256, 64, (g) => {
    g.fillStyle = '#fff6d6'
    g.fillRect(0, 0, 256, 64)
    g.fillStyle = '#b8261b'
    g.textAlign = 'center'
    g.font = '800 24px Inter, sans-serif'
    g.fillText('LAPTOP – KWARTO', 128, 42)
  })
}

/* ---------- realism: surfaces & the view outside ---------- */

function rand(seed: number) {
  // small deterministic PRNG so textures look the same on every load
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function grain(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: () => number, alpha: number) {
  for (let i = 0; i < h / 2; i++) {
    const yy = y + r() * h
    g.strokeStyle = `rgba(40,20,5,${alpha * (0.3 + r() * 0.7)})`
    g.lineWidth = 0.5 + r() * 1.5
    g.beginPath()
    g.moveTo(x, yy)
    for (let xx = x; xx <= x + w; xx += 24) g.lineTo(xx, yy + Math.sin(xx / (40 + r() * 60)) * 2)
    g.stroke()
  }
}

/** Narra floor planks. */
export function floorTexture() {
  const t = canvasTexture(1024, 1024, (g) => {
    const r = rand(7)
    const plank = 128
    const tones = ['#9a5b2c', '#8c4f24', '#a5653a', '#93552a', '#7f4720']
    for (let row = 0; row < 1024 / plank; row++) {
      let x = -r() * 400
      while (x < 1024) {
        const len = 300 + r() * 400
        g.fillStyle = tones[Math.floor(r() * tones.length)]
        g.fillRect(x, row * plank, len, plank)
        grain(g, x, row * plank, len, plank, r, 0.18)
        g.fillStyle = 'rgba(30,15,5,.55)'
        g.fillRect(x, row * plank, 2, plank)
        x += len
      }
      g.fillStyle = 'rgba(30,15,5,.6)'
      g.fillRect(0, row * plank, 1024, 2)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 3)
  t.rotation = Math.PI / 2
  return t
}

/** Fine wood grain for furniture. */
export function woodTexture(base = '#8a4b22') {
  const t = canvasTexture(512, 512, (g) => {
    const r = rand(13)
    g.fillStyle = base
    g.fillRect(0, 0, 512, 512)
    grain(g, 0, 0, 512, 512, r, 0.22)
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Slightly uneven painted plaster. */
export function plasterTexture(base: string) {
  const t = canvasTexture(512, 512, (g) => {
    const r = rand(29)
    g.fillStyle = base
    g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 6000; i++) {
      const v = r() > 0.5 ? 255 : 0
      g.fillStyle = `rgba(${v},${v},${v},${0.006 + r() * 0.01})`
      const s = 1 + r() * 3
      g.fillRect(r() * 512, r() * 512, s, s)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 2)
  return t
}

/** What you see through the window: Manila rooftops, power lines, sky. */
export function outsideTexture(night: boolean, rainy: boolean) {
  return canvasTexture(1024, 512, (g) => {
    const r = rand(41)
    const sky = g.createLinearGradient(0, 0, 0, 512)
    if (night) {
      sky.addColorStop(0, '#0b1026')
      sky.addColorStop(0.7, '#2a2350')
      sky.addColorStop(1, '#5a3a55')
    } else if (rainy) {
      sky.addColorStop(0, '#8a939e')
      sky.addColorStop(1, '#c7ccd2')
    } else {
      sky.addColorStop(0, '#5aa0e0')
      sky.addColorStop(0.75, '#bfe0f5')
      sky.addColorStop(1, '#f5e6c8')
    }
    g.fillStyle = sky
    g.fillRect(0, 0, 1024, 512)
    // sun or moon
    g.fillStyle = night ? '#f3efd6' : rainy ? 'rgba(255,255,255,.0)' : '#fff6d8'
    g.beginPath()
    g.arc(760, 110, night ? 22 : 34, 0, Math.PI * 2)
    g.fill()
    if (night)
      for (let i = 0; i < 70; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`
        g.fillRect(r() * 1024, r() * 260, 1.5, 1.5)
      }
    if (!night && !rainy) {
      g.fillStyle = 'rgba(255,255,255,.8)'
      for (let i = 0; i < 4; i++) {
        const cx = 100 + i * 240 + r() * 60
        const cy = 80 + r() * 90
        for (let k = 0; k < 5; k++) {
          g.beginPath()
          g.arc(cx + k * 22, cy + Math.sin(k) * 8, 22 + r() * 14, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
    // far skyline
    for (let x = 0; x < 1024; ) {
      const w = 30 + r() * 70
      const h = 120 + r() * 180
      g.fillStyle = night ? '#1a1830' : rainy ? '#6f7680' : '#8aa0b8'
      g.fillRect(x, 512 - h - 60, w, h + 60)
      if (night)
        for (let wy = 512 - h - 50; wy < 470; wy += 14)
          for (let wx = x + 5; wx < x + w - 6; wx += 10)
            if (r() > 0.6) {
              g.fillStyle = r() > 0.5 ? '#ffd27a' : '#fff1c4'
              g.fillRect(wx, wy, 4, 6)
            }
      x += w + 4
    }
    // near rooftops (corrugated iron, a little rusty)
    for (let x = -20; x < 1024; ) {
      const w = 120 + r() * 120
      const top = 400 + r() * 50
      g.fillStyle = night ? '#2a2025' : ['#9b4a32', '#7a8a8f', '#b3683e', '#5f6f63'][Math.floor(r() * 4)]
      g.beginPath()
      g.moveTo(x, 512)
      g.lineTo(x, top + 20)
      g.lineTo(x + w / 2, top)
      g.lineTo(x + w, top + 20)
      g.lineTo(x + w, 512)
      g.fill()
      g.strokeStyle = 'rgba(0,0,0,.15)'
      for (let k = x + 4; k < x + w; k += 7) {
        g.beginPath()
        g.moveTo(k, top + 10)
        g.lineTo(k, 512)
        g.stroke()
      }
      x += w - 10
    }
    // power lines — every Manila window has them
    g.strokeStyle = night ? 'rgba(10,10,20,.9)' : 'rgba(30,30,30,.75)'
    g.lineWidth = 2
    for (let i = 0; i < 4; i++) {
      g.beginPath()
      g.moveTo(0, 190 + i * 14)
      g.quadraticCurveTo(512, 250 + i * 18, 1024, 175 + i * 12)
      g.stroke()
    }
    g.fillStyle = night ? '#141018' : '#4a3a2e'
    g.fillRect(150, 160, 10, 352)
    g.fillRect(120, 180, 70, 6)
    if (rainy) {
      g.strokeStyle = 'rgba(255,255,255,.35)'
      g.lineWidth = 1
      for (let i = 0; i < 220; i++) {
        const x = r() * 1024
        const y = r() * 512
        g.beginPath()
        g.moveTo(x, y)
        g.lineTo(x - 6, y + 22)
        g.stroke()
      }
    }
  })
}

/** Analog wall-clock face. */
export function clockFaceTexture() {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = '#f7f2e8'
    g.beginPath()
    g.arc(128, 128, 126, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#2a1a10'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = '600 26px Inter, sans-serif'
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2
      g.fillText(String(i), 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96)
    }
    g.font = '500 12px Inter, sans-serif'
    g.fillStyle = '#8a6a4a'
    g.fillText('MANILA', 128, 170)
  })
}

/**
 * Derive a tangent-space normal map from a canvas texture's brightness (Sobel filter),
 * so grain, plank seams and plaster bumps catch the light. Built once at load; costs nothing per frame.
 */
export function normalMapFor(src: THREE.Texture, strength = 2) {
  const img = src.image as HTMLCanvasElement
  const w = img.width
  const h = img.height
  const data = img.getContext('2d')!.getImageData(0, 0, w, h).data
  const lum = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) lum[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255
  const at = (x: number, y: number) => lum[((y + h) % h) * w + ((x + w) % w)]
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const g = out.getContext('2d')!
  const px = g.createImageData(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)) * strength
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      px.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      px.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      px.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      px.data[i + 3] = 255
    }
  g.putImageData(px, 0, 0)
  const t = new THREE.CanvasTexture(out)
  t.wrapS = src.wrapS
  t.wrapT = src.wrapT
  t.repeat.copy(src.repeat)
  t.rotation = src.rotation
  t.anisotropy = src.anisotropy
  return t
}

/** The MacBook's screen: a dark code editor with a SQL query open. */
export function codeEditorTexture() {
  return canvasTexture(1024, 640, (g) => {
    g.fillStyle = '#1e1f29'
    g.fillRect(0, 0, 1024, 640)
    g.fillStyle = '#171820' // title bar + sidebar
    g.fillRect(0, 0, 1024, 34)
    g.fillRect(0, 34, 200, 606)
    ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      g.fillStyle = c
      g.beginPath()
      g.arc(22 + i * 22, 17, 7, 0, Math.PI * 2)
      g.fill()
    })
    g.font = '15px JetBrains Mono, monospace'
    g.fillStyle = '#8b8fa3'
    ;['▾ tagabaybay', '   src/', '   ▸ adaptation', '   lib.rs', '▾ thesis-pipeline', '   schema.sql', '   align.py', '   README.md'].forEach((t, i) => g.fillText(t, 16, 70 + i * 26))
    const code: [string, string][][] = [
      [['-- speakers & clips for the AVSR dataset', '#6a7088']],
      [['CREATE TABLE ', '#c792ea'], ['clips', '#82aaff'], [' (', '#c8cce0']],
      [['  id          ', '#c8cce0'], ['BIGSERIAL PRIMARY KEY', '#ffcb6b'], [',', '#c8cce0']],
      [['  speaker_id  ', '#c8cce0'], ['INT REFERENCES ', '#c792ea'], ['speakers', '#82aaff'], [',', '#c8cce0']],
      [['  lang        ', '#c8cce0'], ['TEXT CHECK', '#ffcb6b'], [" (lang IN ('fil','en','taglish'))", '#c3e88d'], [',', '#c8cce0']],
      [['  start_ms    ', '#c8cce0'], ['INT', '#ffcb6b'], [', end_ms ', '#c8cce0'], ['INT', '#ffcb6b']],
      [[');', '#c8cce0']],
      [['', '#c8cce0']],
      [['SELECT ', '#c792ea'], ['lang, ', '#c8cce0'], ['count', '#82aaff'], ['(*), ', '#c8cce0'], ['sum', '#82aaff'], ['(end_ms - start_ms) / 3.6e6 ', '#c8cce0'], ['AS ', '#c792ea'], ['hours', '#c8cce0']],
      [['FROM ', '#c792ea'], ['clips ', '#c8cce0'], ['GROUP BY ', '#c792ea'], ['lang;', '#c8cce0']],
    ]
    g.font = '17px JetBrains Mono, monospace'
    code.forEach((line, i) => {
      let x = 260
      const y = 74 + i * 30
      g.fillStyle = '#4b4f63'
      g.fillText(String(i + 1).padStart(2, ' '), 214, y)
      for (const [t, c] of line) {
        g.fillStyle = c
        g.fillText(t, x, y)
        x += g.measureText(t).width
      }
    })
    g.fillStyle = '#ffcb6b' // cursor
    g.fillRect(560, 345, 2, 22)
    g.fillStyle = '#12131a' // terminal panel
    g.fillRect(200, 470, 824, 170)
    g.fillStyle = '#7fe0a0'
    g.font = '15px JetBrains Mono, monospace'
    g.fillText('$ cargo test --test eval', 220, 500)
    g.fillStyle = '#c8cce0'
    g.fillText('5-vowel CER 3.34%   3-vowel CER 2.63%   ✓ 2319 pairs', 220, 528)
  })
}

/** The external monitor: wallpaper + dock, like the real desktop (16:9). */
export function monitorTexture() {
  return canvasTexture(1024, 576, (g) => {
    const grad = g.createLinearGradient(0, 0, 1024, 576)
    grad.addColorStop(0, '#3a2e5a')
    grad.addColorStop(0.6, '#8a4a5a')
    grad.addColorStop(1, '#e8a33a')
    g.fillStyle = grad
    g.fillRect(0, 0, 1024, 576)
    g.fillStyle = 'rgba(0,0,0,.35)'
    g.fillRect(0, 0, 1024, 26)
    g.fillStyle = '#fff'
    g.font = '600 15px Inter, sans-serif'
    g.fillText('Jaztin', 18, 18)
    ;['#4a8ad8', '#ffffff', '#ffffff', '#4a8ad8', '#2e6b5e'].forEach((c, i) => {
      g.fillStyle = c
      g.beginPath()
      g.roundRect(950, 52 + i * 78, 50, 46, 9)
      g.fill()
    })
    g.fillStyle = 'rgba(255,255,255,.3)'
    g.beginPath()
    g.roundRect(330, 512, 364, 52, 14)
    g.fill()
    ;['#4a8ad8', '#f6efe3', '#2e6b5e', '#222', '#c0392b', '#e8a33a'].forEach((c, i) => {
      g.fillStyle = c
      g.beginPath()
      g.roundRect(344 + i * 58, 520, 40, 36, 9)
      g.fill()
    })
    g.fillStyle = 'rgba(255,255,255,.95)'
    g.font = '700 54px Inter, sans-serif'
    g.fillText("Hi, I'm Jaztin.", 70, 380)
    g.font = '500 20px Inter, sans-serif'
    g.fillStyle = 'rgba(255,255,255,.8)'
    g.fillText('click to open my computer', 72, 416)
  })
}

/** Keycaps for the low-profile keyboard (white keys on aluminium). */
export function keyboardTexture() {
  return canvasTexture(1024, 282, (g) => {
    g.fillStyle = '#b9bdc2'
    g.fillRect(0, 0, 1024, 282)
    const rows: number[][] = [
      Array(14).fill(1),
      [1.5, ...Array(12).fill(1), 1.5],
      [1.8, ...Array(11).fill(1), 2.2],
      [2.3, ...Array(10).fill(1), 2.7],
      [1, 1, 1.3, 1.3, 5.2, 1.3, 1, 1, 1, 1],
    ]
    const unit = 1004 / 15
    rows.forEach((row, r) => {
      const total = row.reduce((a, b) => a + b, 0)
      const scale = 15 / total
      let x = 10
      row.forEach((wUnits) => {
        const w = wUnits * unit * scale
        g.fillStyle = '#fbfbfa'
        g.beginPath()
        g.roundRect(x + 3, 10 + r * 54, w - 6, 46, 6)
        g.fill()
        g.fillStyle = 'rgba(0,0,0,.06)'
        g.fillRect(x + 3, 10 + r * 54 + 40, w - 6, 6)
        x += w
      })
    })
  })
}
