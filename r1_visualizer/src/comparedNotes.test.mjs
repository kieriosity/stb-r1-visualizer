import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { notesForComparedPage } from './comparedNotes.js'
import { pagesForVersion } from './formVersion.js'

const template = JSON.parse(readFileSync(new URL('./formTemplate.json', import.meta.url)))
const fixture = JSON.parse(readFileSync(new URL('./fixtures/soo-2007-notes.json', import.meta.url)))
const form = (version, comparisonPanel) => ({
  ...pagesForVersion(template, version).find((p) => p.schedule === '200'), comparisonPanel,
})

test('SOO 2007 question text associates six notes with the questionnaire, then the next two', () => {
  for (const version of template.form_versions) {
    assert.deepEqual(notesForComparedPage(form(version, 2), fixture),
      { isNotesPage: true, matching: [0, 1, 2, 3, 4, 5] })
    assert.deepEqual(notesForComparedPage(form(version, 3), fixture),
      { isNotesPage: true, matching: [6, 7] })
    assert.deepEqual(notesForComparedPage(form(version, 0), fixture),
      { isNotesPage: false, matching: [] })
  }
})

test('unmapped continuation pages leave every note available without assigning note numbers to pages', () => {
  assert.deepEqual(notesForComparedPage(form('2015-08-31', 4), fixture),
    { isNotesPage: true, matching: [] })
  const unrelated = { explanatory_notes: [{ note_id: 'N1', text: 'Unrelated disclosure' }] }
  assert.deepEqual(notesForComparedPage(form('2015-08-31', 2), unrelated).matching, [])
})

test('repeated IDs and repeated text preserve distinct blocks and source order without mutation', () => {
  const schedule = { explanatory_notes: [fixture.explanatory_notes[2],
    { ...fixture.explanatory_notes[0], note_id: 'N3' }, fixture.explanatory_notes[2]] }
  const before = structuredClone(schedule)
  assert.deepEqual(notesForComparedPage(form('2015-08-31', 2), schedule).matching, [0, 1, 2])
  assert.deepEqual(schedule, before)
})

test('missing or invalid panel selections do not match notes', () => {
  for (const page of [undefined, {}, form('2015-08-31', -1), form('2015-08-31', 999)]) {
    assert.deepEqual(notesForComparedPage(page, fixture), { isNotesPage: false, matching: [] })
  }
})
