// Place narrative_qa answers (Schedules B and C) onto the printed form's numbered
// inquiry lines, so the filed answers read inside the facsimile instead of in a
// separate panel above it. The form prints each inquiry number twice (instructions
// then the answer prompt), so the LAST row whose first cell is "N." is the answer
// line. Answers whose number has no inquiry line (over-extracted keys) stay in the
// fallback panel rather than being dropped.

export function answerText(a) {
  if (a == null) return ''
  if (typeof a !== 'object') return String(a)
  switch (a.answer_type) {
    case 'text': return a.text || ''
    case 'date': return a.date || ''
    case 'choice': return a.choice || ''
    case 'not_applicable': return 'Not applicable'
    case 'text_list': return (a.text_list || []).filter(Boolean).join('; ')
    default: return String(a.text ?? a.value ?? '')
  }
}

const INQUIRY_RE = /^\s*(\d+)\.\s*$/

export function matchAnswers(page, schedule) {
  const answers = schedule?.answers
  const empty = { rowAnswers: {}, matchedKeys: new Set() }
  if (!answers || !Array.isArray(page?.rows)) return empty

  const numText = {}      // "1" -> combined answer text
  const numKeys = {}      // "1" -> [answer keys] (Q1, Q1a -> "1")
  for (const [key, a] of Object.entries(answers)) {
    const m = String(key).match(/(\d+)/)
    if (!m) continue
    const n = m[1]
    ;(numKeys[n] = numKeys[n] || []).push(key)
    const txt = answerText(a).trim()
    if (txt) numText[n] = numText[n] ? `${numText[n]} ${txt}` : txt
  }

  const lastRow = {}      // "1" -> form row index of the answer prompt
  page.rows.forEach((row, i) => {
    const c0 = (row.cells || []).find((c) => c.c === 0)
    const m = c0 && String(c0.t || '').match(INQUIRY_RE)
    if (m && numText[m[1]] != null) lastRow[m[1]] = i
  })

  const rowAnswers = {}
  const matchedKeys = new Set()
  for (const [n, i] of Object.entries(lastRow)) {
    rowAnswers[i] = numText[n]
    for (const k of numKeys[n] || []) matchedKeys.add(k)
  }
  return { rowAnswers, matchedKeys }
}

// Append each matched answer to its inquiry-prompt row so it renders on the form.
export function injectAnswers(page, rowAnswers) {
  if (!page || !rowAnswers || !Object.keys(rowAnswers).length) return page
  const rows = page.rows.map((row, i) => {
    const answer = rowAnswers[i]
    if (!answer) return row
    const cells = (row.cells || []).map((c) => ({ ...c }))
    let prompt = null
    for (const c of cells) if (c.t != null && String(c.t).trim()) prompt = c
    if (prompt) prompt.t = `${prompt.t}    ${answer}`
    else cells.push({ c: 1, t: answer })
    return { ...row, cells }
  })
  return { ...page, rows }
}
