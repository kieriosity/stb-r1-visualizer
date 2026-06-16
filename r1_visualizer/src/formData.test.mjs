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
