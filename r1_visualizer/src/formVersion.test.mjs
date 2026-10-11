import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pagesForVersion, resolveFormVersion } from './formVersion.js'

const template = JSON.parse(readFileSync(new URL('./formTemplate.json', import.meta.url)))

test('the page list is version-specific: legacy schedules only on the old form', () => {
  // A page tagged with form_versions appears only on a matching filing: the retired
  // pre-2016 schedules (230, 339, ...) show for a 2015 filing, the current-only
  // schedule 210A shows for a 2026 filing, and front matter shows on both.
  const s2015 = new Set(pagesForVersion(template, '2015-08-31').map((p) => p.schedule))
  const s2026 = new Set(pagesForVersion(template, '2026-07-31').map((p) => p.schedule))
  for (const legacy of ['230', '339', '350', '460', '726']) {
    assert.ok(s2015.has(legacy), `${legacy} should appear for a 2015 filing`)
    assert.ok(!s2026.has(legacy), `${legacy} should not appear for a 2026 filing`)
  }
  assert.ok(s2026.has('210A') && !s2015.has('210A'))
  assert.ok(s2015.has('200') && s2026.has('200'))   // shared schedule on both
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
