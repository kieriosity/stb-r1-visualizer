import { useMemo } from 'preact/hooks'
import { columnSpec } from './formLayout.js'
import { detailRows, schedulePresentation } from './filedDetails.js'
import { primaryScheduleIdForPage } from './pageSchedules.js'
import { formatValue } from './util.js'

export function FiledDetails({ page, pages, doc }) {
  const id = primaryScheduleIdForPage(page)
  const schedule = page?.legacyFor ? doc?.legacy_schedules?.[page.legacyFor] : doc?.schedules?.[id]
  const rows = useMemo(() => schedule
    ? detailRows(schedulePresentation(page?.legacyFor ? [page] : pages, schedule, id, columnSpec).unplaced, schedule) : [],
  [page?.legacyFor, pages, schedule, id])
  if (!rows.length || page?.notesFor) return null
  return <details class="r1-filed-details" open={page?.filedOnly || id === '502'}>
    <summary>{page?.legacyFor ? 'Retained legacy schedule' : 'Schedule'} {id} — additional filed data ({rows.length} fields)</summary>
    <p>These values and descriptions are not placed on the form above. This list covers the whole schedule.</p>
    <table><thead><tr><th>Record</th><th>Field</th><th>Filed value</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.pointer} data-field-path={row.pointer}>
        <td>{row.record}</td><th scope="row" title={row.pointer}>{row.field}</th>
        <td>{typeof row.value === 'number' ? String(row.value) : formatValue(row.value)}</td>
      </tr>)}</tbody></table>
  </details>
}
