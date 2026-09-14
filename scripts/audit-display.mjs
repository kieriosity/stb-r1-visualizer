import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { prepareForm } from '../r1_visualizer/src/formPresentation.js'
import { pagesForVersion, resolveFormVersion } from '../r1_visualizer/src/formVersion.js'
import { splitCombinedPages, pageMatchesSchedule } from '../r1_visualizer/src/pageSchedules.js'
import { includeFiledSchedules, detailRows } from '../r1_visualizer/src/filedDetails.js'

const [root, output, mode] = process.argv.slice(2)
const baseline = mode === '--baseline'
if (!root || !output) throw new Error('Usage: node scripts/audit-display.mjs REPORTING_ROOT OUTPUT_JSON')
const src = new URL('../r1_visualizer/src/', import.meta.url)
const template = JSON.parse(fs.readFileSync(new URL('formTemplate.json', src)))
const specs = JSON.parse(fs.readFileSync(new URL('columnSpec.json', src)))
const report = { scope: 'Populated schedule leaves in published JSON versus planned form cells, existing filled/notes panels, and additional filed data. Empty scalars excluded; zero and false retained. Structural IDs and revision metadata excluded. Accessibility, not extraction accuracy or pixel-level certification.',
  mode: baseline ? 'baseline' : 'candidate',
  template_sha256: crypto.createHash('sha256').update(fs.readFileSync(new URL('formTemplate.json', src))).digest('hex'),
  filings: [], schedules: {}, legacy_schedules: {}, production_certified: false }
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((x) => x.isDirectory() ? files(path.join(dir,x.name)) : [path.join(dir,x.name)]) }
for (const file of files(root).filter((p) => p.endsWith('.json') && !p.endsWith('.transform-log.json'))) {
  const bytes = fs.readFileSync(file)
  const doc = JSON.parse(bytes)
  if (!doc.schedules) continue
  const formPages = splitCombinedPages(pagesForVersion(template, resolveFormVersion(doc,template)))
  const pages = baseline ? formPages : includeFiledSchedules(formPages, doc.schedules, doc.legacy_schedules)
  const summary = { file: path.relative(root,file), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), schedules: {} }
  for (const [id,schedule] of Object.entries(doc.schedules)) {
    const matched = pages.filter((p) => pageMatchesSchedule(p,id))
    const plans = (matched.length ? matched : [{}]).map((p) => prepareForm(p,schedule,id,specs,{baseline}))
    const consumed = new Set(matched.length ? plans.flatMap((p) => [...p.consumed]) : [])
    const leaves = plans[0].leaves
    const unplaced = leaves.filter((l) => !consumed.has(l.pointer))
    const details = baseline ? [] : detailRows(unplaced, schedule)
    const accessible = new Map([...leaves.filter(l=>consumed.has(l.pointer)), ...details].map(l=>[l.pointer,l.value]))
    const missing = leaves.filter(l=>!accessible.has(l.pointer) || !Object.is(accessible.get(l.pointer),l.value))
    const totals = report.schedules[id] ||= { filings:0, no_page:0, populated:0, displayed:0, unplaced:0, additional:0, inaccessible:0, fields:{}, examples:[] }
    totals.filings++; totals.no_page += !matched.length; totals.populated += leaves.length; totals.displayed += consumed.size; totals.unplaced += unplaced.length
    totals.additional += details.length; totals.inaccessible += missing.length
    for (const leaf of unplaced) {
      const key = leaf.path.filter((p) => typeof p !== 'number').join('.')
      totals.fields[key] = (totals.fields[key] || 0) + 1
      if (totals.examples.length < 6) totals.examples.push({file:summary.file,...leaf})
    }
    summary.schedules[id] = {page:!!matched.length,populated:leaves.length,displayed:consumed.size,unplaced:unplaced.length,additional:details.length,inaccessible:missing.length}
  }
  for (const [id,schedule] of Object.entries(doc.legacy_schedules || {})) {
    const page = pages.find(p=>p.legacyFor===id)
    const plan = prepareForm(page || {},schedule,id,specs,{baseline})
    const details = page ? detailRows(plan.unplaced,schedule) : []
    const totals = report.legacy_schedules[id] ||= {filings:0,populated:0,additional:0,inaccessible:0}
    totals.filings++; totals.populated += plan.leaves.length; totals.additional += details.length
    totals.inaccessible += plan.leaves.length - details.length
  }
  report.filings.push(summary)
  if (report.filings.length % 25 === 0) console.log('Audited',report.filings.length)
}
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({filings:report.filings.length,schedules:Object.keys(report.schedules).length,inaccessible:Object.values(report.schedules).reduce((n,s)=>n+s.inaccessible,0)},null,2))
if (!baseline && [...Object.values(report.schedules),...Object.values(report.legacy_schedules)].some(s=>s.inaccessible || s.no_page)) process.exitCode=1
