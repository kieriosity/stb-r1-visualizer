import assert from 'node:assert/strict'
import test from 'node:test'

import {
  navScheduleLabel,
  pageHasData,
  pageMatchesSchedule,
  scheduleIdsForPage,
} from './pageSchedules.js'

test('template pages can map to multiple submitted schedules', () => {
  assert.deepEqual(scheduleIdsForPage({ sheet: 'Sch A and B' }), ['A', 'B'])
  assert.deepEqual(scheduleIdsForPage({ sheet: 'Sch C' }), ['C'])
  assert.deepEqual(scheduleIdsForPage({ sheet: '410', schedule: '410' }), ['410'])
})

test('page schedule mapping supports deep links and data indicators', () => {
  const dataSchedules = new Set(['B', 'C'])

  assert.equal(pageMatchesSchedule({ sheet: 'Sch A and B' }, 'B'), true)
  assert.equal(pageMatchesSchedule({ sheet: 'Sch A and B' }, 'C'), false)
  assert.equal(pageHasData({ sheet: 'Sch A and B' }, dataSchedules), true)
  assert.equal(pageHasData({ sheet: 'Sch C' }, dataSchedules), true)
})

test('navigation label shows mapped narrative schedules', () => {
  assert.equal(navScheduleLabel({ sheet: 'Sch A and B' }), 'A/B')
  assert.equal(navScheduleLabel({ sheet: 'Sch C' }), 'C')
  assert.equal(navScheduleLabel({ sheet: 'Title' }), '—')
})
