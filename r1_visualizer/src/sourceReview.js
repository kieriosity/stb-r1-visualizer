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
