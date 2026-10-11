import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildGridPanels } from './formGrid.js'
import { pagesForVersion } from './formVersion.js'
import { splitCombinedPages } from './pageSchedules.js'
import { prepareForm } from './formPresentation.js'
import { extractedPagesForSource, linkedExtractedPage } from './sourceReview.js'

const template = JSON.parse(readFileSync(new URL('./formTemplate.json', import.meta.url)))
const specs = JSON.parse(readFileSync(new URL('./columnSpec.json', import.meta.url)))
const pages = splitCombinedPages(pagesForVersion(template, '2026-07-31'))
const pageFor = (id) => pages.find(p=>p.schedule===id)
const text = (panel) => panel.rows.flatMap(r=>r.cells.map(c=>c.t || '')).join(' ')

test('current form has 113 panels with notes and continuation pages in PDF order', () => {
  const panels = pages.flatMap(buildGridPanels)
  assert.equal(panels.length, 113)
  for (const [physical, heading] of [[23, 'Notes and Remarks For Schedules 210 and 220'],
    [42, 'NOTES AND REMARKS FOR SCHEDULE 342'], [63, '502.'], [100, 'NOTES AND REMARKS']]) {
    assert.ok(text(panels[physical-1]).includes(heading), `PDF page ${physical}`)
  }
  for(let i=92;i<=98;i++) assert.match(text(panels[i-1]), /PTC 410\.  RAILWAY OPERATING EXPENSES/)
})

test('501 has no stray header panel and 502 retains its printed page header in both editions', () => {
  for(const version of template.form_versions) {
    const versionPages=pagesForVersion(template,version)
    assert.equal(buildGridPanels(versionPages.find(p=>p.schedule==='501')).length,1)
    const second=buildGridPanels(versionPages.find(p=>p.schedule==='502'))[0]
    assert.match(text({...second,rows:second.rows.slice(0,3)}), /Road Initials.*Year.*502\./)
  }
})

test('PTC 410 values on all seven pages retain their correct row and column', () => {
  const lines=[1,101,134,217,313,422,518,620]
  const schedule={rows:lines.map(line_no=>({line_no,values:{total:line_no*100}}))}
  const plan=prepareForm(pageFor('PTC_410'),schedule,'PTC_410',specs)
  const expected=[0,1,2,3,4,5,6,6]
  lines.forEach((line,i)=>{
    const hits=plan.panels.flatMap((panel,p)=>panel.laidOut.flat().filter(c=>c.fieldPointer===`/rows/${i}/values/total`).map(c=>({p,c})))
    assert.equal(hits.length,1,`line ${line}`)
    assert.equal(hits[0].p,expected[i],`line ${line} panel`)
    assert.equal(hits[0].c.c,11)
    assert.equal(hits[0].c.filedValue,line*100)
  })
})

test('paired navigation traverses the seven PTC 410 panels forward and backward', () => {
  const manifest={pages:Array.from({length:7},(_,i)=>({page:i+92,schedules:['PTC_410']}))}
  let previous=null
  for(const n of [92,93,94,95,96,97,98,97,96,95,94,93,92]) {
    const sourcePage=manifest.pages.find(p=>p.page===n)
    const choices=extractedPagesForSource(pages,sourcePage)
    assert.equal(choices.length,7)
    const chosen=linkedExtractedPage(choices,manifest,sourcePage,previous)
    assert.equal(chosen.page.comparisonPanel,n-92)
    previous={sourcePage,chosen}
  }
})
