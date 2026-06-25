// Helpers for rendering the extracted Excel grid. Kept separate from the Preact
// component so border/span behavior can be tested without a DOM renderer.

// Pixels per Excel column-width unit - the single scale that turns the form's
// column widths into on-screen pixels. Shared so the filled-data panel can match
// the facsimile's exact width (and so a width tweak lives in one place).
export const PX_PER_UNIT = 7.6

const DOMINANT_EDGE_RATIO = 0.9

// The rendered facsimile width (px) for a page: the widest printable panel. Lets
// the filled-data panel above the facsimile line up to the same width as the form.
export function pageWidthPx(page) {
  if (!page) return 0
  const panels = buildGridPanels(page)
  const units = Math.max(0, ...panels.map((panel) => sum(panel.cols)))
  return Math.round(units * PX_PER_UNIT)
}

export function buildGridPanels(page) {
  const colBands = inferColumnBands(page)
  const rowBands = inferRowBands(page)
  const panels = []
  for (const [rowStart, rowEnd] of rowBands) {
    for (const [colStart, colEnd] of colBands) {
      panels.push(slicePanel(page, rowStart, rowEnd, colStart, colEnd))
    }
  }
  const widthUnits = Math.max(...panels.map((panel) => sum(panel.cols)), 0)
  return panels.map((panel) => ({ ...panel, widthUnits }))
}

function inferRowBands(page) {
  const breaks = [...new Set(page.rowBreaks || [])]
    .filter((n) => Number.isInteger(n) && n > 0 && n < page.rows.length)
    .sort((a, b) => a - b)
  const starts = [0, ...breaks]
  const ends = [...breaks, page.rows.length]
  return starts.map((start, i) => [start, ends[i]]).filter(([start, end]) => start < end)
}

function inferColumnBands(page) {
  const nCols = page.cols.length
  if (nCols <= 1) return [[0, Math.max(0, nCols - 1)]]

  const rowCount = Math.max(1, page.rows.length)
  const rightCounts = new Array(nCols).fill(0)
  const splitCounts = new Array(nCols - 1).fill(0)

  for (const row of page.rows) {
    const byCol = new Map(row.cells.map((cell) => [cell.c, cell]))
    for (let c = 0; c < nCols; c++) {
      if (byCol.get(c)?.bd?.includes('r')) rightCounts[c]++
    }
    for (let seam = 0; seam < nCols - 1; seam++) {
      if (byCol.get(seam)?.bd?.includes('r') && byCol.get(seam + 1)?.bd?.includes('l')) {
        splitCounts[seam]++
      }
    }
  }

  const dominantRightEdges = rightCounts
    .map((count, col) => ({ col, ratio: count / rowCount }))
    .filter(({ ratio }) => ratio >= DOMINANT_EDGE_RATIO)
    .map(({ col }) => col)
  const outerEnd = dominantRightEdges.length ? dominantRightEdges[dominantRightEdges.length - 1] : nCols - 1
  const strongSplits = splitCounts
    .map((count, seam) => ({ seam, ratio: count / rowCount }))
    .filter(({ seam, ratio }) => seam < outerEnd && ratio >= DOMINANT_EDGE_RATIO)
    .map(({ seam }) => seam)

  const splits = strongSplits.length === 1 ? strongSplits : []
  const bands = []
  let start = 0
  for (const edge of [...splits, outerEnd]) {
    if (edge >= start) bands.push([start, edge])
    start = edge + 1
  }
  return bands.length ? bands : [[0, nCols - 1]]
}

function slicePanel(page, rowStart, rowEnd, colStart, colEnd) {
  return {
    colStart,
    rowStart,
    cols: page.cols.slice(colStart, colEnd + 1),
    rows: page.rows.slice(rowStart, rowEnd).map((row, i) => ({
      ...row,
      sourceIndex: rowStart + i,
      cells: row.cells
        .filter((cell) => cell.c >= colStart && cell.c <= colEnd)
        .map((cell) => ({ ...cell, sourceC: cell.c, c: cell.c - colStart })),
    })),
  }
}

