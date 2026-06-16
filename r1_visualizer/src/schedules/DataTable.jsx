import { prettifyKey, formatValue, isNumeric, unionKeys, orderKeys, colLetter } from '../util.js'

// Generic form table. `valueKey` names the nested object holding the cells
// (cells | fields | measures | values). `leading` are fixed left columns
// extracted straight off each record; mark the line-number column with
// `line: true` so it renders form-style (centered, unlettered, repeated on
// the right edge). `order` is the authoritative form column order.
// `crossCheck` adds the form's blank "Cross Check" column (left of the other
// leading columns); it is presentation-only and never carries data.
export function DataTable({ records, valueKey, leading = [], order = null, crossCheck = false }) {
  if (!records || records.length === 0) return <p class="r1-empty">No data.</p>

  const valueKeys = orderKeys(unionKeys(records, (r) => r[valueKey]), order)
  const lineCol = leading.find((c) => c.line)
  const lettered = leading.filter((c) => !c.line)

  return (
    <div class="r1-table-wrap">
      <table class="r1-table">
        <thead>
          <tr>
            {lineCol && <th class="r1-th-line" rowSpan={2}>Line No.</th>}
            {crossCheck && <th class="r1-th-cross" rowSpan={2}>Cross Check</th>}
            {lettered.map((c) => <th>{c.header}</th>)}
            {valueKeys.map((k) => <th title={k}>{prettifyKey(k)}</th>)}
            {lineCol && <th class="r1-th-line" rowSpan={2}>Line No.</th>}
          </tr>
          <tr class="r1-letter-row">
            {lettered.map((c, i) => <th>({colLetter(i)})</th>)}
            {valueKeys.map((k, i) => <th>({colLetter(lettered.length + i)})</th>)}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const vals = r[valueKey] || {}
            return (
              <tr class={/^total/i.test(String(r.title || '')) ? 'r1-row-total' : ''}>
                {lineCol && <td class="r1-td-line">{lineCol.get(r)}</td>}
                {crossCheck && <td class="r1-td-cross"></td>}
                {lettered.map((c) => <td class="r1-td-lead">{c.get(r)}</td>)}
                {valueKeys.map((k) => (
                  <td class={isNumeric(vals[k]) ? 'r1-td-num' : 'r1-td-text'}>{formatValue(vals[k])}</td>
                ))}
                {lineCol && <td class="r1-td-line">{lineCol.get(r)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
