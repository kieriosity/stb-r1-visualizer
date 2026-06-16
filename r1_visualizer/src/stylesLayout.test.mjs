import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const css = await readFile(new URL('./styles.css', import.meta.url), 'utf8')

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'))
  assert.ok(match, `Missing CSS rule for ${selector}`)
  return match[1]
}

function includesDecl(block, decl) {
  assert.match(block.replace(/\s+/g, ' '), new RegExp(decl.replace(/\s+/g, '\\s*')))
}

test('picker stays visible while schedule data scrolls independently', () => {
  const picker = rule('.r1-picker')
  includesDecl(picker, 'position: sticky')
  includesDecl(picker, 'top: 0')
  includesDecl(picker, 'z-index:')

  const body = rule('.r1-body')
  includesDecl(body, 'max-height:')
  includesDecl(body, 'overflow: hidden')

  const nav = rule('.r1-nav')
  includesDecl(nav, 'overflow-y: auto')

  const main = rule('.r1-main')
  includesDecl(main, 'overflow: auto')
})