export function layoutRows(rows, nCols) {
  let continuationTextCol = null
  return rows.map((row) => {
    const byCol = new Map(row.cells.map((c) => [c.c, c]))
    const listTextCol = instructionListTextCol(byCol, nCols)
    const shouldIndentContinuation =
      continuationTextCol != null && instructionContinuationRow(byCol, nCols, continuationTextCol)
    const laidOut = layoutRow(row, nCols, {
      continuationTextCol: shouldIndentContinuation ? continuationTextCol : null,
    })

    if (listTextCol != null) {
      continuationTextCol = listTextCol
    } else if (!shouldIndentContinuation && hasContent(row)) {
      continuationTextCol = null
    }

    return laidOut
  })
}

export function layoutRow(row, nCols, options = {}) {
  const byCol = new Map(row.cells.map((c) => [c.c, c]))
  const reportFooter = rightAlignedReportFooterRun(byCol)
  const out = []
  let i = 0
  while (i < nCols) {
    if (reportFooter && i === reportFooter.start) {
      out.push({
        ...reportFooter.cell,
        c: reportFooter.start,
        span: reportFooter.end - reportFooter.start + 1,
        bd: mergeBorders(byCol, reportFooter.start, reportFooter.end + 1),
      })
      i = reportFooter.end + 1
      continue
    }
    const cell = byCol.get(i) || { c: i }
    const continuationRun = continuationTextRun(byCol, cell, nCols, options.continuationTextCol)
    if (continuationRun) {
      out.push({
        c: cell.c,
        span: continuationRun.textCol - cell.c,
        bd: edgeBorders(cell.bd, 'tbl'),
      })
      out.push({
        ...cell,
        c: continuationRun.textCol,
        w: 1,
        span: continuationRun.end - continuationRun.textCol + 1,
        bd: mergeBorderStrings(
          mergeBorders(byCol, continuationRun.textCol, continuationRun.end + 1),
          edgeBorders(cell.bd, 'tb'),
        ),
      })
      i = continuationRun.end + 1
      continue
    }
    const wrapRun = wrappedTextRun(byCol, cell, nCols)
    if (wrapRun) {
      out.push({
        ...cell,
        span: wrapRun.end - i + 1,
        bd: mergeBorders(byCol, i, wrapRun.end + 1),
      })
      i = wrapRun.end + 1
      continue
    }
    const proseRun = proseTextRun(byCol, cell, nCols)
    if (proseRun) {
      out.push({
        ...cell,
        w: 1,
        span: proseRun.end - i + 1,
        bd: mergeBorders(byCol, i, proseRun.end + 1),
      })
      i = proseRun.end + 1
      continue
    }
    if (cell.ha === 'cc' && cell.t) {
      // centerContinuous: center the text across this cell and the empty cells
      // to its right, up to the visual frame edge or the next text cell.
      let j = i + 1
      if (!(cell.bd && cell.bd.includes('r'))) {
        while (j < nCols) {
          const nxt = byCol.get(j)
          if (nxt && nxt.t) break
          j++
          if (nxt && nxt.bd && nxt.bd.includes('r')) break
        }
      }
      out.push({ ...cell, span: j - i, bd: mergeBorders(byCol, i, j) })
      i = j
    } else {
      out.push({ ...cell, span: 1 })
      i++
    }
  }
  return out
}

function instructionListTextCol(byCol, nCols) {
  if (hasInteriorVerticalBorders(byCol, nCols)) return null
  const textCells = contentCells(byCol)
  const numberCell = textCells.find((c) => c.c === 0 && /^\d+[,.]?$/.test(String(c.t).trim()))
  if (!numberCell) return null
  const bodyCell = textCells.find((c) => c.c > numberCell.c && !/^\d+[,.]?$/.test(String(c.t).trim()))
  return bodyCell ? bodyCell.c : null
}

function instructionContinuationRow(byCol, nCols, continuationTextCol) {
  const textCells = contentCells(byCol)
  if (textCells.length !== 1) return false
  const cell = textCells[0]
  return Boolean(
    continuationTextCol > cell.c &&
    continuationTextCol < nCols &&
    !['c', 'cc', 'r'].includes(cell.ha) &&
    !/^ *Railroad Annual Report R-1 *$/i.test(cell.t) &&
    !hasInteriorVerticalBorders(byCol, nCols) &&
    findRightFrameEdge(byCol, continuationTextCol, nCols) >= continuationTextCol
  )
}

