// Data-source abstraction. Today: static fetch of canonical JSON files.
// Later: a FastAPI-backed impl can satisfy the same interface without
// touching the renderers.

export function createStaticSource(dataBase) {
  const base = dataBase.replace(/\/$/, '')

  async function listSubmissions() {
    const res = await fetch(`${base}/manifest.json`)
    if (!res.ok) throw new Error(`manifest.json -> HTTP ${res.status}`)
    const m = await res.json()
    return m.submissions || []
  }

  async function loadSubmission(file) {
    const res = await fetch(`${base}/${file}`)
    if (!res.ok) throw new Error(`${file} -> HTTP ${res.status}`)
    return res.json()
  }

  return { listSubmissions, loadSubmission }
}
