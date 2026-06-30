const FALLBACK_VALUE_KEYS = ['values', 'cells', 'fields', 'measures']

// Non-data content a value cell may carry on the blank form: a "not
// applicable" marker, a blocked-out cell, or the empty "(    )" placeholder
// the form prints where a parenthesised negative would be entered.
export const MARKER = /^(n\/?a|na|x+|\(\s*\)|[-*–—.\s]+)$/i
const FILLABLE_MARKER = /^(\(\s*\)|[-*–—.\s]+)$/i

export function isFillableMarker(value) {
  return FILLABLE_MARKER.test(String(value || '').trim())
}

const STOP = new Set(['of', 'at', 'for', 'the', 'and', 'to', 'in', 'a', 'on', 'or', 'col', 'cols', 'see'])

export const tokens = (value) => String(value || '')
  .toLowerCase().split(/[^a-z0-9]+/).filter((token) => token && token.length > 1 && !STOP.has(token))

export function resolveValue(values, keyPath) {
  if (!values || !keyPath) return undefined
  if (Object.prototype.hasOwnProperty.call(values, keyPath)) return values[keyPath]

  const parts = String(keyPath).split('.').filter(Boolean)
  let current = values
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[part]
  }
  return current
}

export function hasResolvedValue(values, keyPath) {
  const value = resolveValue(values, keyPath)
  return value !== null && value !== undefined && value !== ''
}

export function recordValues(record, valueKey) {
  if (!record) return {}
  if (valueKey && record[valueKey]) return record[valueKey]
  for (const key of FALLBACK_VALUE_KEYS) {
    if (record[key]) return record[key]
  }
  return {}
}

export function scheduleRecords(schedule) {
  if (!schedule) return []
  if (schedule.sections) return schedule.sections.flatMap((section) => section.lines || [])
  if (schedule.rows) return schedule.rows
  if (schedule.items) return schedule.items
  if (schedule.categories) return schedule.categories
  return []
}

export function indexData(schedule, scheduleId, specs = {}) {
  const empty = { byAccount: new Map(), byLine: new Map(), byBlockLine: new Map(), blocks: [] }
  if (!schedule) return empty
  const spec = specs[scheduleId] || {}
  const valueKey = spec.valueKey || 'values'
  const byAccount = new Map()
  const byLine = new Map()
  // For schedules that paginate across facing pages that restart line numbering
  // (e.g. 310): records carry `block` (0-based page-pair) + `source_line_no` (the
  // printed per-page line). byBlockLine lets the facsimile place each record back on
  // its own page instead of keying everything to one global, flattened line number.
  const byBlockLine = new Map()
  const blockSet = new Set()

  for (const record of scheduleRecords(schedule)) {
    const values = recordValues(record, valueKey)
    if (record.line_no != null) appendMapValue(byLine, String(record.line_no), values)
    if (record.block != null) {
      blockSet.add(record.block)
      const sln = record.source_line_no != null ? record.source_line_no : record.line_no
      if (sln != null) appendMapValue(byBlockLine, `${record.block}:${sln}`, values)
    }
    const accounts = record.cross_check_accounts || []
    if (accounts.length) appendMapValue(byAccount, norm(accounts.join(',')), values)
  }

  return { byAccount, byLine, byBlockLine, blocks: [...blockSet].sort((a, b) => a - b) }
}

