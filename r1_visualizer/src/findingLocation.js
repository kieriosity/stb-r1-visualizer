// Anchor a DQ finding to a printed form line so the facsimile can flag the exact
// row and the side panel can scroll to it. Finding `location`/`message` strings are
// not uniform: schedule-rule findings say "line 27" (the printed line_no), while
// schema findings carry a JSON pointer "schedules/200/sections/0/lines/8/title"
// whose trailing index is an ARRAY index that must be resolved to a line_no.

function scheduleRecords(schedule) {
  if (!schedule || typeof schedule !== 'object') return []
  if (Array.isArray(schedule.sections)) return schedule.sections.flatMap((s) => s.lines || [])
  if (Array.isArray(schedule.rows)) return schedule.rows
  if (Array.isArray(schedule.categories)) return schedule.categories
  if (Array.isArray(schedule.items)) return schedule.items
  return []
}

function lineNoAt(doc, scheduleId, sectionIdx, lineIdx) {
  const sched = doc?.schedules?.[scheduleId]
  if (!sched) return null
  let line
  if (sectionIdx != null && Array.isArray(sched.sections)) {
    line = sched.sections[sectionIdx]?.lines?.[lineIdx]
  } else {
    line = scheduleRecords(sched)[lineIdx]
  }
  const n = line?.line_no
  return Number.isInteger(n) ? n : null
}

// Returns the printed line_no a finding points at, or null for a schedule-level
// finding. `doc` is needed to resolve JSON-pointer array indices to line_no.
export function findingLineNo(finding, doc) {
  const loc = finding?.location || ''
  const msg = finding?.message || ''
  // 1) Human-facing "line 27" / "line[27]" / "line_27" / "L27" — already a line_no,
  //    and the message is the most reliable carrier of it.
  let m = `${msg} ${loc}`.match(/\bl(?:ine)?[\s_:#[]*?(\d{1,3})\b/i)
  if (m) return Number(m[1])
  // 2) JSON pointer with section + line array indices.
  m = loc.match(/sections[/[](\d+)[\]]?[/.]lines[/[](\d+)/)
  if (m) return lineNoAt(doc, finding?.schedule_id, Number(m[1]), Number(m[2]))
  // 3) JSON pointer with a flat line array index.
  m = loc.match(/(?:^|[^a-z])lines[/[](\d+)/)
  if (m) return lineNoAt(doc, finding?.schedule_id, null, Number(m[1]))
  return null
}

// Map of line_no -> findings[] for one schedule, plus the schedule-level findings
// (no resolvable line). Used to mark facsimile rows and drive the side panel.
export function anchorFindings(findings, scheduleId, doc) {
  const byLine = new Map()
  const scheduleLevel = []
  for (const f of findings || []) {
    if (f.schedule_id !== scheduleId) continue
    const lineNo = findingLineNo(f, doc)
    if (lineNo == null) {
      scheduleLevel.push(f)
      continue
    }
    if (!byLine.has(lineNo)) byLine.set(lineNo, [])
    byLine.get(lineNo).push(f)
  }
  return { byLine, scheduleLevel }
}

const SEVERITY_RANK = { FATAL: 3, WARNING: 2, INFO: 1 }

// The most severe severity among a list of findings (for a row's marker colour).
export function topSeverity(findings) {
  let top = null
  let rank = 0
  for (const f of findings || []) {
    const r = SEVERITY_RANK[f.severity] || 0
    if (r > rank) { rank = r; top = f.severity }
  }
  return top
}
