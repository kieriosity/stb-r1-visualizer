import { useMemo } from 'preact/hooks'
import { formatValue } from './util.js'
import { columnSpec } from './formLayout.js'
import { analyzeColumns, indexData, isFillableMarker, resolveValue, selectBestValues } from './formData.js'
import { borderStyle, buildGridPanels, layoutRows, PX_PER_UNIT } from './formGrid.js'
import { topSeverity } from './findingLocation.js'
import { injectAnswers, matchAnswers } from './narrativeAnswers.js'

// The printed line_no a template row carries (from its Line No. cell), so a DQ
// finding can be pinned to the exact form row.
function rowLineNo(cells, lineCol) {
  if (lineCol == null) return null
  const c = cells.find((x) => x.c === lineCol && x.t && /^\d+$/.test(String(x.t).trim()))
  return c ? Number(String(c.t).trim()) : null
}

export function findingRowId(scheduleId, lineNo) {
  return `r1-finding-row-${scheduleId}-${lineNo}`
}

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '').replace(/\n/g, '')

const ALIGN = { c: 'center', cc: 'center', r: 'right', l: 'left' }
const EMPTY_MAP = new Map()

export function FormFacsimile({ page, schedule, scheduleId, envelope, findingsByLine }) {
  const meta = envelope?.form_metadata || {}
  const resp = envelope?.respondent || {}

  const data = useMemo(() => indexData(schedule, scheduleId, columnSpec), [schedule, scheduleId])
  // narrative_qa schedules (B, C): place the filed answers onto the form's inquiry
  // lines so they read in the facsimile rather than a separate panel above it.
  const renderPage = useMemo(
    () => injectAnswers(page, matchAnswers(page, schedule).rowAnswers), [page, schedule])
  const panels = useMemo(
    () => buildGridPanels(renderPage).map((panel) => ({
      ...panel,
      ...analyzeColumns(panel, scheduleId, columnSpec),
      laidOut: layoutRows(panel.rows, panel.cols.length),
    })),
    [renderPage, scheduleId])

  // For a template row, find the data value object keyed by its account or
  // line-number cell, so we can drop values into the value columns.
  function rowValues(rowCells, lineCol, accountCol, colToKey) {
    const keys = [...(colToKey?.values() || [])]
    // Prefer the line number: it is unique across a schedule's sheet, whereas
    // account numbers can repeat (e.g. "731, 732" on several lines).
    if (lineCol != null) {
      const ln = rowCells.find((c) => c.c === lineCol && c.t && /^\d+$/.test(c.t.trim()))
      if (ln) {
        const hit = data.byLine.get(ln.t.trim())
        if (hit) return selectBestValues(hit, keys)
      }
    }
    if (accountCol != null) {
      const acc = rowCells.find((c) => c.c === accountCol && c.t)
      if (acc) {
        const hit = data.byAccount.get(norm(acc.t))
        if (hit) return selectBestValues(hit, keys)
      }
    }
    return null
  }

  return (
    <div class="r1-fac-wrap">
      {panels.map((panel) => {
        const naturalWidth = panel.cols.reduce((s, w) => s + w, 0)
        const displayWidth = panel.widthUnits || naturalWidth
        const colScale = naturalWidth > 0 ? displayWidth / naturalWidth : 1
        const totalWidth = Math.round(displayWidth * PX_PER_UNIT)
        return (
          <table class="r1-fac" style={{ width: `${totalWidth}px` }}>
            <colgroup>
              {panel.cols.map((w) => <col style={{ width: `${Math.round(w * colScale * PX_PER_UNIT)}px` }} />)}
            </colgroup>
            <tbody>
              {panel.laidOut.map((rowCells, ri) => {
                const colToKey = panel.rowMaps[ri] || EMPTY_MAP
                const vals = rowValues(panel.rows[ri].cells, panel.lineCol, panel.accountCol, colToKey)
                const lineNo = rowLineNo(panel.rows[ri].cells, panel.lineCol)
                const rowFindings = lineNo != null && findingsByLine ? findingsByLine.get(lineNo) : null
                const sev = rowFindings ? topSeverity(rowFindings) : null
                return (
                  <tr
                    id={sev ? findingRowId(scheduleId, lineNo) : undefined}
                    class={sev ? `r1-fac-flag is-${sev.toLowerCase()}` : undefined}
                    title={sev
                      ? rowFindings.map((f) => `${f.severity} ${f.rule_id}: ${f.message || ''}`).join('\n')
                      : undefined}
                  >
                    {rowCells.map((cell) => {
                      let text = cell.t || ''
                      // Header blanks: stamp respondent / year next to their labels.
                      if (/road initials/i.test(text) && /year/i.test(text)) {
                        text = `Road Initials: ${resp.reporting_mark || ''}     Year: ${meta.report_year || ''}`
                      } else if (/road initials/i.test(text)) {
                        text = `Road Initials: ${resp.reporting_mark || ''}`
                      } else if (/^year:?\s*$/i.test(text.trim())) {
                        text = `Year: ${meta.report_year || ''}`
                      }
                      // Value cell: fill from data if this column maps to a value.
                      // Printed "N/A" / "XXXXXX" cells are static template details;
                      // accounting blanks like "(   )" remain fillable placeholders.
                      const dataKey = colToKey.get(cell.c)
                      const placeholder = cell.t && isFillableMarker(cell.t)
                      const isValue = dataKey && (!cell.t || placeholder)
                      const value = isValue ? resolveValue(vals, dataKey) : undefined
                      if (isValue && value != null && value !== '') {
                        text = formatValue(value)
                      }
                      const style = {
                        ...borderStyle(cell.bd),
                        textAlign: cell.tr === 180 ? 'center' : (isValue ? 'right' : (ALIGN[cell.ha] || 'left')),
                        fontWeight: cell.b ? 700 : 400,
                        fontStyle: cell.i ? 'italic' : 'normal',
                        fontSize: cell.sz ? `${cell.sz / 7 * 100}%` : undefined,
                        writingMode: cell.tr === 180 ? 'vertical-rl' : undefined,
                        textOrientation: cell.tr === 180 ? 'upright' : undefined,
                        whiteSpace: cell.w ? 'normal' : 'nowrap',
                        // Like Excel, let a non-wrapped label spill into the empty
                        // cells beside it; value cells and wrapped cells stay clipped.
                        overflow: (cell.w || isValue) ? 'hidden' : 'visible',
                      }
                      return (
                        <td colSpan={cell.span > 1 ? cell.span : undefined} style={style}>
                          {text === '' ? ' ' : text.split('\n').map((line, k) => (
                            <>{k > 0 && <br />}{line}</>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )
      })}
    </div>
  )
}
