import assert from 'node:assert/strict'
import test from 'node:test'

import { formatValue } from './util.js'

test('formatValue renders accounting zero as a dash', () => {
  assert.equal(formatValue(0), '-')
  assert.equal(formatValue(1500), '1,500')
  assert.equal(formatValue(-1500), '(1,500)')
})

test('formatValue shows decimals as stored, never rounded', () => {
  // Schedule 332's annual composite rates (BNSF 2019 line 1: 0.0105, not 0.011).
  assert.equal(formatValue(0.0105), '0.0105')
  assert.equal(formatValue(0.0286), '0.0286')
  assert.equal(formatValue(-0.0105), '(0.0105)')
  assert.equal(formatValue(1234567.25), '1,234,567.25')
})
