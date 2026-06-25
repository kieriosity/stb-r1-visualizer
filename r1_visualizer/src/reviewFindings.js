import { scheduleIdsForPage } from './pageSchedules.js'

const SEVERITY_RANK = { FATAL: 0, WARNING: 1, INFO: 2 }

function text(value) {
  return value == null ? '' : String(value)
}

function numberOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function normalizeReviewFindings(payload) {
  const raw = Array.isArray(payload) ? payload : payload?.findings
  if (!Array.isArray(raw)) return []
  return raw
    .filter((finding) => finding && typeof finding === 'object')
    .map((finding) => ({
      carrier: text(finding.carrier).toUpperCase(),
      year: numberOrNull(finding.year),
      version: numberOrNull(finding.version),
      schedule_id: text(finding.schedule_id),
      severity: text(finding.severity).toUpperCase() || 'INFO',
      rule_id: text(finding.rule_id) || '(missing rule_id)',
      location: text(finding.location),
      message: text(finding.message),
      suggested_action: text(finding.suggested_action),
      actual_value: text(finding.actual_value),
      is_new: Boolean(finding.is_new),
    }))
}

function matchesSelection(finding, selected) {
  return Boolean(
    selected &&
    finding.carrier === text(selected.carrier).toUpperCase() &&
    finding.year === Number(selected.year) &&
    finding.version === Number(selected.version)
  )
}

function sortFindings(a, b) {
  return (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9) ||
    a.rule_id.localeCompare(b.rule_id) ||
    a.location.localeCompare(b.location)
}

export function findingsForPage(findings, selected, page) {
  const scheduleIds = new Set(scheduleIdsForPage(page))
  if (!scheduleIds.size) return []
  return (findings || [])
    .filter((finding) => matchesSelection(finding, selected) && scheduleIds.has(finding.schedule_id))
    .sort(sortFindings)
}

export function findingCountsByPage(pages, findings, selected) {
  const counts = {}
  for (const [index, page] of (pages || []).entries()) {
    const count = findingsForPage(findings, selected, page).length
    if (count) counts[index] = count
  }
  return counts
}
