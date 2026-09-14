// One presentation plan for the facsimile and its coverage audit. Coverage is
// recorded only after a field reaches a real laid-out cell, never from the mere
// presence of a columnSpec. Unplaced fields remain available as filed details.
import { analyzeColumns, indexData, isFillableMarker, resolvedKey, resolveValue, selectBestValues } from './formData.js'
import { buildGridPanels, layoutRows } from './formGrid.js'
import { injectAnswers, matchAnswers } from './narrativeAnswers.js'

const INTERNAL = new Set(['schedule_id', 'revision', 'line_no', 'source_line_no', 'block',
  'section_id', 'category_id', 'row_id', 'block_id', 'answer_type'])
const norm = (s) => String(s ?? '').replace(/\s+/g, '').toLowerCase()
const present = (v) => v != null && v !== ''

export function filedLeaves(value, path = [], out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => filedLeaves(v, [...path, i], out))
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      // Metadata names inside a values/fields object are still filed data.
      const inValues = path.some((p) => ['values', 'cells', 'fields', 'measures', 'child_collections'].includes(p))
      if (inValues || !INTERNAL.has(key)) filedLeaves(v, [...path, key], out)
    }
  } else if (present(value)) out.push({ path, pointer: '/' + path.map(escapePointer).join('/'), value })
  return out
}

