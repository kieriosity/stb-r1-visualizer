import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Sibling folder holding the canonical STB R-1 JSON files.
const JSON_DIR = path.resolve(__dirname, '..', 'stb_r1_json')

// Parse "STB-R1-BNSF-2025_v1.json" -> {carrier, year, version, file}
function parseName(file) {
  const m = /^STB-R1-([A-Z]+)-(\d{4})_v(\d+)\.json$/i.exec(file)
  if (!m) return null
  return { carrier: m[1].toUpperCase(), year: Number(m[2]), version: Number(m[3]), file }
}

function buildManifest() {
  let entries = []
  try {
    entries = fs.readdirSync(JSON_DIR)
      .map(parseName)
      .filter(Boolean)
      .sort((a, b) =>
        a.carrier.localeCompare(b.carrier) || a.year - b.year || a.version - b.version)
  } catch (e) {
    console.warn(`[r1-data] could not read ${JSON_DIR}: ${e.message}`)
  }
  return { generated: 'dev', count: entries.length, submissions: entries }
}

/**
 * Dev-only plugin: serves the sibling stb_r1_json/ folder at /data/* and
 * synthesizes /data/manifest.json. In production the host (WordPress / CDN)
 * serves these as static assets, so this plugin is a no-op for `vite build`.
 */
function r1DataServer() {
  return {
    name: 'r1-data-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (url === '/manifest.json' || url === '/manifest') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(buildManifest()))
          return
        }
        const safe = path.normalize(url).replace(/^(\.\.[/\\])+/, '')
        const filePath = path.join(JSON_DIR, safe)
        if (filePath.startsWith(JSON_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'application/json')
          fs.createReadStream(filePath).pipe(res)
          return
        }
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [preact(), r1DataServer()],
  build: {
    outDir: 'dist',
    // Build as a library-ish bundle plus the standalone page; WordPress enqueues
    // the emitted JS/CSS and calls window.mountR1Viewer().
    rollupOptions: {
      output: {
        entryFileNames: 'r1-viewer.js',
        assetFileNames: 'r1-viewer.[ext]',
      },
    },
  },
})
