// Data-source abstraction. Today: static fetch of canonical JSON files.
// Later: a FastAPI-backed impl can satisfy the same interface without
// touching the renderers.
import { submissionSnapshot } from './issueReport.js'

export function createStaticSource(dataBase, reviewFindingsBase = null, lineageBase = null) {
  const base = dataBase.replace(/\/$/, '')
  const findingsBase = reviewFindingsBase ? reviewFindingsBase.replace(/\/$/, '') : null
  const lineage = lineageBase ? lineageBase.replace(/\/$/, '') : null

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

  async function loadSubmissionSnapshot(file) {
    const res = await fetch(`${base}/${file}`)
    if (!res.ok) throw new Error(`${file} -> HTTP ${res.status}`)
    return submissionSnapshot(res)
  }

  async function loadReviewFindings() {
    if (!findingsBase) return []
    const res = await fetch(`${findingsBase}/findings.json`)
    if (res.status === 404) return []
    if (!res.ok) throw new Error(`findings.json -> HTTP ${res.status}`)
    return res.json()
  }

  // Lineage for one submission (null when the host does not provide it or has
  // no transform log for that version).
  async function loadLineage(sel) {
    if (!lineage || !sel) return null
    const res = await fetch(`${lineage}/${String(sel.carrier).toLowerCase()}/${sel.year}/${sel.version}.json`)
    if (!res.ok) return null
    return res.json()
  }

  return { listSubmissions, loadSubmission, loadSubmissionSnapshot, loadReviewFindings, loadLineage }
}
