import { prettifyKey, formatValue, isNumeric, unionKeys, orderKeys, colLetter } from '../util.js'
import { getColumnOrder, hasCrossCheck } from '../formLayout.js'

// shape: sections[] -> { section_id, lines[] -> { line_no, title, values{} } }
// One continuous form-style grid; section ids become centered divider rows,
// the way the printed form runs "Current Assets" etc. inside the table.
export function SectionsTable({ schedule }) {
  const sections = schedule.sections || []
  if (sections.length === 0) return <p class="r1-empty">No data.</p>
  const order = getColumnOrder(schedule.schedule_id)
  const allLines = sections.flatMap((s) => s.lines || [])
  const valueKeys = orderKeys(unionKeys(allLines, (l) => l.values), order)
  const hasAccounts = allLines.some((l) => (l.cross_check_accounts || []).length > 0)
  // The printed form carries a blank "Cross Check" manual-verification column
  // (left of Account/Title). It's a form artifact, never filled by data, and
  // appears independently of whether the schedule has an Account column.
  const crossCheck = hasCrossCheck(schedule.schedule_id)
  const colCount = 3 + (crossCheck ? 1 : 0) + (hasAccounts ? 1 : 0) + valueKeys.length

  return (
    <div class="r1-table-wrap">
      <table class="r1-table">
        <thead>
          <tr>
            <th class="r1-th-line" rowSpan={2}>Line No.</th>
            {crossCheck && <th class="r1-th-cross" rowSpan={2}>Cross Check</th>}
            {hasAccounts && <th rowSpan={2}>Account</th>}
            <th>Title</th>
            {valueKeys.map((k) => <th title={k}>{prettifyKey(k)}</th>)}
            <th class="r1-th-line" rowSpan={2}>Line No.</th>
          </tr>
          <tr class="r1-letter-row">
            <th>(a)</th>
            {valueKeys.map((k, i) => <th>({colLetter(i + 1)})</th>)}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <>
              {sections.length > 1 && section.section_id && (
                <tr class="r1-section-row">
                  <td colSpan={colCount}>{prettifyKey(section.section_id)}</td>
                </tr>
              )}
              {(section.lines || []).map((l) => {
                const vals = l.values || {}
                return (
                  <tr class={/^total/i.test(l.title || '') ? 'r1-row-total' : ''}>
                    <td class="r1-td-line">{l.line_no}</td>
                    {crossCheck && <td class="r1-td-cross"></td>}
                    {hasAccounts && <td class="r1-td-account">{(l.cross_check_accounts || []).join(', ')}</td>}
                    <td class="r1-td-lead">{l.title}</td>
                    {valueKeys.map((k) => (
                      <td class={isNumeric(vals[k]) ? 'r1-td-num' : 'r1-td-text'}>
                        {formatValue(vals[k])}
                      </td>
                    ))}
                    <td class="r1-td-line">{l.line_no}</td>
                  </tr>
                )
              })}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
