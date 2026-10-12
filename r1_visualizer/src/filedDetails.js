import { prepareForm } from './formPresentation.js'
import { pageMatchesSchedule } from './pageSchedules.js'
import { prettifyKey } from './util.js'

// Keep filed schedules reachable even if a form edition has no template for them.
export function includeFiledSchedules(pages, schedules, legacy = {}) {
  const extra = Object.keys(schedules || {}).filter((id) => !pages.some((p) => pageMatchesSchedule(p, id)))
  return [...extendCarrierLines(pages, schedules), ...extra.map((id) => ({ sheet: `Schedule ${id}`, schedule: id, filedOnly: true })),
    ...Object.keys(legacy).map((id) => ({ sheet: `Retained legacy schedule ${id}`, schedule: id, legacyFor: id, filedOnly: true }))]
}

const MAX_CARRIER_LINES = 40

// A carrier may number list lines past the form's last printed line: BNSF 2019 adds
// lines 28-31 to Schedule 310A and prints its grand total on line 29. Those lines get
// rows after the form's last line, copied from it and marked `carrierLine`, so their
// values sit on the page rather than only among the additional filed data. Records of
// a paginated list (`block`) already have their own pages. The template is not changed.
export function extendCarrierLines(pages, schedules) {
  const out = [...pages]
  for (const [id, schedule] of Object.entries(schedules || {})) {
    const filed = (schedule?.items || []).filter((r) => r.block == null && Number.isInteger(r.line_no)).map((r) => r.line_no)
    if (!filed.length) continue
    let last = null
    out.forEach((page, index) => {
      if (!page.rows || page.notesFor || page.filedOnly || !pageMatchesSchedule(page, id)) return
      const found = lastPrintedLine(page.rows)
      if (found && (!last || found.line > last.line)) last = { ...found, index }
    })
    const top = Math.max(...filed)
    if (!last || top <= last.line || top - last.line > MAX_CARRIER_LINES) continue
    const page = out[last.index]
    const model = page.rows[last.model.row]
    const added = []
    for (let n = last.line + 1; n <= top; n++) {
      added.push({ ...model, carrierLine: last.line, cells: model.cells.map(({ t, ...cell }) =>
        String(t ?? '').trim() === String(last.model.line) ? { ...cell, t: String(n) } : cell) })
    }
    out[last.index] = { ...page, rows: [...page.rows.slice(0, last.row + 1), ...added, ...page.rows.slice(last.row + 1)],
      rowBreaks: (page.rowBreaks || []).map((b) => (b > last.row ? b + added.length : b)) }
  }
  return out
}

// The highest form line printed below the column ruler, in the column that numbers
// the most lines, with its row; `model` is the last line that prints nothing but its
// number (Schedule 352A's last line is its right-aligned TOTAL, not a plain line).
function lastPrintedLine(rows) {
  const ruler = rows.findIndex((r) => r.cells.some((c) => String(c.t ?? '').trim() === '(a)'))
  if (ruler < 0) return null
  const byCol = new Map()
  rows.forEach((row, ri) => {
    if (ri <= ruler) return
    for (const cell of row.cells) {
      if (!/^\d{1,3}$/.test(String(cell.t ?? '').trim())) continue
      const list = byCol.get(cell.c) || []
      list.push({ row: ri, line: Number(cell.t) })
      byCol.set(cell.c, list)
    }
  })
  const lines = [...byCol.values()].sort((a, b) => b.length - a.length)[0]
  if (!lines || lines.length < 3) return null
  const last = lines.reduce((a, b) => (b.line > a.line ? b : a))
  const plain = lines.filter(({ row, line }) => rows[row].cells.every((c) =>
    !String(c.t ?? '').trim() || String(c.t).trim() === String(line)))
  return { ...last, model: plain.length ? plain.reduce((a, b) => (b.line > a.line ? b : a)) : last }
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
