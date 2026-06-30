import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

import { analyzeColumns, indexData, isFillableMarker, resolveValue, selectBestValues } from './formData.js'
import { buildGridPanels } from './formGrid.js'

test('resolveValue reads nested matrix cell groups by dotted key path', () => {
  const cells = {
    owned_and_used: {
      depreciation_base_beginning_of_year: 12297505,
      depreciation_base_close_of_year: 12392547,
      annual_composite_rate: 0.0105,
    },
  }

  assert.equal(resolveValue(cells, 'owned_and_used.depreciation_base_beginning_of_year'), 12297505)
  assert.equal(resolveValue(cells, 'owned_and_used.annual_composite_rate'), 0.0105)
})

test('resolveValue falls back to direct flat keys for older matrix cells', () => {
  const cells = {
    owned_and_used_depr_base_1_1_at_begin_of: 6757982,
  }

  assert.equal(resolveValue(cells, 'owned_and_used_depr_base_1_1_at_begin_of'), 6757982)
})

test('indexData preserves duplicate line numbers for later header-band selection', () => {
  const schedule = {
    sections: [
      {
        lines: [
          { line_no: 3, values: { amount: null }, title: 'Excess Profits' },
          {
            line_no: 3,
            values: {
              beginning_of_year_balance: -237504,
              net_credits_for_current_year: -25245,
              end_of_year_balance: -262749,
            },
            title: 'Accelerated amortization of rolling stock',
          },
        ],
      },
    ],
  }

  const data = indexData(schedule, '450', { 450: { valueKey: 'values' } })
  const candidates = data.byLine.get('3')

  assert.equal(candidates.length, 2)
  assert.equal(selectBestValues(candidates, ['amount']), candidates[0])
  assert.equal(selectBestValues(candidates, ['beginning_of_year_balance', 'end_of_year_balance']), candidates[1])
})

test('selectBestValues scores nested key paths when duplicate records exist', () => {
  const candidates = [
    {
      owned_and_used: {
        depreciation_base_beginning_of_year: null,
        depreciation_base_close_of_year: null,
      },
    },
    {
      leased_from_others: {
        depreciation_base_beginning_of_year: 25,
        depreciation_base_close_of_year: 30,
      },
    },
  ]

  const selected = selectBestValues(candidates, [
    'leased_from_others.depreciation_base_beginning_of_year',
    'leased_from_others.depreciation_base_close_of_year',
  ])

  assert.equal(selected, candidates[1])
})

test('N/A and blocked template markers are not fillable value placeholders', () => {
  assert.equal(isFillableMarker('N/A'), false)
  assert.equal(isFillableMarker('XXXXXX'), false)
  assert.equal(isFillableMarker('(   )'), true)
  assert.equal(isFillableMarker('-'), true)
})

test('analyzeColumns excludes cross-check columns when mapping nested schedule 414 groups', () => {
  const template = JSON.parse(fs.readFileSync(new URL('./formTemplate.json', import.meta.url), 'utf8'))
  const specs = JSON.parse(fs.readFileSync(new URL('./columnSpec.json', import.meta.url), 'utf8'))
  const page = template.pages.find((p) => p.schedule === '414')
  const { rowMaps } = analyzeColumns(page, '414', specs)
  const firstDataMap = rowMaps.find((map) => map?.size)

  assert.equal(firstDataMap.has(2), false)
  assert.equal(firstDataMap.get(4), 'gross_amounts_receivable_per_diem_basis.private_line_cars_b')
  assert.equal(firstDataMap.get(5), 'gross_amounts_receivable_per_diem_basis.mileage_c')
  assert.equal(firstDataMap.get(6), 'gross_amounts_receivable_per_diem_basis.time_d')
  assert.equal(firstDataMap.get(7), 'gross_amounts_payable_per_diem_basis.private_line_cars_e')
  assert.equal(firstDataMap.get(8), 'gross_amounts_payable_per_diem_basis.mileage_f')
  assert.equal(firstDataMap.get(9), 'gross_amounts_payable_per_diem_basis.time_g')
})

test('analyzeColumns keeps schedule 710 mappings after N/A continuation rows', () => {
  const template = JSON.parse(fs.readFileSync(new URL('./formTemplate.json', import.meta.url), 'utf8'))
  const specs = JSON.parse(fs.readFileSync(new URL('./columnSpec.json', import.meta.url), 'utf8'))
  const page = template.pages.find((p) => p.schedule === '710')
  const lowerPanel = buildGridPanels(page).find((panel) => panel.rowStart > 0)
  const { rowMaps, lineCol } = analyzeColumns(lowerPanel, '710', specs)

  const line30Index = lowerPanel.rows.findIndex((row) =>
    row.cells.some((cell) => cell.c === lineCol && cell.t === '30'))
  const line35Index = lowerPanel.rows.findIndex((row) =>
    row.cells.some((cell) => cell.c === lineCol && cell.t === '35'))

  assert.equal(rowMaps[line30Index].get(14), 'agg_cap_of_units_reported_in_col')
  assert.equal(rowMaps[line35Index].get(14), 'agg_cap_of_units_reported_in_col')
})

test('analyzeColumns maps schedule 310 facing-page columns past instruction prose', () => {
  // The continued page (27) prints numbered instructions above the table, one of
  // which reads "...names and extent of control...". A blank row separates that
  // prose from the real column-header band; without that separation the Opening
  // Balance column mis-mapped to extent_of_control. Both facing financial panels
  // must map opening_balance, and both identity panels must map issuer_name.
  const template = JSON.parse(fs.readFileSync(new URL('./formTemplate.json', import.meta.url), 'utf8'))
  const specs = JSON.parse(fs.readFileSync(new URL('./columnSpec.json', import.meta.url), 'utf8'))
  const page = template.pages.find((p) => p.schedule === '310')
  const maps = buildGridPanels(page).map((panel) => {
    const { rowMaps } = analyzeColumns(panel, '310', specs)
    return new Map([...(rowMaps.find((m) => m?.size) || new Map())].map(([c, k]) => [k, c]))
  })
  const financial = maps.filter((m) => m.has('opening_balance'))
  const identity = maps.filter((m) => m.has('issuer_name_and_lien_reference'))
  assert.equal(financial.length, 2)
  assert.equal(identity.length, 2)
  for (const m of financial) assert.equal(m.has('extent_of_control'), false)
})

test('indexData keys paginated records by (block, source_line_no)', () => {
  const schedule = {
    items: [
      { line_no: 1, block: 0, source_line_no: 1, fields: { opening_balance: 1445 } },
      { line_no: 28, block: 1, source_line_no: 1, fields: { opening_balance: -500 } },
    ],
  }
  const data = indexData(schedule, '310', { 310: { valueKey: 'fields' } })
  assert.deepEqual(data.blocks, [0, 1])
  assert.equal(data.byBlockLine.get('0:1')[0].opening_balance, 1445)
  assert.equal(data.byBlockLine.get('1:1')[0].opening_balance, -500)
})
