import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { pagesForVersion } from './formVersion.js'
import { splitCombinedPages } from './pageSchedules.js'
import { extractedPagesForSource, initialSourcePage, linkedExtractedPage, selectedExtractedPage, sourceReviewUrl } from './sourceReview.js'

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

const linkedManifest = { page_count: 128, pages: [
  { page: 122, schedules: ['750'] },
  ...[123, 124, 125, 126].map((page) => ({ page, schedules: ['755'] })),
  { page: 127, schedules: [] }, { page: 128, schedules: ['Memoranda'] },
] }
const linkedPages = [
  { schedule: '750', sheet: '750' },
  ...[1, 2, 3, 4].map((n) => ({ schedule: '755', sheet: `755 page ${n}` })),
  { schedule: '755', sheet: 'Explanatory notes', notesFor: '755' },
  { schedule: 'Memoranda', sheet: 'Memoranda' },
]
function pairing(pageNo, previous = null, navPages = linkedPages, sourceManifest = linkedManifest) {
  const sourcePage = sourceManifest.pages.find((p) => p.page === pageNo)
  const choices = extractedPagesForSource(navPages, sourcePage)
  return { sourcePage, chosen: linkedExtractedPage(choices, sourceManifest, sourcePage, previous) }
}

test('linked Next and Previous move both panes within a multi-page schedule', () => {
  const first = pairing(123)
  const second = pairing(124, first)
  const third = pairing(125, second)
  assert.equal(first.chosen.page.sheet, '755 page 1')
  assert.equal(second.chosen.page.sheet, '755 page 2')
  assert.equal(third.chosen.page.sheet, '755 page 3')
  assert.equal(pairing(124, third).chosen.page.sheet, '755 page 2')
})

test('direct entry and source-page jumps use schedule order, not physical PDF numbers', () => {
  assert.equal(pairing(124).chosen.page.sheet, '755 page 2')
  const end = pairing(126, pairing(123))
  assert.equal(end.chosen.page.sheet, '755 page 4')
  assert.equal(pairing(123, end).chosen.page.sheet, '755 page 1')
})

test('manual pairing becomes the starting point for subsequent linked navigation', () => {
  const adjusted = pairing(124)
  adjusted.chosen = extractedPagesForSource(linkedPages, adjusted.sourcePage)[0]
  assert.equal(adjusted.chosen.page.sheet, '755 page 1')
  const next = pairing(125, adjusted)
  assert.equal(next.chosen.page.sheet, '755 page 2')
  assert.equal(pairing(124, next).chosen.page.sheet, '755 page 1')
})

test('crossing schedule boundaries selects the destination schedule in both directions', () => {
  const previousSchedule = pairing(122)
  assert.equal(pairing(123, previousSchedule).chosen.page.sheet, '755 page 1')
  assert.equal(pairing(122, pairing(123)).chosen.page.sheet, '750')
  assert.equal(pairing(126, pairing(128)).chosen.page.sheet, '755 page 4')
})

test('unmapped source pages clear the extraction and navigation resumes at the mapped page', () => {
  const gap = pairing(127, pairing(126))
  assert.equal(gap.chosen, null)
  assert.equal(pairing(128, gap).chosen.page.sheet, 'Memoranda')
  assert.equal(pairing(126, gap).chosen.page.sheet, '755 page 4')
})

test('unequal page counts stop at form boundaries without wrapping or entering explanatory notes', () => {
  const shorter = linkedPages.filter((p) => !['755 page 3', '755 page 4'].includes(p.sheet))
  const last = pairing(124, null, shorter)
  assert.equal(pairing(125, last, shorter).chosen.page.sheet, '755 page 2')
  assert.equal(pairing(126, null, shorter).chosen.page.sheet, '755 page 2')
  const adjusted = pairing(124)
  adjusted.chosen = extractedPagesForSource(linkedPages, adjusted.sourcePage)[0]
  assert.equal(pairing(123, adjusted).chosen.page.sheet, '755 page 1')
})

test('shared source pages continue the selected schedule rather than switching to its neighbor', () => {
  const shared = { pages: [
    { page: 1, schedules: ['200'] }, { page: 2, schedules: ['755'] },
    { page: 3, schedules: ['200', '755'] },
  ] }
  const nav = [{ schedule: '200', sheet: '200' }, ...linkedPages]
  const continued = pairing(3, pairing(2, null, nav, shared), nav, shared)
  assert.equal(continued.chosen.page.sheet, '755 page 2')
})

test('manual mode retains its selected page while that schedule remains available', () => {
  const current = pairing(124)
  const nextChoices = extractedPagesForSource(linkedPages, linkedManifest.pages[3])
  assert.equal(selectedExtractedPage(nextChoices, current.chosen.index).page.sheet, '755 page 2')
})

test('the real 755 template pairs PDF pages 123–126 with its four individual printed panels', () => {
  const template = JSON.parse(readFileSync(new URL('./formTemplate.json', import.meta.url), 'utf8'))
  const nav = splitCombinedPages(pagesForVersion(template, '2015-08-31'))
  let current = null
  for (const pageNo of [123, 124, 125, 126, 125, 124, 123]) {
    current = pairing(pageNo, current, nav)
    assert.equal(current.chosen.page.comparisonPanel, pageNo - 123)
    assert.equal(current.chosen.page.comparisonLabel, `755 · page ${pageNo - 122} of 4`)
  }
  assert.equal(pairing(124, null, nav).chosen.page.comparisonPanel, 1)
})
