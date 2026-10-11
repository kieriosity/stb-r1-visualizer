// Pure helpers for showing an original worksheet tab beside the extracted form.
// The server sends each tab's cells as the pipeline read them: row i is Excel row
// i + 1 and column j is Excel column j + 1.

export function columnLetter(index) {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

// Numbers are shown as stored (no rounding) so they can be compared directly with
// the extracted values. Digits are grouped only from 10,000 up, so years, line and
// account numbers read as filed ("2000", not "2,000").
export function formatCell(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') {
    return value.toLocaleString('en-US', { maximumFractionDigits: 10, useGrouping: Math.abs(value) >= 10000 })
  }
  return String(value)
}

// Schedules whose recorded row range (Excel rows, inclusive) contains this row.
export function schedulesForRow(ranges, excelRow) {
  return (ranges || []).filter((r) => excelRow >= r.first_row && excelRow <= r.last_row)
    .map((r) => r.schedule)
}

export function sheetUrl(base, page, binding) {
  return `${base}/sheet-${page}.json?binding=${encodeURIComponent(binding)}`
}

export function isWorkbook(manifest) {
  return manifest?.kind === 'workbook'
}

// Selector / heading text for one source entry: a PDF page, or a workbook tab
// (with its ZIP member when the filing is a ZIP of per-schedule workbooks).
export function sourceEntryLabel(manifest, entry) {
  if (!isWorkbook(manifest)) return `Page ${entry.page}`
  return entry.member ? `${entry.label} (${entry.member})` : entry.label
}
