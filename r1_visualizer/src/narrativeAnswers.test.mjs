import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchAnswers, injectAnswers, answerText } from './narrativeAnswers.js'

const page = {
  rows: [
    { cells: [{ c: 0, t: '1.' }, { c: 1, t: 'Exact name:' }] },
    { cells: [{ c: 0, t: '2.' }, { c: 1, t: 'Date:' }] },
    { cells: [{ c: 1, t: 'instructions, not an inquiry line' }] },
  ],
}
const schedule = {
  answers: {
    Q1: { answer_type: 'text', text: 'BNSF Railway Company' },
    Q2: { answer_type: 'date', date: '1961-01-13' },
    Q9: { answer_type: 'text', text: 'no matching inquiry row' },
  },
}

test('matchAnswers pins each answer to its inquiry row by number', () => {
  const { rowAnswers, matchedKeys } = matchAnswers(page, schedule)
  assert.equal(rowAnswers[0], 'BNSF Railway Company')
  assert.equal(rowAnswers[1], '1961-01-13')
  assert.deepEqual([...matchedKeys].sort(), ['Q1', 'Q2']) // Q9 has no inquiry line -> stays in panel
})

test('injectAnswers appends the answer to the prompt cell without mutating the page', () => {
  const { rowAnswers } = matchAnswers(page, schedule)
  const out = injectAnswers(page, rowAnswers)
  const filled = out.rows[0].cells.find((c) => c.c === 1).t
  assert.ok(filled.includes('Exact name:') && filled.includes('BNSF Railway Company'))
  assert.equal(page.rows[0].cells.find((c) => c.c === 1).t, 'Exact name:')
})

test('answerText renders each answer type', () => {
  assert.equal(answerText({ answer_type: 'not_applicable' }), 'Not applicable')
  assert.equal(answerText({ answer_type: 'text_list', text_list: ['a', 'b'] }), 'a; b')
  assert.equal(answerText({ answer_type: 'date', date: '2013-01-01' }), '2013-01-01')
})
