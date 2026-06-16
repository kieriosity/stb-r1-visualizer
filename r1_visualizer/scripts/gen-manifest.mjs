// Generate manifest.json for a static/WordPress deployment.
// Dev uses the Vite plugin to synthesize this on the fly; production needs a
// real file alongside the JSON.
//
//   node scripts/gen-manifest.mjs ../stb_r1_json
//
// Writes manifest.json into the given directory.

import fs from 'node:fs'
import path from 'node:path'

const dir = path.resolve(process.argv[2] || path.join('..', 'stb_r1_json'))

function parseName(file) {
  const m = /^STB-R1-([A-Z]+)-(\d{4})_v(\d+)\.json$/i.exec(file)
  if (!m) return null
  return { carrier: m[1].toUpperCase(), year: Number(m[2]), version: Number(m[3]), file }
}

const submissions = fs.readdirSync(dir)
  .map(parseName)
  .filter(Boolean)
  .sort((a, b) => a.carrier.localeCompare(b.carrier) || a.year - b.year || a.version - b.version)

const manifest = { generated: new Date().toISOString(), count: submissions.length, submissions }
const out = path.join(dir, 'manifest.json')
fs.writeFileSync(out, JSON.stringify(manifest, null, 2))
console.log(`Wrote ${out} (${submissions.length} submissions)`)
