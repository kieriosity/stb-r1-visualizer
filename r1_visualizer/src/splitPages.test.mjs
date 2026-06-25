import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitCombinedPages, navScheduleLabel } from './pageSchedules.js'

const abPage = {
  sheet: 'Sch A and B',
  schedule: null,
  cols: [10, 20],
  form_versions: ['2026-07-31'],
  rows: Array.from({ length: 122 }, (_, i) => ({ cells: [{ c: 0, t: String(i) }] })),
  rowBreaks: [61],
}

test('Sch A and B splits into standalone Schedule A and Schedule B tabs', () => {
  const out = splitCombinedPages([abPage])
  assert.equal(out.length, 2)
  assert.deepEqual(out.map((p) => p.schedule), ['A', 'B'])
  assert.deepEqual(out.map((p) => navScheduleLabel(p)), ['A', 'B'])
  // Split on the page break: rows 0-60 to A, 61-121 to B; no leftover break.
  assert.equal(out[0].rows.length, 61)
  assert.equal(out[1].rows.length, 61)
  assert.deepEqual(out[0].rowBreaks, [])
  // Column widths / form version carry through unchanged.
  assert.deepEqual(out[0].cols, abPage.cols)
})

test('pages without a configured split (or a mismatched break count) pass through', () => {
  const c = { sheet: 'Sch C', schedule: null, rows: [{ cells: [] }], rowBreaks: [] }
  const mismatched = { sheet: 'Sch A and B', rows: [{ cells: [] }], rowBreaks: [] } // 0 breaks, needs 1
  const out = splitCombinedPages([c, mismatched])
  assert.equal(out.length, 2)
  assert.equal(out[0].sheet, 'Sch C')
  assert.equal(out[1].sheet, 'Sch A and B')
})