function continuationTextRun(byCol, cell, nCols, continuationTextCol) {
  if (!Number.isInteger(continuationTextCol)) return null
  if (!cell.t || !String(cell.t).trim()) return null
  if (!instructionContinuationRow(byCol, nCols, continuationTextCol)) return null

  const end = findRightFrameEdge(byCol, continuationTextCol, nCols)
  return { textCol: continuationTextCol, end }
}

function contentCells(byCol) {
  return [...byCol.values()].filter((c) => c.t && String(c.t).trim())
}

function hasContent(row) {
  return row.cells.some((c) => c.t && String(c.t).trim())
}

function proseTextRun(byCol, cell, nCols) {
  if (!cell.t || cell.w || ['c', 'cc', 'r'].includes(cell.ha)) return null
  if (/^ *Railroad Annual Report R-1 *$/i.test(cell.t)) return null
  if (hasInteriorVerticalBorders(byCol, nCols)) return null

  const textCells = contentCells(byCol)
  const laterText = textCells.some((c) => c.c > cell.c)
  if (laterText) return null

  const priorListNumber = textCells.some((c) =>
    c.c < cell.c && /^\d+[,.]?$/.test(String(c.t).trim()))
  const continuation = cell.c === 0 && textCells.length === 1
  if (!priorListNumber && !continuation) return null

  const end = findRightFrameEdge(byCol, cell.c + 1, nCols)
  return end > cell.c ? { end } : null
}

function hasInteriorVerticalBorders(byCol, nCols) {
  for (const cell of byCol.values()) {
    if (cell.c === 0 || cell.c === nCols - 1) continue
    if (cell.bd && /[lr]/.test(cell.bd)) return true
  }
  return false
}

function wrappedTextRun(byCol, cell, nCols) {
  if (!cell.w || !cell.t || cell.ha === 'cc') return null

  const end = findRightFrameEdge(byCol, cell.c + 1, nCols)

  return end > cell.c ? { end } : null
}

function findRightFrameEdge(byCol, start, nCols) {
  let end = start - 1
  for (let j = start; j < nCols; j++) {
    const next = byCol.get(j)
    if (next && next.t) break
    end = j
    if (next && next.bd && next.bd.includes('r')) break
  }
  return end
}

function rightAlignedReportFooterRun(byCol) {
  const footer = [...byCol.values()].find((cell) =>
    cell.ha === 'r' && /^ *Railroad Annual Report R-1 *$/i.test(cell.t || ''))
  if (!footer) return null

  let start = footer.c
  while (start > 0) {
    const prev = byCol.get(start - 1)
    if (prev && prev.t) break
    start--
  }

  if (start === footer.c) return null
  return { start, end: footer.c, cell: footer }
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0)
}

export function mergeBorders(byCol, i, j) {
  let t = false, b = false, l = false, r = false
  for (let k = i; k < j; k++) {
    const c = byCol.get(k)
    if (c && c.bd) {
      if (c.bd.includes('t')) t = true
      if (c.bd.includes('b')) b = true
      if (k === i && c.bd.includes('l')) l = true
      if (c.bd.includes('r')) r = c.c === j - 1
    }
  }
  return (t ? 't' : '') + (b ? 'b' : '') + (l ? 'l' : '') + (r ? 'r' : '')
}

function edgeBorders(bd, sides) {
  if (!bd) return ''
  return (bd.includes('t') && sides.includes('t') ? 't' : '') +
    (bd.includes('b') && sides.includes('b') ? 'b' : '') +
    (bd.includes('l') && sides.includes('l') ? 'l' : '') +
    (bd.includes('r') && sides.includes('r') ? 'r' : '')
}

function mergeBorderStrings(...borders) {
  return (borders.some((bd) => bd && bd.includes('t')) ? 't' : '') +
    (borders.some((bd) => bd && bd.includes('b')) ? 'b' : '') +
    (borders.some((bd) => bd && bd.includes('l')) ? 'l' : '') +
    (borders.some((bd) => bd && bd.includes('r')) ? 'r' : '')
}

export function borderStyle(bd) {
  if (!bd) return {}
  const line = '1px solid #000'
  return {
    borderTop: bd.includes('t') ? line : undefined,
    borderBottom: bd.includes('b') ? line : undefined,
    borderLeft: bd.includes('l') ? line : undefined,
    borderRight: bd.includes('r') ? line : undefined,
  }
}
