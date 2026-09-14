import { useMemo } from 'preact/hooks'
import { formatValue } from './util.js'
import { columnSpec } from './formLayout.js'
import { prepareForm } from './formPresentation.js'
import { borderStyle, PX_PER_UNIT } from './formGrid.js'
import { topSeverity } from './findingLocation.js'

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

const ALIGN = { c: 'center', cc: 'center', r: 'right', l: 'left' }

export function FormFacsimile({ page, schedule, scheduleId, envelope, findingsByLine, panelIndex = null }) {
  const meta = envelope?.form_metadata || {}
  const resp = envelope?.respondent || {}

  const { panels } = useMemo(() => prepareForm(page, schedule, scheduleId, columnSpec),
    [page, schedule, scheduleId])

  return (
    <div class="r1-fac-wrap">
      {panels.filter((_, index) => panelIndex == null || index === panelIndex).map((panel) => {
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
                      const isValue = cell.valueColumn || cell.fieldPointer
                      const value = cell.filedValue
                      if (value != null && value !== '') text = formatValue(value)
                      // A bordered column cannot spill into its neighbor. Some
                      // workbook headers omit wrap_text despite long captions.
                      const wraps = cell.w || cell.fieldPointer || (cell.bd?.includes('l') && cell.bd?.includes('r'))
                      const style = {
                        ...borderStyle(cell.bd),
                        textAlign: cell.tr === 180 ? 'center' : (typeof value === 'number' ? 'right' : (ALIGN[cell.ha] || 'left')),
                        fontWeight: cell.b ? 700 : 400,
                        fontStyle: cell.i ? 'italic' : 'normal',
                        fontSize: cell.sz ? `${cell.sz / 7 * 100}%` : undefined,
                        writingMode: cell.tr === 180 ? 'vertical-rl' : undefined,
                        textOrientation: cell.tr === 180 ? 'upright' : undefined,
                        whiteSpace: wraps ? 'normal' : 'nowrap',
                        overflowWrap: cell.fieldPointer ? 'anywhere' : undefined,
                        // Like Excel, let a non-wrapped label spill into the empty
                        // cells beside it; value cells and wrapped cells stay clipped.
                        overflow: (wraps || isValue) ? 'hidden' : 'visible',
                      }
                      return (
                        <td colSpan={cell.span > 1 ? cell.span : undefined} style={style}
                          data-field-path={cell.fieldPointer} title={cell.fieldPointer}>
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
