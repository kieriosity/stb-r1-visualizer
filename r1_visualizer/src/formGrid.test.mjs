import assert from 'node:assert/strict'
import test from 'node:test'

import { buildGridPanels, layoutRow } from './formGrid.js'

test('center-continuous cells stop at the visual right border before trailing columns', () => {
  const row = {
    cells: [
      { c: 0, t: 'Schedule title', ha: 'cc', bd: 'tl' },
      { c: 1, ha: 'cc', bd: 't' },
      { c: 2, ha: 'cc', bd: 'tr' },
    ],
  }

  const cells = layoutRow(row, 4)

  assert.equal(cells[0].span, 3)
  assert.equal(cells[0].bd, 'tlr')
  assert.equal(cells[1].c, 3)
  assert.equal(cells[1].span, 1)
  assert.equal(cells[1].bd, undefined)
})

test('center-continuous cells include the last grid column when its right border is the frame edge', () => {
  const row = {
    cells: [
      { c: 0, t: 'Schedule title', ha: 'cc', bd: 'tl' },
      { c: 1, ha: 'cc', bd: 't' },
      { c: 2, ha: 'cc', bd: 'tr' },
    ],
  }

  const cells = layoutRow(row, 3)

  assert.equal(cells[0].span, 3)
  assert.equal(cells[0].bd, 'tlr')
})

test('grid panels trim sparse trailing columns beyond the dominant page frame', () => {
  const page = {
    cols: [1, 1, 1, 8],
    rows: [
      { cells: [{ c: 0, bd: 'l' }, { c: 2, bd: 'r' }] },
      { cells: [{ c: 0, bd: 'l' }, { c: 2, bd: 'r' }] },
      {
        cells: [
          { c: 0, t: 'Title', ha: 'cc', bd: 'tl' },
          { c: 1, bd: 't' },
          { c: 2, bd: 'tr' },
          { c: 3, t: 'Stray footer' },
        ],
      },
    ],
  }

  const panels = buildGridPanels(page)

  assert.equal(panels.length, 1)
  assert.deepEqual(panels[0].cols, [1, 1, 1])
  assert.equal(panels[0].rows[2].cells.some((cell) => cell.sourceC === 3), false)
})

test('grid panels split side-by-side printed pages and row page breaks in reading order', () => {
  const page = {
    cols: [1, 1, 1, 1, 1, 1],
    rowBreaks: [2],
    rows: [
      {
        cells: [
          { c: 0, t: 'A1', bd: 'tl' },
          { c: 2, bd: 'tr' },
          { c: 3, t: 'B1', bd: 'tl' },
          { c: 5, bd: 'tr' },
        ],
      },
      {
        cells: [
          { c: 0, bd: 'bl' },
          { c: 2, bd: 'br' },
          { c: 3, bd: 'bl' },
          { c: 5, bd: 'br' },
        ],
      },
      {
        cells: [
          { c: 0, t: 'A2', bd: 'tl' },
          { c: 2, bd: 'tr' },
          { c: 3, t: 'B2', bd: 'tl' },
          { c: 5, bd: 'tr' },
        ],
      },
      {
        cells: [
          { c: 0, bd: 'bl' },
          { c: 2, bd: 'br' },
          { c: 3, bd: 'bl' },
          { c: 5, bd: 'br' },
        ],
      },
    ],
  }

  const panels = buildGridPanels(page)

  assert.equal(panels.length, 4)
  assert.deepEqual(panels.map((panel) => panel.rows[0].cells[0].t), ['A1', 'B1', 'A2', 'B2'])
  assert.deepEqual(panels.map((panel) => panel.cols.length), [3, 3, 3, 3])
  assert.deepEqual(panels.map((panel) => panel.rows[0].sourceIndex), [0, 0, 2, 2])
})

