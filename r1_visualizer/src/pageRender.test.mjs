import assert from 'node:assert/strict'
import test from 'node:test'

import { shouldRenderFacsimile } from './pageRender.js'

test('title and cover pages render only the filled data form', () => {
  assert.equal(shouldRenderFacsimile({ sheet: 'Title' }), false)
  assert.equal(shouldRenderFacsimile({ sheet: 'Cover' }), false)
})

test('ordinary schedules still render the printed facsimile', () => {
  assert.equal(shouldRenderFacsimile({ sheet: '410', schedule: '410' }), true)
  assert.equal(shouldRenderFacsimile({ sheet: 'Verification' }), true)
})
