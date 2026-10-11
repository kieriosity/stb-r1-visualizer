import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { columnLetter, formatCell, schedulesForRow, sheetFitScale, sheetUrl } from './sheetGrid.js'

// One original worksheet tab as a read-only grid with Excel row numbers and column
// letters. Rows inside a recorded schedule row range are highlighted, and the first
// of them is scrolled into view.
export function SheetGrid({ base, page, binding, zoom, ranges, onLoad, onFail }) {
  const [sheet, setSheet] = useState(null)
  const [error, setError] = useState(null)
  const [fit, setFit] = useState(1)
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

  // Fit every column into the pane, so values in the right-hand columns are not
  // hidden off-screen (BNSF 2017 Schedule 210 keeps its page-2 amounts in F and G).
  useLayoutEffect(() => {
    const table = grid.current?.querySelector('table')
    const viewport = grid.current?.closest('.r1-source-viewport')
    if (!table || !viewport) return
    const measure = () => {
      const style = getComputedStyle(viewport)
      const room = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      setFit(sheetFitScale(table.offsetWidth, parseFloat(getComputedStyle(table).fontSize), room))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [sheet])

  // Bring the first linked row just below the sticky column letters, scrolling the
  // source pane vertically only (scrollIntoView would also shift it sideways).
  useEffect(() => {
    const row = grid.current?.querySelector('tr.r1-sheet-linked')
    const viewport = grid.current?.closest('.r1-source-viewport')
    if (!row || !viewport) return
    const header = grid.current.querySelector('thead')?.offsetHeight || 0
    const offset = row.getBoundingClientRect().top - viewport.getBoundingClientRect().top
    viewport.scrollTop = Math.max(0, viewport.scrollTop + offset - header - 12)
  }, [sheet])

  if (error) return <p role="alert">{error} Reopen source comparison to retry.</p>
  if (!sheet) return <p role="status">Loading worksheet…</p>
  if (!sheet.rows.length) return <p class="r1-sheet-note">This tab is empty.</p>
  const columns = sheet.rows[0].length
  return <div class="r1-sheet" ref={grid} style={{ fontSize: `${fit * zoom * 12}px` }}>
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
