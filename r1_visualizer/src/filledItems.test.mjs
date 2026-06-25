import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// FilledPanel suppresses its raw "filed items" panel for schedules the facsimile
// can draw to scale (those carry a columnSpec); only schedules with no facsimile
// column mapping fall back to a printed-style table. Lock that contract here so a
// columnSpec regression can't reintroduce the raw JSON dump on 310/510/etc.
const columnSpec = JSON.parse(
  readFileSync(new URL('./columnSpec.json', import.meta.url)))

test('item schedules shown by the facsimile carry a columnSpec (no list dump)', () => {
  for (const id of ['310', '310A', '352A', '460', '501', '502', '510', '512', 'A']) {
    assert.ok(columnSpec[id], `${id} should have a facsimile column spec`)
    assert.equal(columnSpec[id].valueKey, 'fields', `${id} overlays its fields onto the form`)
  }
})

test('a schedule with no facsimile mapping (PTC_501) uses the fallback table', () => {
  assert.ok(!columnSpec['PTC_501'])
})