function escapePointer(s) { return String(s).replace(/~/g, '~0').replace(/\//g, '~1') }
const pointerFor = (path) => '/' + path.map(escapePointer).join('/')
const atPath = (value, path) => path.reduce((v, k) => v?.[k], value)

function injectCollections(page, schedule, id) {
  if (!page?.rows) return page
  let header = -1, columns, records, base
  if (id === 'A') {
    header = page.rows.findIndex((r) => ['Page', 'Schedule No.', 'Title'].every((t) => r.cells.some((c) => c.t === t)))
    if (header >= 0) columns = new Map(page.rows[header].cells.filter((c) => c.t).map((c) =>
      [c.c, ({ Page: 'page_number', 'Schedule No.': 'schedule_number', Title: 'title' })[c.t]]))
    records = (schedule?.items || []).map((r) => r.fields || {})
    base = (i) => ['items', i, 'fields']
  } else if (id === 'C') {
    header = page.rows.findIndex((r) => ['(a)', '(b)', '(c)', '(d)', '(e)', '(f)'].every((t) => r.cells.some((c) => c.t === t)))
    const keys = { '(a)': 'name', '(b)': 'address', '(c)': 'votes_entitled', '(d)': 'common_stock_votes',
      '(e)': 'second_preferred_stock_votes', '(f)': 'first_preferred_stock_votes' }
    if (header >= 0) columns = new Map(page.rows[header].cells.filter((c) => keys[c.t]).map((c) => [c.c, keys[c.t]]))
    records = schedule?.child_collections?.holders || []
    base = (i) => ['child_collections', 'holders', i]
  }
  if (header < 0 || !columns || !records?.length) return page
  let ordinal = 0, ended = false
  return { ...page, rows: page.rows.map((row, ri) => {
    if (ri <= header || ended || ordinal >= records.length) return row
    if (id === 'C' && (ordinal >= 30 || !row.cells.some((c) => c.c === 0 && String(c.t || '').trim() === String(ordinal + 1)))) { ended = true; return row }
    const slots = [...columns.keys()]
    if (!slots.every((col) => row.cells.some((c) => c.c === col && !c.t && c.bd))) { ended = true; return row }
    const record = records[ordinal], prefix = base(ordinal++)
    return { ...row, cells: row.cells.map((c) => {
      const key = columns.get(c.c), value = record[key]
      return key && present(value) && typeof value !== 'object'
        ? { ...c, t: String(value), w: 1, filedValue: value, fieldPointer: pointerFor([...prefix, key]) }
        : c
    }) }
  }) }
}

function valuePaths(schedule) {
  const objects = new WeakMap()
  function visit(value, path) {
    if (!value || typeof value !== 'object') return
    objects.set(value, path)
    for (const [k, v] of Object.entries(value)) visit(v, [...path, Array.isArray(value) ? Number(k) : k])
  }
  visit(schedule, [])
  return objects
}

export function rowValues(data, rowCells, panel, map, block, strict = false) {
  const keys = [...map.values()]
  function select(candidates) {
    const best = selectBestValues(candidates, keys)
    if (!strict || !best || candidates.length < 2 || !keys.length) return best
    const score = (v) => keys.filter((k) => present(resolveValue(v,k))).length
    const tied = candidates.filter((v) => score(v) === score(best))
    if (tied.some((v) => keys.some((k) => !Object.is(resolveValue(v,k),resolveValue(best,k))))) return null
    return best
  }
  if (panel.lineCol != null) {
    const ln = rowCells.find((c) => c.c === panel.lineCol && /^\d+$/.test(String(c.t || '').trim()))
    if (ln) {
      if (block != null && data.blocks.length) {
        const hit = data.byBlockLine.get(`${data.blocks[block]}:${String(ln.t).trim()}`)
        if (hit) return select(hit)
        if (strict) return null
      }
      const hit = data.byLine.get(String(ln.t).trim())
      if (hit) return select(hit)
    }
  }
  if (panel.accountCol != null) {
    const account = rowCells.find((c) => c.c === panel.accountCol && c.t)
    if (account) {
      const hit = data.byAccount.get(String(account.t).replace(/\s+/g, ''))
      if (hit) return select(hit)
    }
  }
  return null
}

export function prepareForm(page, schedule, id, specs, { baseline = false } = {}) {
  const consumed = new Set()
  const leaves = filedLeaves(schedule)
  const paths = valuePaths(schedule)
  const data = indexData(schedule, id, specs)
  const answers = matchAnswers(page, schedule)
  for (const key of answers.matchedKeys) {
    for (const leaf of leaves) if (leaf.path[0] === 'answers' && leaf.path[1] === key
      && ['text', 'date', 'choice', 'text_list', 'value'].includes(leaf.path[2])) consumed.add(leaf.pointer)
  }
  const narrativePage = injectAnswers(page, answers.rowAnswers)
  const renderPage = baseline ? narrativePage : injectCollections(narrativePage, schedule, id)
  const built = page?.rows && page?.cols ? buildGridPanels(renderPage) : []
  const starts = [...new Set(built.map((p) => p.rowStart))].sort((a, b) => a - b)
  const panels = built.map((p) => {
    const context = { ...p, contractLetters: built.filter((q) => q.rowStart === p.rowStart).flatMap((q) => q.rows.flatMap((r) => r.cells.map((c) => String(c.t || '').match(/^\(([a-z])\)$/)?.[1]))) }
    const panel = { ...p, rowBand: starts.indexOf(p.rowStart), ...analyzeColumns(context, id, specs, { reviewed: !baseline }) }
    const descriptor = ({'702': ['jurisdiction_name', /state or/i], '710S': ['title', /class of equipment/i],
      'PTC_710S': ['title', /class of equipment/i], '700': ['title', /^class$/i], 'PTC_700': ['title', /^class$/i]})[id]
    const descriptorCol = descriptor ? panel.rows.flatMap((r) => r.cells).find((c) => descriptor[1].test(c.t || ''))?.c : undefined
    panel.laidOut = layoutRows(panel.rows, panel.cols.length).map((cells, ri) => {
      const map = panel.rowMaps[ri] || new Map()
      const values = rowValues(data, panel.rows[ri].cells, panel, map, panel.rowBand, !baseline)
      const base = values && paths.get(values)
      const recordPath = base?.slice(0, -1)
      const record = recordPath && atPath(schedule, recordPath)
      // Match descriptors only on the row which selected this exact record.
      if (record && !baseline) {
        for (const key of ['title', 'jurisdiction_name', 'section_subheader']) {
          if (present(record[key]) && cells.some((c) => norm(c.t) === norm(record[key]) && c.c !== panel.lineCol
            && c.c !== panel.cols.length - 1)) consumed.add(pointerFor([...recordPath, key]))
        }
      }
      return cells.map((cell) => {
        if (cell.fieldPointer) { consumed.add(cell.fieldPointer); return cell }
        if (!baseline && record && descriptor && cell.c === descriptorCol && !cell.t && present(record[descriptor[0]])) {
          const pointer = pointerFor([...recordPath, descriptor[0]])
          consumed.add(pointer)
          return { ...cell, filedValue: record[descriptor[0]], fieldPointer: pointer, w: 1 }
        }
        const key = resolvedKey(values, map.get(cell.c))
        const fill = key && (!cell.t || isFillableMarker(cell.t))
        const value = fill ? resolveValue(values, key) : undefined
        if (base && fill && present(value) && typeof value !== 'object') {
          const parts = Object.hasOwn(values, key) ? [key] : key.split('.')
          const pointer = pointerFor([...base, ...parts])
          consumed.add(pointer)
          return { ...cell, filedValue: value, fieldPointer: pointer }
        }
        return { ...cell, valueColumn: Boolean(fill) }
      })
    })
    return panel
  })
  // The old filled panels already show unmatched answers, content and notes.
  for (const leaf of leaves) {
    if (leaf.path[0] === 'explanatory_notes' && ['note_id', 'text'].includes(leaf.path[2])) consumed.add(leaf.pointer)
    if (schedule?.answers && leaf.path[0] === 'answers' && !answers.matchedKeys.has(leaf.path[1])
      && ['text', 'date', 'choice', 'text_list', 'value'].includes(leaf.path[2])) consumed.add(leaf.pointer)
    if (!schedule?.answers && schedule?.content && leaf.path[0] === 'content' && leaf.path[2] === 'text') consumed.add(leaf.pointer)
    if (!schedule?.answers && !schedule?.content && schedule?.items && !specs[id]
      && leaf.path[0] === 'items' && leaf.path[2] === 'fields') consumed.add(leaf.pointer)
  }
  // Static labels are presentation too, but only when the *same matched row*
  // carries that label. Different source descriptions must stay visible.
  for (const leaf of baseline ? leaves : []) {
    if (!['title', 'jurisdiction_name', 'cross_check_accounts', 'section_subheader'].includes(leaf.path.at(-1))) continue
    // Descriptor coverage is intentionally conservative; filed details preserve
    // a changed label even when the latest blank form has a similar title.
    if (panels.some((p) => p.rows.some((r) => r.cells.some((c) => norm(c.t) === norm(leaf.value))))) {
      consumed.add(leaf.pointer)
    }
  }
  return { panels, leaves, consumed, unplaced: leaves.filter((leaf) => !consumed.has(leaf.pointer)), baseline }
}
