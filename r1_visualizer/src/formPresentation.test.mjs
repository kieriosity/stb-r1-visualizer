import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { filedLeaves, prepareForm } from './formPresentation.js'
import { detailRows, includeFiledSchedules, schedulePresentation } from './filedDetails.js'
import { splitCombinedPages, pageMatchesSchedule } from './pageSchedules.js'
import { extractedPagesForSource } from './sourceReview.js'
import { pagesForVersion } from './formVersion.js'
import { injectAnswers, matchAnswers } from './narrativeAnswers.js'

const template = JSON.parse(fs.readFileSync(new URL('./formTemplate.json', import.meta.url)))
const specs = JSON.parse(fs.readFileSync(new URL('./columnSpec.json', import.meta.url)))
const pages = splitCombinedPages(pagesForVersion(template,'2026-07-31'))
const pageFor = (id) => pages.find((p) => pageMatchesSchedule(p,id))
const cells = (plan) => plan.panels.flatMap((p) => p.laidOut.flat())

test('Schedule C places all six holder fields on first page only; overflow stays available', () => {
  const holder = {name:'Example Railway',address:'A very long address',votes_entitled:250,
    common_stock_votes:200,second_preferred_stock_votes:0,first_preferred_stock_votes:50}
  const schedule = {child_collections:{holders:Array.from({length:31},(_,i)=>({...holder,name:`Holder ${i+1}`}))}}
  const plan = prepareForm(pageFor('C'),schedule,'C',specs)
  assert.equal(plan.panels.length,2)
  assert.equal(plan.panels[0].laidOut.flat().filter((c)=>c.fieldPointer).length,180)
  assert.equal(plan.panels[1].laidOut.flat().filter((c)=>c.fieldPointer).length,0)
  assert.equal(plan.unplaced.length,6)
  assert.ok(plan.unplaced.every((l)=>l.path[2]===30))
  assert.equal(cells(plan).find((c)=>c.fieldPointer==='/child_collections/holders/0/votes_entitled').filedValue,250)
  assert.equal(cells(plan).find((c)=>c.fieldPointer==='/child_collections/holders/0/second_preferred_stock_votes').filedValue,0)
})

test('Schedule A fills the unnumbered Page / Schedule / Title table without changing template', () => {
  const page=pageFor('A'), original=JSON.stringify(page)
  const schedule={items:[{fields:{page_number:81,schedule_number:'PTC',title:'PTC Supplement'}}]}
  const p=prepareForm(page,schedule,'A',specs)
  assert.equal(cells(p).filter(c=>c.fieldPointer).length,3)
  assert.equal(p.unplaced.length,0)
  assert.equal(JSON.stringify(page),original)
})

test('Schedule C answers wrap and retain multiline text', () => {
  const page=pageFor('C'), schedule={answers:{Q10:{answer_type:'text',text:'99 votes\nSee remarks'}}}
  const answer=injectAnswers(page,matchAnswers(page,schedule).rowAnswers).rows.flatMap(r=>r.cells).find(c=>c.t?.includes('99 votes'))
  assert.equal(answer.w,1)
  assert.match(answer.t,/\n99 votes\nSee remarks$/)
})

test('702 jurisdiction and 710S equipment descriptions accompany their numbers', () => {
  for(const [id,schedule,pointer,value] of [
    ['702',{rows:[{line_no:1,jurisdiction_name:'Alabama',measures:{total_mileage_operated:12}}]},'/rows/0/jurisdiction_name','Alabama'],
    ['710S',{categories:[{line_no:1,title:'Locomotive model X',measures:{number_of_units:2}}]},'/categories/0/title','Locomotive model X'],
  ]) assert.equal(cells(prepareForm(pageFor(id),schedule,id,specs)).find(c=>c.fieldPointer===pointer)?.filedValue,value)
})

