import assert from 'node:assert/strict'
import test from 'node:test'

import { describeFiling, describeSchedule, lineageUrl, ocrPageUrl, profileLabel } from './lineage.js'

const lineage = {
  source_profile: 'scanned_pdf_ocr',
  input_file: 'R1-BNSF-2008.pdf',
  input_sha256: 'ab'.repeat(32),
  pipeline_version: '0.2.0',
  pipeline_git_sha: '0123456789abcdef',
  mapping_confidence_overall: 0.6994,
  schedule_coverage: 0.807,
  ocr: { model: 'mistral-ocr-latest', page_count: 131, cache_hit: true, cache_key: 'ab'.repeat(32) },
  schedule_states: { 330: 'present', 410: 'missing' },
  schedule_provenance: {
    330: {
      sources: [{ sheet: '61', page: 61 }, { sheet: '62', page: 62 }],
      routing_method: 'banner', routing_score: 0.9, confidence: 0.9, extracted_rows: 86,
      fidelity: { capture_rate: 0.96, tier_a_missed: 2, tier_a_values: [1234, 5.5] },
    },
    A: { sources: [{ member: '2025 Sch A.xlsx', row_range: [3, 40] }], routing_method: 'name_pattern',
         routing_score: 0.9, confidence: 1, extracted_rows: 0 },
  },
  transformations: { 330: { MATRIX_TITLE_CANONICALIZED: 1 } },
}

test('lineageUrl and ocrPageUrl build host endpoints', () => {
  assert.equal(lineageUrl('/viewer/lineage/', { carrier: 'BNSF', year: 2008, version: 1 }),
    '/viewer/lineage/bnsf/2008/1.json')
  assert.equal(lineageUrl(null, { carrier: 'BNSF', year: 2008, version: 1 }), null)
  assert.equal(ocrPageUrl('/viewer/ocr-page', lineage, 61),
    `/viewer/ocr-page?key=${'ab'.repeat(32)}&page=61`)
  assert.equal(ocrPageUrl('/viewer/ocr-page', { ocr: null }, 61), null)
})

test('describeSchedule flattens sources, routing, confidence and fidelity', () => {
  const d = describeSchedule(lineage, '330')
  assert.deepEqual(d.sources, [{ label: 'page 61', page: 61 }, { label: 'page 62', page: 62 }])
  assert.equal(d.routing, 'banner (0.90)')
  assert.equal(d.confidenceLabel, '0.90')
  assert.equal(d.captureLabel, '96%')
  assert.equal(d.tierAMissed, 2)
  assert.deepEqual(d.tierAValues, [1234, 5.5])
  assert.equal(d.extractedRows, 86)
  assert.deepEqual(d.transformations, { MATRIX_TITLE_CANONICALIZED: 1 })
  assert.equal(d.state, 'present')
  const a = describeSchedule(lineage, 'A')
  assert.deepEqual(a.sources, [{ label: 'member 2025 Sch A.xlsx rows 3-40', page: null }])
  assert.equal(a.captureLabel, null)
  assert.equal(describeSchedule(lineage, '999'), null)
  assert.equal(describeSchedule(null, '330'), null)
})

test('describeFiling lists profile, identity and OCR run', () => {
  const items = Object.fromEntries(describeFiling(lineage))
  assert.equal(items['Source profile'], 'Scanned PDF read by OCR (2005-2012)')
  assert.equal(items['Confidence'], '0.70')
  assert.equal(items['Schedule coverage'], '81%')
  assert.equal(items['Pipeline'], '0.2.0 @01234567')
  assert.equal(items['OCR'], 'mistral-ocr-latest, 131 pages (cached)')
  assert.deepEqual(describeFiling(null), [])
  assert.equal(profileLabel('nope'), 'nope')
  assert.equal(profileLabel(''), 'not recorded')
})
