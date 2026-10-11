import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { columnLetter, formatCell, isWorkbook, schedulesForRow, sheetUrl, sourceEntryLabel } from './sheetGrid.js'
import { extractedPagesForSource, initialSourcePage, linkedExtractedPage } from './sourceReview.js'

test('column letters follow Excel, including past Z', () => {
  assert.deepEqual([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnLetter),
    ['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA'])
})

test('cells show stored values without rounding', () => {
  assert.equal(formatCell(55821.13144), '55,821.13144')
  assert.equal(formatCell(-1234), '-1,234')
  assert.equal(formatCell(0), '0')
  assert.equal(formatCell(null), '')
  assert.equal(formatCell(true), 'TRUE')
  assert.equal(formatCell('2025-12-31'), '2025-12-31')
  assert.equal(formatCell('Total assets'), 'Total assets')
})

test('recorded row ranges mark Excel rows inclusively', () => {
  const ranges = [{ schedule: 'A', first_row: 1, last_row: 62 }, { schedule: 'B', first_row: 63, last_row: 122 }]
  assert.deepEqual(schedulesForRow(ranges, 1), ['A'])
  assert.deepEqual(schedulesForRow(ranges, 62), ['A'])
  assert.deepEqual(schedulesForRow(ranges, 63), ['B'])
  assert.deepEqual(schedulesForRow(ranges, 123), [])
  assert.deepEqual(schedulesForRow(undefined, 5), [])
})

test('sheet requests carry the manifest binding', () => {
  assert.equal(sheetUrl('/source/bnsf/2025/1', 3, 'a b'), '/source/bnsf/2025/1/sheet-3.json?binding=a%20b')
})

const workbook = { kind: 'workbook', page_count: 3, pages: [
  { page: 1, label: 'Sch A and B', member: null, schedules: ['A', 'B'], row_ranges: [] },
  { page: 2, label: '200', member: null, schedules: ['200'], row_ranges: [] },
  { page: 3, label: 'Sheet1', member: 'SCHED 710.xlsx', schedules: ['710'], row_ranges: [] },
] }

test('workbook tabs are labeled by name and ZIP member', () => {
  assert.ok(isWorkbook(workbook) && !isWorkbook({ pages: [] }))
  assert.equal(sourceEntryLabel(workbook, workbook.pages[0]), 'Sch A and B')
  assert.equal(sourceEntryLabel(workbook, workbook.pages[2]), 'Sheet1 (SCHED 710.xlsx)')
  assert.equal(sourceEntryLabel({ pages: [] }, { page: 4 }), 'Page 4')
})

test('tab navigation reuses the page pairing unchanged', () => {
  const pages = [{ schedule: 'A', sheet: 'A' }, { schedule: 'B', sheet: 'B' }, { schedule: '200', sheet: 'Assets' }]
  assert.equal(initialSourcePage(workbook, '200'), 2)
  const choices = extractedPagesForSource(pages, workbook.pages[0])
  assert.deepEqual(choices.map((c) => c.page.sheet), ['A', 'B'])
  assert.equal(linkedExtractedPage(choices, workbook, workbook.pages[0]).page.sheet, 'A')
})

test('the grid keeps its column letters and row numbers in view while scrolling', async () => {
  const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8')
  const rule = (selector) => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))[1]
  assert.match(rule('.r1-sheet-grid thead th'), /position: sticky; top: 0/)
  assert.match(rule('.r1-sheet-grid tbody th'), /position: sticky; left: 0/)
})
