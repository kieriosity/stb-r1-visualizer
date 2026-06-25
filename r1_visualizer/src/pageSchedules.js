export const SHEET_SCHEDULES = {
  'Sch A and B': ['A', 'B'],
  'Sch C': ['C'],
  'Memoranda': ['Memoranda'],
  'PTC Grants': ['PTC_Grants'],
}

// Sheets that the form prints as two schedules on separate pages (a page break
// between them) but stores as one xlsx sheet. Split into one nav tab per schedule
// so e.g. Schedule A and Schedule B each stand alone like Schedule C does. The
// schedule list must line up with the page-break segments (breaks + 1).
const SPLIT_SHEETS = { 'Sch A and B': ['A', 'B'] }

export function splitCombinedPages(pages) {
  const out = []
  for (const page of pages || []) {
    const scheds = SPLIT_SHEETS[page?.sheet]
    const breaks = page?.rowBreaks || []
    if (!scheds || breaks.length + 1 !== scheds.length || !page.rows) {
      out.push(page)
      continue
    }
    const bounds = [0, ...breaks, page.rows.length]
    scheds.forEach((sched, i) => {
      out.push({
        ...page,
        sheet: `Sch ${sched}`,
        schedule: sched,
        rows: page.rows.slice(bounds[i], bounds[i + 1]),
        rowBreaks: [],
      })
    })
  }
  return out
}

function addUnique(ids, id) {
  if (id && !ids.includes(id)) ids.push(id)
}

export function scheduleIdsForPage(page) {
  const ids = []
  addUnique(ids, page?.schedule)
  for (const id of SHEET_SCHEDULES[page?.sheet] || []) addUnique(ids, id)
  return ids
}

export function primaryScheduleIdForPage(page) {
  return scheduleIdsForPage(page)[0] || ''
}

export function pageMatchesSchedule(page, scheduleId) {
  const want = String(scheduleId || '')
  if (!want) return false
  return page?.sheet === want || scheduleIdsForPage(page).includes(want)
}

export function pageHasData(page, dataSchedules) {
  return scheduleIdsForPage(page).some((id) => dataSchedules?.has(id))
}

export function navScheduleLabel(page) {
  const ids = scheduleIdsForPage(page)
  return ids.length ? ids.join('/') : '—'
}
