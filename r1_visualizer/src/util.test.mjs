import assert from 'node:assert/strict'
import test from 'node:test'

import { formatValue } from './util.js'

test('formatValue renders accounting zero as a dash', () => {
  assert.equal(formatValue(0), '-')
  assert.equal(formatValue(1500), '1,500')
  assert.equal(formatValue(-1500), '(1,500)')
})
