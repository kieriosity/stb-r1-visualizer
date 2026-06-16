import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const template = JSON.parse(fs.readFileSync(new URL('./formTemplate.json', import.meta.url), 'utf8'))

test('account-number labels preserve parenthesized Excel display formatting', () => {
  const accountLabelColsBySchedule = new Map([
    ['330', new Set([2])],
    ['332', new Set([1])],
    ['335', new Set([2])],
    ['342', new Set([2])],
    ['352B', new Set([2])],
    ['PTC_330', new Set([2])],
    ['PTC_332', new Set([1])],
    ['PTC_335', new Set([2])],
    ['PTC_352B', new Set([2])],
  ])
  const negativeLabels = []
  for (const page of template.pages) {
    const accountCols = accountLabelColsBySchedule.get(page.schedule)
    if (!accountCols) continue
    for (const row of page.rows) {
      for (const cell of row.cells) {
        const text = String(cell.t ?? '').trim()
        if (accountCols.has(cell.c) && /^-\d+$/.test(text)) {
          negativeLabels.push(`${page.sheet} c${cell.c}: ${text}`)
        }
      }
    }
  }

  assert.deepEqual(negativeLabels, [])
})

test('side footer labels preserve stacked vertical text rotation', () => {
  const schedule720 = template.pages.find((page) => page.schedule === '720')
  const sideFooter = schedule720.rows
    .flatMap((row) => row.cells)
    .find((cell) => cell.c === 0 && cell.t === '-1')

  assert.equal(sideFooter.tr, 180)
})