test('side-by-side grid panels share the widest printed page width', () => {
  const page = {
    cols: [4, 4, 4, 2, 2, 2],
    rows: [
      {
        cells: [
          { c: 0, t: 'Wide', bd: 'tl' },
          { c: 2, bd: 'tr' },
          { c: 3, t: 'Narrow', bd: 'tl' },
          { c: 5, bd: 'tr' },
        ],
      },
      {
        cells: [
          { c: 0, bd: 'bl' },
          { c: 2, bd: 'br' },
          { c: 3, bd: 'bl' },
          { c: 5, bd: 'br' },
        ],
      },
    ],
  }

  const panels = buildGridPanels(page)

  assert.deepEqual(panels.map((panel) => panel.cols.reduce((sum, width) => sum + width, 0)), [12, 6])
  assert.deepEqual(panels.map((panel) => panel.widthUnits), [12, 12])
})

test('right-aligned report footers span empty cells to avoid border overlap', () => {
  const row = {
    cells: [
      { c: 0, bd: 'bl' },
      { c: 1, bd: 'b' },
      { c: 2, t: 'Railroad Annual Report R-1', bd: 'br', ha: 'r' },
    ],
  }

  const cells = layoutRow(row, 3)

  assert.equal(cells.length, 1)
  assert.equal(cells[0].c, 0)
  assert.equal(cells[0].span, 3)
  assert.equal(cells[0].t, 'Railroad Annual Report R-1')
  assert.equal(cells[0].ha, 'r')
  assert.equal(cells[0].bd, 'blr')
})

test('wrapped instruction text spans adjacent blank cells to align like list text', () => {
  const row = {
    cells: [
      { c: 0, t: '3.', bd: 'l', ha: 'c' },
      { c: 1, t: 'Any inconsistency between credits should be explained.', bd: 'r', ha: 'l', w: 1 },
      { c: 5, bd: 'r' },
    ],
  }

  const cells = layoutRow(row, 6)

  assert.equal(cells.length, 2)
  assert.equal(cells[0].t, '3.')
  assert.equal(cells[0].span, 1)
  assert.equal(cells[1].c, 1)
  assert.equal(cells[1].span, 5)
  assert.equal(cells[1].t, 'Any inconsistency between credits should be explained.')
  assert.equal(cells[1].bd, 'r')
})

test('unwrapped numbered instruction text spans to the page border', () => {
  const row = {
    cells: [
      { c: 0, t: '2.', bd: 'l', ha: 'c' },
      { c: 1, t: 'The total depreciation expense should balance to the schedule total.' },
      { c: 5, bd: 'r' },
    ],
  }

  const cells = layoutRow(row, 6)

  assert.equal(cells.length, 2)
  assert.equal(cells[0].t, '2.')
  assert.equal(cells[0].span, 1)
  assert.equal(cells[1].c, 1)
  assert.equal(cells[1].span, 5)
  assert.equal(cells[1].t, 'The total depreciation expense should balance to the schedule total.')
  assert.equal(cells[1].bd, 'r')
  assert.equal(cells[1].w, 1)
})

test('unwrapped instruction continuation lines stay inside the page border', () => {
  const row = {
    cells: [
      { c: 0, t: 'column (f), lines 136, 137, and 138.', bd: 'l' },
      { c: 5, bd: 'r' },
    ],
  }

  const cells = layoutRow(row, 6)

  assert.equal(cells.length, 1)
  assert.equal(cells[0].c, 0)
  assert.equal(cells[0].span, 6)
  assert.equal(cells[0].t, 'column (f), lines 136, 137, and 138.')
  assert.equal(cells[0].bd, 'lr')
  assert.equal(cells[0].w, 1)
})

test('instruction continuation lines can align under numbered list text', () => {
  const row = {
    cells: [
      { c: 0, t: 'column (f), lines 136, 137, and 138.', bd: 'l' },
      { c: 5, bd: 'r' },
    ],
  }

  const cells = layoutRow(row, 6, { continuationTextCol: 1 })

  assert.equal(cells.length, 2)
  assert.equal(cells[0].c, 0)
  assert.equal(cells[0].span, 1)
  assert.equal(cells[0].t, undefined)
  assert.equal(cells[0].bd, 'l')
  assert.equal(cells[1].c, 1)
  assert.equal(cells[1].span, 5)
  assert.equal(cells[1].t, 'column (f), lines 136, 137, and 138.')
  assert.equal(cells[1].bd, 'r')
  assert.equal(cells[1].w, 1)
})
