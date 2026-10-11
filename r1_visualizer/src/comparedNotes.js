import { buildGridPanels } from './formGrid.js'

function promptText(value) {
  return String(value || '').toLowerCase()
    .replace(/^\s*\d+[.)]\s*/, '').replace(/^\s*\([a-z]\)\s*/, '')
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/\bdocket no (?=\d)/g, 'docket ')
}

// A text association, not a source-page coordinate. Note IDs can be repeated
// or generated independently of the printed question numbers; never join on ID.
export function notesForComparedPage(page, schedule) {
  const panel = Number.isInteger(page?.comparisonPanel)
    ? buildGridPanels(page)[page.comparisonPanel] : null
  const rows = panel?.rows || []
  const text = (row) => (row.cells || []).map((c) => c.t || '').join(' ')
  const isNotesPage = rows.slice(0, 6).some((row) =>
    /\bexplanatory notes\b|^\s*notes and remarks\s*$/i.test(text(row)))
  const prompts = isNotesPage ? rows.map(text).filter((t) => /^\s*\d+\.\s+/.test(t))
    .map((t) => promptText(t).split(' ').slice(0, 8).join(' '))
    .filter((t) => t.length >= 24) : []
  const matching = []
  ;(schedule?.explanatory_notes || []).forEach((note, index) => {
    const value = promptText(note.text)
    if (prompts.some((p) => value === p || value.startsWith(`${p} `))) matching.push(index)
  })
  return { isNotesPage, matching }
}
