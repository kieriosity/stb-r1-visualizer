import { pageMatchesSchedule } from './pageSchedules.js'
import { buildGridPanels } from './formGrid.js'

export function sourceReviewUrl(base, sel) {
  if (!base || !sel) return null
  return `${String(base).replace(/\/$/, '')}/${encodeURIComponent(sel.carrier.toLowerCase())}/${sel.year}/${sel.version}`
}

export function initialSourcePage(manifest, scheduleId, requested) {
  const n = Number(requested)
  if (Number.isInteger(n) && n >= 1 && n <= manifest.page_count) return n
  return manifest.pages.find((p) => p.schedules.includes(scheduleId))?.page || 1
}

export function extractedPagesForSource(navPages, sourcePage) {
  const ids = sourcePage?.schedules || []
  // One template sheet may contain several printed pages. Preserve the complete
  // grid for column/block analysis; select its rendered panel only afterward.
  const pages = navPages.flatMap((page) => {
    const count = page.rows && page.cols && !page.notesFor ? buildGridPanels(page).length : 1
    return Array.from({ length: count }, (_, panel) => ({ ...page,
      comparisonPanel: panel,
      comparisonLabel: count > 1 ? `${page.sheet} · page ${panel + 1} of ${count}` : page.sheet }))
  })
  return pages.map((page, index) => ({ page, index }))
    .filter(({ page }) => ids.some((id) => pageMatchesSchedule(page, id)))
}

export function selectedExtractedPage(choices, selected) {
  return choices.find((p) => p.index === selected) || choices[0] || null
}

// This is a navigation aid, not evidence of page-level correspondence. The log
// only links schedules. Start with source order, then preserve a user's pairing
// by advancing relative to the currently selected form page within that schedule.
export function linkedExtractedPage(choices, manifest, sourcePage, previous = null) {
  if (!choices.length) return null
  const ids = sourcePage?.schedules || []
  const forms = choices.filter(({ page }) => !page.notesFor)
  const available = forms.length ? forms : choices
  const continued = ids.find((id) => previous?.sourcePage?.schedules.includes(id)
    && pageMatchesSchedule(previous.chosen?.page, id)
    && available.some(({ page }) => pageMatchesSchedule(page, id)))
  const schedule = continued || ids.find((id) => available.some(({ page }) => pageMatchesSchedule(page, id)))
  const group = available.filter(({ page }) => pageMatchesSchedule(page, schedule))
  if (!group.length) return available[0]
  const sourcePages = manifest.pages.filter((p) => p.schedules.includes(schedule))
    .map((p) => p.page).sort((a, b) => a - b)
  let position = sourcePages.indexOf(sourcePage.page)
  const previousSource = sourcePages.indexOf(previous?.sourcePage?.page)
  const previousForm = group.findIndex((p) => p.index === previous?.chosen?.index)
  if (continued && previousSource >= 0 && previousForm >= 0) {
    position = previousForm + position - previousSource
  }
  return group[Math.max(0, Math.min(position, group.length - 1))]
}
