import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pagesForVersion, resolveFormVersion } from './formVersion.js'

const template = JSON.parse(readFileSync(new URL('./formTemplate.json', import.meta.url)))

test('the nav/page list always comes from the current revision (clean sheets)', () => {
  // Same page count and sheet names regardless of the filing's form version, so an
  // old filing does not surface the older form's messy sheet names / merged pages.
  const a = pagesForVersion(template, '2015-08-31').map((p) => p.sheet)
  const b = pagesForVersion(template, '2026-07-31').map((p) => p.sheet)
  assert.deepEqual(a, b)
})

test('Schedule 200 grid swaps to the 29-line layout for a 2015 filing', () => {
  const p2015 = pagesForVersion(template, '2015-08-31').find((p) => p.schedule === '200')
  const p2026 = pagesForVersion(template, '2026-07-31').find((p) => p.schedule === '200')
  // The 2015 form carries the retired account-724 "Allowances" line -> more rows.
  assert.ok(p2015.rows.length > p2026.rows.length,
    '2015 Schedule 200 should render more rows than 2026')
})

test('an unchanged schedule renders the same grid on both versions', () => {
  const a = pagesForVersion(template, '2015-08-31').find((p) => p.schedule === '240')
  const b = pagesForVersion(template, '2026-07-31').find((p) => p.schedule === '240')
  assert.equal(a.rows.length, b.rows.length)
})

test('resolveFormVersion reads the filing stamp, else defaults to the latest revision', () => {
  assert.equal(
    resolveFormVersion({ envelope: { form_metadata: { form_version: '2015-08-31' } } }, template),
    '2015-08-31')
  assert.equal(resolveFormVersion(null, template), template.default_version)
})
