import { useEffect, useRef, useState } from 'preact/hooks'
import { columnLetter, formatCell, schedulesForRow, sheetUrl } from './sheetGrid.js'

// One original worksheet tab as a read-only grid with Excel row numbers and column
// letters. Rows inside a recorded schedule row range are highlighted, and the first
// of them is scrolled into view.
export function SheetGrid({ base, page, binding, zoom, ranges, onLoad, onFail }) {
  const [sheet, setSheet] = useState(null)
  const [error, setError] = useState(null)
  const grid = useRef(null)
  const url = sheetUrl(base, page, binding)

  useEffect(() => {
    const controller = new AbortController()
    setSheet(null)
    setError(null)
    fetch(url, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        const value = await res.json()
        if (!res.ok) throw new Error(value.message || 'The worksheet could not be loaded.')
        return value
      })
      .then((value) => {
        if (controller.signal.aborted) return
        setSheet(value)
        onLoad?.(url)
      })
      .catch((e) => {
        if (controller.signal.aborted) return
        setError(e.message)
        onFail?.(url)
      })
    return () => controller.abort()
  }, [url])

  useEffect(() => {
    const first = grid.current?.querySelector('tr.r1-sheet-linked')
    first?.scrollIntoView({ block: 'start' })
  }, [sheet])

  if (error) return <p role="alert">{error} Reopen source comparison to retry.</p>
  if (!sheet) return <p role="status">Loading worksheet…</p>
  if (!sheet.rows.length) return <p class="r1-sheet-note">This tab is empty.</p>
  const columns = sheet.rows[0].length
  return <div class="r1-sheet" ref={grid} style={{ fontSize: `${zoom * 12}px` }}>
    {sheet.truncated && <p class="r1-sheet-note">Showing the first {sheet.rows.length} rows and {columns}
      {' '}columns of {sheet.row_count} × {sheet.column_count}.</p>}
    <table class="r1-sheet-grid">
      <thead><tr><th class="r1-sheet-corner" scope="col"></th>
        {Array.from({ length: columns }, (_, j) => <th scope="col">{columnLetter(j)}</th>)}</tr></thead>
      <tbody>{sheet.rows.map((row, i) => {
        const linked = schedulesForRow(ranges, i + 1)
        return <tr class={linked.length ? 'r1-sheet-linked' : undefined}>
          <th scope="row" title={linked.length ? `Schedule ${linked.join(', ')}` : undefined}>{i + 1}</th>
          {row.map((value) => <td class={typeof value === 'number' ? 'r1-sheet-num' : undefined}>{formatCell(value)}</td>)}
        </tr>
      })}</tbody>
    </table>
  </div>
}