test('reviewed 415 column j uses capitalized accumulated depreciation, not investment', () => {
  const schedule={rows:[{line_no:1,cells:{investment_base_as_of_12_31:{capitalized_lease:11},accumulated_depreciation_as_of_12_31:{capitalized_lease:22}}}]}
  const p=prepareForm(pageFor('415'),schedule,'415',specs)
  const right=p.panels[1].laidOut.flat()
  assert.equal(right.find(c=>c.fieldPointer?.endsWith('/investment_base_as_of_12_31/capitalized_lease')).c,4)
  assert.equal(right.find(c=>c.fieldPointer?.endsWith('/accumulated_depreciation_as_of_12_31/capitalized_lease')).c,6)
})

test('310A canonical renamed fields reach correct printed columns', () => {
  const schedule={items:[{line_no:1,fields:{name_of_issuing_company_and_description:'Company Q',adjustment_for_investments_disposed_or_written_down:27}}]}
  const p=prepareForm(pageFor('310A'),schedule,'310A',specs)
  assert.deepEqual(cells(p).filter(c=>c.fieldPointer).map(c=>[c.c,c.filedValue]),[[1,'Company Q'],[6,27]])
})

test('710 freight and floating equipment use legacy suffixed keys on both facing pages', () => {
  const page=pages.find(p=>p.sheet==='710 portrait')
  const schedule={categories:[36,56].map(line_no=>({line_no,measures:{respondent_begin_year_time_mileage_cars:111,owned_and_used_col_t:222,agg_cap_of_units_reported_in_col_col_x:333}}))}
  const p=prepareForm(page,schedule,'710',specs)
  for(let i=0;i<2;i++) {
    const hits=cells(p).filter(c=>c.fieldPointer?.startsWith(`/categories/${i}/`))
    assert.equal(hits.length,i === 0 ? 3 : 2)
    assert.deepEqual(hits.map(c=>c.filedValue).sort(),i === 0 ? [111,222,333] : [222,333])
  }
  // Floating equipment's time-mileage-car count is N/A; preserve the
  // conflicting filed value in details rather than painting over N/A.
  assert.ok(p.unplaced.some(l=>l.pointer==='/categories/1/measures/respondent_begin_year_time_mileage_cars'))
})

test('unmapped, duplicate, nested, false, zero, and overflow values remain individually addressable', () => {
  const schedule={items:[{line_no:999,fields:{known:0,flag:false,nested:{x:17}}},{line_no:999,fields:{known:9}}]}
  const p=schedulePresentation(pages,schedule,'510',specs)
  assert.equal(p.unplaced.length,4)
  assert.deepEqual(detailRows(p.unplaced,schedule).map(r=>r.value),[0,false,17,9])
  assert.equal(new Set(detailRows(p.unplaced,schedule).map(r=>r.pointer)).size,4)
})

test('blocked and static cells keep filed conflicts in additional data', () => {
  const page={cols:[10,20,20],rows:[{cells:[{c:0,t:'Line'},{c:1,t:'Freight'},{c:2,t:'Passenger'}]},
    {cells:[{c:0,t:'1'},{c:1,bd:'tblr'},{c:2,t:'XXXXXX',bd:'tblr'}]}]}
  const schedule={rows:[{line_no:1,cells:{freight:100,passenger:42}}]}
  const p=prepareForm(page,schedule,'X',{X:{columns:['freight','passenger'],valueKey:'cells'}})
  assert.ok(p.unplaced.some(l=>l.value===42))
  assert.equal(cells(p).find(c=>c.t==='XXXXXX').filedValue,undefined)
})

test('every filed schedule is reachable even without an edition template, including comparison', () => {
  const all=includeFiledSchedules(pages,{'415A':{rows:[]},'515':{rows:[]}})
  for(const id of ['415A','515']) {
    const page=all.find(p=>p.schedule===id)
    assert.equal(page.filedOnly,true)
    assert.equal(extractedPagesForSource(all,{schedules:[id]}).length,1)
    assert.equal(prepareForm(page,{},id,specs).panels.length,0)
  }
})

test('metadata exclusions do not swallow same-named fields inside value containers', () => {
  const leaves=filedLeaves({schedule_id:'X',revision:{id:'meta'},items:[{line_no:1,fields:{line_no:22,revision:'filed'}}]})
  assert.deepEqual(leaves.map(l=>l.value),[22,'filed'])
})

