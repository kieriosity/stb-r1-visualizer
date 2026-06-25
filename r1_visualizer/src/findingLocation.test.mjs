import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findingLineNo, anchorFindings, topSeverity } from './findingLocation.js'

test('findingLineNo reads a human "line N" from message or location', () => {
  assert.equal(findingLineNo({ message: 'Schedule 200 line 27 does not foot' }), 27)
  assert.equal(findingLineNo({ location: 'schedules.200 line 8' }), 8)
  assert.equal(findingLineNo({ location: 'schedules.200.line[12].column[F]' }), 12)
})

test('findingLineNo resolves a JSON-pointer array index to a line_no via the doc', () => {
  const doc = { schedules: { 200: { sections: [{ section_id: 'assets', lines: [
    { line_no: 1 }, { line_no: 2 }, { line_no: 3 }] }] } } }
  // sections/0/lines/2 -> the third line -> line_no 3
  assert.equal(
    findingLineNo({ schedule_id: '200', location: 'schedules/200/sections/0/lines/2/title' }, doc), 3)
})

test('findingLineNo returns null for a schedule-level finding', () => {
  assert.equal(findingLineNo({ location: 'schedules.200.sections' }), null)
  assert.equal(findingLineNo({ location: 'schedules.200.sections[assets].lines' }), null)
})

test('anchorFindings groups by line and separates schedule-level findings', () => {
  const findings = [
    { schedule_id: '200', severity: 'WARNING', message: 'line 5 foo' },
    { schedule_id: '200', severity: 'FATAL', message: 'line 5 bar' },
    { schedule_id: '200', severity: 'INFO', location: 'schedules.200' },
    { schedule_id: '210', severity: 'INFO', message: 'line 9' },
  ]
  const { byLine, scheduleLevel } = anchorFindings(findings, '200')
  assert.equal(byLine.get(5).length, 2)
  assert.equal(scheduleLevel.length, 1)
  assert.equal(topSeverity(byLine.get(5)), 'FATAL')
})
