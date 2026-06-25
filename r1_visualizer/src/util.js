// Formatting helpers shared by all schedule renderers.

// snake_case / col_123 field key -> human header. Keeps the form readable
// without hand-mapping every column up front.
const ACRONYMS = new Set(['no', 'id', 'aar', 'stb', 'us', 'ttd', 'pl', 'mw', 'hp'])
export function prettifyKey(key) {
  if (key == null) return ''
  return String(key)
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

const NUM_FMT = new Intl.NumberFormat('en-US')

// Numbers in R-1 are integers in thousands; render with separators, blanks
// for null/empty, and a parenthesised style for negatives (accounting form).
export function formatValue(v) {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'number') {
    if (v === 0) return '-'
    const s = NUM_FMT.format(Math.abs(v))
    return v < 0 ? `(${s})` : s
  }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v).trim()
}

export function isNumeric(v) {
  return typeof v === 'number'
}

// Collect the union of cell keys across records, preserving first-seen order,
// so a table renders every column even if some rows omit a sparse field.
export function unionKeys(records, pick) {
  const seen = new Map()
  for (const r of records) {
    const obj = pick(r) || {}
    for (const k of Object.keys(obj)) if (!seen.has(k)) seen.set(k, true)
  }
  return [...seen.keys()]
}

// Form column letter for index i: 0 -> a, 1 -> b, ... 26 -> aa.
export function colLetter(i) {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    s = String.fromCharCode(97 + ((n - 1) % 26)) + s
  }
  return s
}

// Reorder `keys` to match the authoritative form column `order`. Spec columns
// present in the data come first (in form order); any keys not in the spec are
// appended so nothing is silently dropped.
export function orderKeys(keys, order) {
  if (!order || !order.length) return keys
  const set = new Set(keys)
  const ordered = order.filter((k) => set.has(k))
  const extra = keys.filter((k) => !order.includes(k))
  return [...ordered, ...extra]
}
