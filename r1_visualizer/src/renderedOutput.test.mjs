import { build } from 'esbuild'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { splitCombinedPages } from './pageSchedules.js'
import { includeFiledSchedules } from './filedDetails.js'

// Execute the actual JSX components in a single-render harness. Memoization is
// bypassed, not presentation logic. This catches wiring omissions which a
// planner-only audit cannot (missing FiledDetails, ignored filedValue, etc.).
const compiled = await build({stdin:{contents:"export { FormFacsimile } from './src/FormFacsimile.jsx'; export { FiledDetails } from './src/FiledDetails.jsx';",resolveDir:process.cwd()},
  bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',jsxImportSource:'preact',
  plugins:[{name:'single-render-memo',setup(b){
    b.onResolve({filter:/^preact\/hooks$/},()=>({path:'hooks',namespace:'memo'}))
    b.onLoad({filter:/.*/,namespace:'memo'},()=>({contents:'export const useMemo = (fn) => fn();'}))
  }}]})
const { FormFacsimile, FiledDetails } = await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const template=JSON.parse(fs.readFileSync(new URL('./formTemplate.json',import.meta.url)))
const pages=splitCombinedPages(template.pages)
function expand(node,out=[]) {
  if(node==null || typeof node==='boolean') return out
  if(Array.isArray(node)) {node.forEach(n=>expand(n,out));return out}
  if(typeof node==='string'||typeof node==='number') {out.push({text:String(node)});return out}
  if(typeof node.type==='function') return expand(node.type(node.props),out)
  out.push(node); expand(node.props?.children,out); return out
}

test('real facsimile component renders C holder values and paginates them only on first page',()=>{
  const page=pages.find(p=>p.sheet==='Sch C')
  const schedule={child_collections:{holders:[{name:'Holder with <literal> text',votes_entitled:123456}]}}
  const first=expand(FormFacsimile({page,schedule,scheduleId:'C',panelIndex:0}))
  assert.ok(first.some(n=>n.text==='Holder with <literal> text'))
  assert.ok(first.some(n=>n.text==='123,456'))
  assert.ok(first.some(n=>n.type==='td'&&n.props['data-field-path']==='/child_collections/holders/0/name'))
  const second=expand(FormFacsimile({page,schedule,scheduleId:'C',panelIndex:1}))
  assert.ok(!second.some(n=>n.text==='Holder with <literal> text'))
})

test('real additional-data component preserves unknown nested values, false, zero and precision',()=>{
  const doc={schedules:{NEW:{rows:[{line_no:4,cells:{nested:{unknown:'extra'},zero:0,flag:false,precise:0.123456789012345}}]}}}
  const all=includeFiledSchedules(pages,doc.schedules), page=all.at(-1)
  const nodes=expand(FiledDetails({page,pages:all,doc}))
  for(const expected of ['extra','0','No','0.123456789012345']) assert.ok(nodes.some(n=>n.text===expected),expected)
  assert.equal(nodes.filter(n=>n.type==='tr'&&n.props['data-field-path']).length,4)
  assert.ok(nodes.find(n=>n.type==='details').props.open)
})

test('both app views mount filed details and missing template pages stay reachable',()=>{
  const app=fs.readFileSync(new URL('./App.jsx',import.meta.url),'utf8')
  assert.equal((app.match(/<FiledDetails /g)||[]).length,2)
  assert.match(app,/includeFiledSchedules\(splitCombinedPages/)
})

test('retained legacy tables remain distinct and show every raw cell',()=>{
  const doc={schedules:{},legacy_schedules:{250:{schedule_id:'250',rows:[['Item','Begin','End'],['Investment',10,20]]}}}
  const all=includeFiledSchedules(pages,doc.schedules,doc.legacy_schedules),page=all.at(-1)
  assert.equal(page.legacyFor,'250')
  const nodes=expand(FiledDetails({page,pages:all,doc}))
  for(const text of ['Item','Begin','End','Investment','10','20']) assert.ok(nodes.some(n=>n.text===text))
  assert.equal(nodes.filter(n=>n.type==='tr'&&n.props['data-field-path']).length,6)
})
