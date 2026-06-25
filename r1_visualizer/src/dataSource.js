// Data-source abstraction. Today: static fetch of canonical JSON files.
// Later: a FastAPI-backed impl can satisfy the same interface without
// touching the renderers.

export function createStaticSource(dataBase, reviewFindingsBase = null) {
  const base = dataBase.replace(/\/$/, '')
  const findingsBase = reviewFindingsBase ? reviewFindingsBase.replace(/\/$/, '') : null

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

  async function loadReviewFindings() {
    if (!findingsBase) return []
    const res = await fetch(`${findingsBase}/findings.json`)
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`findings.json -> HTTP ${res.status}`)
    return res.json()
  }

  return { listSubmissions, loadSubmission, loadReviewFindings }
}
