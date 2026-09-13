import assert from 'node:assert/strict'
import test from 'node:test'
import { extractedPagesForSource, initialSourcePage, selectedExtractedPage, sourceReviewUrl } from './sourceReview.js'

const manifest = { page_count: 126, pages: [
  { page: 1, schedules: [] }, { page: 16, schedules: ['200'] },
  { page: 123, schedules: ['755'] }, { page: 124, schedules: ['755', '750'] },
] }
const pages = [{ schedule: '200', sheet: 'Assets' }, { schedule: '755', sheet: '755 first' },
  { schedule: '755', sheet: '755 continued' }, { schedule: '750', sheet: '750' }]

test('source page numbers do not masquerade as canonical page indexes', () => {
  assert.equal(initialSourcePage(manifest, '755'), 123)
  assert.equal(initialSourcePage(manifest, '755', '124'), 124)
  assert.equal(initialSourcePage(manifest, '755', '999'), 123)
  assert.equal(initialSourcePage(manifest, 'missing'), 1)
})
test('multi-page schedules and shared source pages retain every associated choice', () => {
  const choices = extractedPagesForSource(pages, manifest.pages[3])
  assert.deepEqual(choices.map((p) => p.index), [1, 2, 3])
  assert.equal(selectedExtractedPage(choices, 2).index, 2)
  assert.equal(selectedExtractedPage(choices, 0).index, 1)
})
test('an unmapped source page clears the prior extraction instead of showing stale data', () => {
  const choices = extractedPagesForSource(pages, manifest.pages[0])
  assert.equal(selectedExtractedPage(choices, 2), null)
  assert.deepEqual(extractedPagesForSource(pages, undefined), [])
})
test('source requests bind to the selected carrier, year, and amendment version', () => {
  assert.equal(sourceReviewUrl('/viewer/source/', { carrier: 'BNSF', year: 2008, version: 2 }), '/viewer/source/bnsf/2008/2')
  assert.equal(sourceReviewUrl(null, null), null)
})

test('a multi-page template gets individual choices without losing grid/block context', () => {
  const rows = [{ cells: [{ c: 0, t: '1' }] }, { cells: [{ c: 0, t: '2' }] }]
  const grid = { schedule: '755', sheet: '755', cols: [10], rows, rowBreaks: [1] }
  const choices = extractedPagesForSource([grid], { schedules: ['755'] })
  assert.equal(choices.length, 2)
  assert.deepEqual(choices.map((p) => p.page.comparisonPanel), [0, 1])
  assert.equal(choices[1].page.comparisonLabel, '755 · page 2 of 2')
  assert.equal(choices[1].page.rows, rows)
  assert.deepEqual(choices[1].page.rowBreaks, [1])
})
