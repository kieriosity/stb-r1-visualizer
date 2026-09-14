import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { captureIssueContext, saveIssue, submissionSnapshot } from './issueReport.js'

const sel = { carrier: 'BNSF', year: 2008, version: 2, file: 'bnsf/2008/stb-r1-bnsf-2008-v2.json' }
const page = { sheet: '755', schedule: '755', comparisonPanel: 1, comparisonLabel: '755 · page 2 of 4' }

test('capture preserves exact filing and both page selections when navigation later changes', () => {
  const context = captureIssueContext(sel, 'abc', page, '2015-08-31', { page: 124, binding: 'bound', imageReady: true, pageTogether: true })
  assert.equal(context.filing.version, 2)
  assert.equal(context.filing.output_sha256, 'abc')
  assert.equal(context.location.source_page, 124)
  assert.equal(context.location.source_binding, 'bound')
  assert.equal(context.location.extracted_page.panel, 2)
  assert.deepEqual(context.location.extracted_page.schedules, ['755'])
  assert.equal(context.location.page_together, true)
  const changed = { ...sel, version: 3 }
  captureIssueContext(changed, 'other', { ...page, comparisonPanel: 2 }, '2026-07-31')
  assert.equal(context.filing.version, 2)
  assert.equal(context.location.extracted_page.panel, 2)
})

test('unmapped PDF pages can be reported without inventing an extracted page', () => {
  const context = captureIssueContext(sel, 'abc', null, null, { page: 127, binding: 'bound' })
  assert.equal(context.location.source_page, 127)
  assert.equal(context.location.extracted_page, null)
  assert.equal(context.location.source_image_loaded, false)
})

test('ordinary form reports retain schedule context without pretending to know a PDF page', () => {
  const context = captureIssueContext(sel, 'abc', { sheet: 'Sch A and B' }, '2026-07-31')
  assert.equal(context.location.view, 'form')
  assert.equal(context.location.source_page, null)
  assert.equal(context.location.extracted_page.panel, null)
  assert.deepEqual(context.location.extracted_page.schedules, ['A', 'B'])
})

test('the snapshot digest binds the original response bytes, including formatting and Unicode', async () => {
  const raw = ' { "value": "é", "number": 1 }\n'
  const result = await submissionSnapshot(new Response(raw))
  assert.deepEqual(result.data, { value: 'é', number: 1 })
  assert.equal(result.sha256, createHash('sha256').update(raw).digest('hex'))
})

test('failed save retains the same request for a retry and surfaces the server error', async (t) => {
  const requests = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    requests.push({ url, ...init })
    return requests.length === 1 ? new Response(JSON.stringify({ message: 'Disk unavailable' }), { status: 500 })
      : new Response(JSON.stringify({ issue_id: 'same-id', file: '/issues/same-id.json' }), { status: 201 })
  })
  const request = { issue_id: 'same-id', summary: 'Missing value' }
  await assert.rejects(saveIssue('/issues', request), /Disk unavailable/)
  assert.equal((await saveIssue('/issues', request)).issue_id, 'same-id')
  assert.equal(requests[0].body, requests[1].body)
  assert.equal(requests[0].headers['Content-Type'], 'application/json')
})