test('conflicting duplicate rows are kept in details instead of choosing an arbitrary value', () => {
  const schedule={items:[{line_no:1,fields:{balance_close_of_year:10}},{line_no:1,fields:{balance_close_of_year:20}}]}
  const p=prepareForm(pageFor('510'),schedule,'510',specs)
  assert.equal(cells(p).filter(c=>c.fieldPointer).length,0)
  assert.deepEqual(p.unplaced.map(l=>l.value),[10,20])
})

test('Schedule 512 shows a split Receivable / Payable column in its one printed cell', () => {
  // SOO 2017 line 3: (d) 12,337 receivable and 8,484 payable; (e) 7,155 receivable only.
  const schedule = {items: [{line_no: 3, fields: {name_of_co_or_related_party_with_percent: 'Canadian Pacific',
    dollar_amounts_of_transactions_receivable: 12337, dollar_amounts_of_transactions_payable: 8484,
    amount_due_from_or_to_related_parties_receivable: 7155}}]}
  const plan = prepareForm(pageFor('512'), schedule, '512', specs)
  const shown = cells(plan).filter((c) => c.fieldPointer).map((c) => c.filedValue)
  assert.ok(shown.includes('12,337 (R)  8,484 (P)'), JSON.stringify(shown))
  assert.ok(shown.includes('7,155 (R)'), JSON.stringify(shown))
  assert.equal(plan.unplaced.filter((l) => /receivable|payable/.test(l.pointer)).length, 0)
})

test('lines a carrier adds past the form get rows on its last page (BNSF 2019 Schedule 310A)', () => {
  const item = (line_no, name, balance) => ({ line_no, fields: { name_of_issuing_company_and_description: name,
    balance_at_beginning_of_year: balance } })
  const schedule = { items: [item(1, 'Alameda Belt Line', 0), item(27, 'TOTAL NON-CARRIERS', 32811),
    item(29, 'TOTAL INVESTMENTS IN COMMON STOCK', 748310)] }
  const before = JSON.stringify(pages)
  const extended = includeFiledSchedules(pages, { '310A': schedule })
  assert.equal(JSON.stringify(pages), before, 'the template pages are not changed')
  const page = extended.find((p) => pageMatchesSchedule(p, '310A'))
  const added = page.rows.filter((r) => r.carrierLine != null)
  assert.deepEqual(added.map((r) => r.cells.find((c) => c.c === 0).t), ['28', '29'])
  assert.ok(added.every((r) => r.carrierLine === 27))
  const shown = cells(prepareForm(page, schedule, '310A', specs)).filter((c) => c.fieldPointer)
  assert.equal(shown.find((c) => c.fieldPointer === '/items/2/fields/balance_at_beginning_of_year')?.filedValue, 748310)
  assert.equal(shown.find((c) => c.fieldPointer === '/items/2/fields/name_of_issuing_company_and_description')?.filedValue,
    'TOTAL INVESTMENTS IN COMMON STOCK')
  // Lines within the form, and a paginated list's own pages, add nothing.
  const within = includeFiledSchedules(pages, { '310A': { items: [item(27, 'TOTAL', 1)] } })
  assert.equal(within.find((p) => pageMatchesSchedule(p, '310A')), pageFor('310A'))
  const blocks = includeFiledSchedules(pages, { '310A': { items: [{ ...item(29, 'X', 1), block: 1 }] } })
  assert.equal(blocks.find((p) => pageMatchesSchedule(p, '310A')), pageFor('310A'))
  // The model is the last plain line: Schedule 352A's last printed line is its
  // right-aligned TOTAL, which an added company line must not copy.
  const page352 = includeFiledSchedules(pages, { '352A': { items: [item(32, 'Tacoma Rail', 1)] } })
    .find((p) => pageMatchesSchedule(p, '352A'))
  const row352 = page352.rows.find((r) => r.carrierLine != null)
  const plain = pageFor('352A').rows.find((r) => r.cells.some((c) => String(c.t ?? '').trim() === '30'))
  assert.deepEqual(row352.cells.map((c) => c.ha), plain.cells.map((c) => c.ha))
  assert.ok(!row352.cells.some((c) => /total/i.test(c.t ?? '')))
})
