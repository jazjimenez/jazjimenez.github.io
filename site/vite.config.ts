import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdirSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

/** Dev-only endpoint: POST /__save?name=x.glb writes the body to ../blender/x.glb (used by the room exporter). */
function saveEndpoint(): Plugin {
  return {
    name: 'dev-save-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save', (req, res) => {
        if (req.method !== 'POST') return void res.writeHead(405).end()
        const name = basename(new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? 'export.bin')
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          const dir = resolve(__dirname, '../blender')
          mkdirSync(dir, { recursive: true })
          writeFileSync(resolve(dir, name), Buffer.concat(chunks))
          res.end(`saved blender/${name}`)
        })
      })
    },
  }
}

// Relative base so the build works on GitHub Pages under any repo name
// (username.github.io or username.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react(), saveEndpoint()],
  // The 3D room (three.js + post-processing incl. SMAA) is one lazily loaded ~1.4 MB chunk (~455 kB gzipped); that is expected.
  build: { chunkSizeWarningLimit: 1500 },
})