export function selectBestValues(candidates, keyPaths) {
  if (!candidates || !candidates.length) return null
  const paths = [...new Set((keyPaths || []).filter(Boolean))]
  if (!paths.length || candidates.length === 1) return candidates[0]

  let best = candidates[0]
  let bestScore = scoreValues(best, paths)
  for (const candidate of candidates.slice(1)) {
    const score = scoreValues(candidate, paths)
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return best
}

// Map each template column that holds data to the data key it carries, by
// matching the column's header text against the columnSpec key names. This is
// robust to schedules that stack several sub-tables with different columns on
// one sheet (e.g. 450), where a single positional rule would misplace values.
export function analyzeColumns(page, scheduleId, specs = {}) {
  const spec = specs[scheduleId] || {}
  const dataCols = spec.columns || []

  // Header columns: leftmost "Line" and "Account" columns (for row matching).
  let accountCol = null
  let lineCol = null
  for (const row of page.rows) {
    for (const c of row.cells) {
      const t = (c.t || '').trim().toLowerCase()
      if (t === 'account' && accountCol == null) accountCol = c.c
      if ((t === 'line' || t === 'line no.') && lineCol == null) lineCol = c.c
    }
  }

  // Cross-check columns are blank in data rows and look fillable, but they are
  // manual verification columns, not submission values.
  const crossCheckCols = new Set()
  for (const row of page.rows) {
    for (const c of row.cells) {
      const t = (c.t || '').trim().toLowerCase()
      if (t === 'cross' || t === 'check' || t === 'cross check') crossCheckCols.add(c.c)
    }
  }

  // A row is a data row if its line column holds an integer — but NOT a page
  // header/footer (those carry "Road Initials:"/"Year:"/the report footer and a
  // page number that would otherwise look like a line number).
  const CHROME = /road initials|railroad annual report|^year:?$/i
  const isDataRow = (row) =>
    lineCol != null &&
    !row.cells.some((c) => c.t && CHROME.test(c.t.trim())) &&
    row.cells.some((c) => c.c === lineCol && c.t && /^\d+$/.test(c.t.trim()))

  // A value column is empty+bordered in data rows and never holds *descriptor*
  // text (Title/Account/Particulars columns do, so they're excluded — which
  // also keeps their instruction prose out of the matching). Blocked-cell
  // markers like "N/A" or "XXXXXX" are not descriptors and don't disqualify a
  // value column.
  const fillable = new Set()
  const textInData = new Set()
  for (const row of page.rows) {
    if (!isDataRow(row)) continue
    for (const c of row.cells) {
      if (c.t) {
        if (!MARKER.test(c.t.trim())) textInData.add(c.c)
      } else if (c.bd && c.c !== lineCol) {
        fillable.add(c.c)
      }
    }
  }
  const candidate = new Set([...fillable].filter((c) => !textInData.has(c) && !crossCheckCols.has(c)))

  // Match a band's accumulated header tokens to the schedule's value keys.
  const mapBand = (headerTokens) => {
    const pairs = []
    for (const key of dataCols) {
      const kt = tokens(key)
      for (const [col, ht] of headerTokens) {
        const score = kt.filter((t) => ht.includes(t)).length
        if (score > 0) pairs.push({ key, col, score })
      }
    }
    pairs.sort((a, b) => b.score - a.score)
    const m = new Map()
    const usedKey = new Set()
    for (const p of pairs) {
      if (m.has(p.col) || usedKey.has(p.key)) continue
      m.set(p.col, p.key)
      usedKey.add(p.key)
    }
    return m
  }

  // Walk the sheet, grouping rows into bands. A run of header rows (carrying
  // text in value columns) defines the column→key map for the data rows that
  // follow it — so sub-tables that reuse the same physical columns for
  // different values (e.g. schedule 450) each map correctly.
  const rowMaps = new Array(page.rows.length)
  let activeMap = new Map()
  let headerAcc = null
  page.rows.forEach((row, ri) => {
    if (isDataRow(row)) {
      if (headerAcc) { activeMap = mapBand(headerAcc); headerAcc = null }
      rowMaps[ri] = activeMap
    } else {
      // A numbered instruction paragraph that a continued page prints above the table
      // ("11. ...give names and extent of control...") is NOT a column header, but its
      // body lands in a value column and would mis-map it (Schedule 310 page 27's
      // "extent of control" capturing the Opening Balance column). Column headers and
      // category subheaders are never numbered, so skipping numbered rows excludes the
      // prose while keeping a real header band that sits above a blank row and a
      // subheader (Schedule 200) - which a blank-row reset would have discarded.
      const firstText = row.cells.map((c) => c.t).find((t) => t && String(t).trim())
      const isInstruction = firstText && /^\s*\d+\.(\s|$)/.test(String(firstText))
      const isHeaderCell = (c) => c.t && candidate.has(c.c) && !MARKER.test(c.t.trim())
      if (!isInstruction && row.cells.some(isHeaderCell)) {
        if (!headerAcc) headerAcc = new Map()
        for (const c of row.cells) {
          if (isHeaderCell(c)) {
            const list = headerAcc.get(c.c) || []
            list.push(...tokens(c.t))
            headerAcc.set(c.c, list)
          }
        }
      }
      rowMaps[ri] = activeMap
    }
  })
  return { rowMaps, accountCol, lineCol }
}

function scoreValues(values, keyPaths) {
  return keyPaths.reduce((score, keyPath) => score + (hasResolvedValue(values, keyPath) ? 1 : 0), 0)
}

function appendMapValue(map, key, value) {
  const values = map.get(key)
  if (values) values.push(value)
  else map.set(key, [value])
}

function norm(value) {
  return String(value == null ? '' : value).replace(/\s+/g, '').replace(/\n/g, '')
}
