import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findingCountsByPage,
  findingsForPage,
  normalizeReviewFindings,
} from './reviewFindings.js'

const raw = {
  findings: [
    {
      carrier: 'BNSF',
      year: 2025,
      version: 1,
      schedule_id: '410',
      severity: 'WARNING',
      rule_id: 'VR-A',
      message: 'Line 12 does not foot',
    },
    {
      carrier: 'BNSF',
      year: 2025,
      version: 1,
      schedule_id: '410',
      severity: 'FATAL',
      rule_id: 'VR-B',
      message: 'Required value is missing',
    },
    {
      carrier: 'BNSF',
      year: 2025,
      version: 1,
      schedule_id: '200',
      severity: 'INFO',
      rule_id: 'VR-C',
      message: 'FYI',
    },
    {
      carrier: 'BNSF',
      year: 2025,
      version: 2,
      schedule_id: '410',
      severity: 'FATAL',
      rule_id: 'VR-OLD',
      message: 'Wrong version',
    },
  ],
}

test('findingsForPage returns selected submission findings for the active schedule', () => {
  const findings = normalizeReviewFindings(raw)
  const selected = { carrier: 'BNSF', year: 2025, version: 1 }
  const page = { schedule: '410', sheet: '410' }

  const pageFindings = findingsForPage(findings, selected, page)

  assert.deepEqual(pageFindings.map((f) => f.rule_id), ['VR-B', 'VR-A'])
  assert.equal(pageFindings[0].severity, 'FATAL')
  assert.equal(pageFindings[1].message, 'Line 12 does not foot')
})

test('findingCountsByPage counts findings on their corresponding schedule pages', () => {
  const findings = normalizeReviewFindings(raw)
  const selected = { carrier: 'BNSF', year: 2025, version: 1 }
  const pages = [
    { sheet: 'Title' },
    { sheet: '200', schedule: '200' },
    { sheet: '410', schedule: '410' },
  ]

  assert.deepEqual(findingCountsByPage(pages, findings, selected), {
    1: 1,
    2: 2,
  })
})

test('findings map to narrative schedules carried by combined template pages', () => {
  const findings = normalizeReviewFindings({
    findings: [
      {
        carrier: 'BNSF',
        year: 2025,
        version: 1,
        schedule_id: 'B',
        severity: 'WARNING',
        rule_id: 'VR-B',
        message: 'Schedule B issue',
      },
      {
        carrier: 'BNSF',
        year: 2025,
        version: 1,
        schedule_id: 'C',
        severity: 'WARNING',
        rule_id: 'VR-C',
        message: 'Schedule C issue',
      },
    ],
  })
  const selected = { carrier: 'BNSF', year: 2025, version: 1 }
  const pages = [
    { sheet: 'Sch A and B' },
    { sheet: 'Sch C' },
  ]

  assert.deepEqual(
    findingsForPage(findings, selected, pages[0]).map((finding) => finding.rule_id),
    ['VR-B'])
  assert.deepEqual(findingCountsByPage(pages, findings, selected), {
    0: 1,
    1: 1,
  })
})
