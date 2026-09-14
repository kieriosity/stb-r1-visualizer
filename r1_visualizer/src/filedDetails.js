import { prepareForm } from './formPresentation.js'
import { pageMatchesSchedule } from './pageSchedules.js'
import { prettifyKey } from './util.js'

// Keep filed schedules reachable even if a form edition has no template for them.
export function includeFiledSchedules(pages, schedules, legacy = {}) {
  const extra = Object.keys(schedules || {}).filter((id) => !pages.some((p) => pageMatchesSchedule(p, id)))
  return [...pages, ...extra.map((id) => ({ sheet: `Schedule ${id}`, schedule: id, filedOnly: true })),
    ...Object.keys(legacy).map((id) => ({ sheet: `Retained legacy schedule ${id}`, schedule: id, legacyFor: id, filedOnly: true }))]
}

export function schedulePresentation(pages, schedule, id, specs) {
  const matches = pages.filter((p) => !p.notesFor && pageMatchesSchedule(p, id))
  const plans = (matches.length ? matches : [{}]).map((p) => prepareForm(p, schedule, id, specs))
  const covered = new Set(plans.flatMap((p) => [...p.consumed]))
  return { plans, covered, unplaced: plans[0].leaves.filter((l) => !covered.has(l.pointer)) }
}

// Preserve exact scalar values and their addresses. Record labels include both
// section and line, so repeated lines and blocks do not collapse into one entry.
export function detailRows(leaves, schedule) {
  return leaves.map((leaf) => {
    const path = leaf.path
    const split = path.findIndex((p) => ['values', 'cells', 'fields', 'measures'].includes(p))
    const lastIndex = path.findLastIndex((p) => typeof p === 'number')
    const boundary = split >= 0 ? split : lastIndex >= 0 ? lastIndex + 1 : 0
    const recordPath = path.slice(0, split >= 0 ? split : Math.max(0, lastIndex + 1))
    const record = recordPath.reduce((v,k) => v?.[k], schedule)
    const recordLabel = recordPath.map((p) => typeof p === 'number' ? String(p+1) : prettifyKey(p)).join(' / ')
    const line = record?.source_line_no ?? record?.line_no
    return { ...leaf, record: `${recordLabel}${line != null ? ` · Line ${line}` : ''}${record?.block != null ? ` · Block ${record.block + 1}` : ''}`,
      field: path.slice(boundary).map((p) => typeof p === 'number' ? String(p+1) : prettifyKey(p)).join(' / ') }
  })
}
