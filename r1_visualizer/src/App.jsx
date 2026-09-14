import { useEffect, useMemo, useState } from 'preact/hooks'
import { createStaticSource } from './dataSource.js'
import { resolveConfig } from './config.js'
import { FormFacsimile, findingRowId } from './FormFacsimile.jsx'
import { FilledPanel, NotesPanel } from './FilledPanel.jsx'
import { FiledDetails } from './FiledDetails.jsx'
import { includeFiledSchedules } from './filedDetails.js'
import { pageWidthPx } from './formGrid.js'
import { anchorFindings, findingLineNo } from './findingLocation.js'
import { shouldRenderFacsimile } from './pageRender.js'
import { navScheduleLabel, pageHasData, pageMatchesSchedule, primaryScheduleIdForPage, splitCombinedPages } from './pageSchedules.js'
import { findingCountsByPage, findingsForPage, normalizeReviewFindings } from './reviewFindings.js'
import { pagesForVersion, resolveFormVersion } from './formVersion.js'
import { asFiledDeviations, describeFiling, describeSchedule, ocrPageUrl, profileLabel } from './lineage.js'
import formTemplate from './formTemplate.json'
import { SourceComparison } from './SourceComparison.jsx'
import { IssueReport } from './IssueReport.jsx'
import { captureIssueContext } from './issueReport.js'

export function App({ options = {} }) {
  const config = useMemo(() => resolveConfig(options), [options])
  const source = useMemo(
    () => createStaticSource(config.dataBase, config.reviewFindingsBase, config.lineageBase),
    [config.dataBase, config.reviewFindingsBase, config.lineageBase])

  const [template] = useState(formTemplate)
  const [subs, setSubs] = useState([])
  const [sel, setSel] = useState(null) // { carrier, year, version, file }
  const [loadedDoc, setLoadedDoc] = useState(null)
  const [issueContext, setIssueContext] = useState(null)
  const doc = loadedDoc && loadedDoc.file === sel?.file ? loadedDoc.data : null
  const [reviewFindings, setReviewFindings] = useState([])
  const [lineage, setLineage] = useState(null)
  const [activePage, setActivePage] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [compareSource, setCompareSource] = useState(() => Boolean(config.sourceBase &&
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('sourcePage')))

  // Load manifest once.
  useEffect(() => {
    source.listSubmissions()
      .then((list) => {
        setSubs(list)
        if (list.length) {
          const want = list.filter((s) =>
            (!options.carrier || s.carrier === options.carrier) &&
            (!options.year || s.year === Number(options.year)) &&
            (!options.version || s.version === Number(options.version)))
          const pick = (want.length ? want : list)[want.length ? want.length - 1 : list.length - 1]
          setSel(pick)
        }
      })
      .catch((e) => setError(`Could not load manifest: ${e.message}`))
  }, [source])

  // Load review-only DQ findings when the host page provides a sidecar base.
  useEffect(() => {
    if (!config.reviewFindingsBase) {
      setReviewFindings([])
      return
    }
    source.loadReviewFindings()
      .then((payload) => setReviewFindings(normalizeReviewFindings(payload)))
      .catch(() => setReviewFindings([]))
  }, [source, config.reviewFindingsBase])

  // Load selected submission.
  useEffect(() => {
    if (!sel) return
    let cancelled = false
    setLoading(true)
    setError(null)
    source.loadSubmissionSnapshot(sel.file)
      .then((snapshot) => { if (!cancelled) setLoadedDoc({ file: sel.file, ...snapshot }) })
      .catch((e) => { if (!cancelled) setError(`Could not load ${sel.file}: ${e.message}`) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sel, source])

  // Load the submission's lineage (where each schedule came from) when the host
  // provides it; absent lineage just hides the provenance panel.
  useEffect(() => {
    let cancelled = false
    setLineage(null)
    if (!sel || !config.lineageBase) {
      setLineage(null)
      return
    }
    source.loadLineage(sel)
      .then((l) => { if (!cancelled) setLineage(l) })
      .catch(() => { if (!cancelled) setLineage(null) })
    return () => { cancelled = true }
  }, [sel, source, config.lineageBase])

  const carriers = useMemo(() => [...new Set(subs.map((s) => s.carrier))].sort(), [subs])
  const years = useMemo(
    () => (sel ? [...new Set(subs.filter((s) => s.carrier === sel.carrier).map((s) => s.year))].sort((a, b) => a - b) : []),
    [subs, sel])
  const versions = useMemo(
    () => (sel ? subs.filter((s) => s.carrier === sel.carrier && s.year === sel.year).map((s) => s.version).sort((a, b) => a - b) : []),
    [subs, sel])

  function pickSub(carrier, year, version) {
    const candidates = subs.filter((s) => s.carrier === carrier)
    const y = candidates.some((s) => s.year === year) ? year : candidates[candidates.length - 1]?.year
    const inYear = candidates.filter((s) => s.year === y)
    const v = inYear.some((s) => s.version === version) ? version : inYear[inYear.length - 1]?.version
    const hit = subs.find((s) => s.carrier === carrier && s.year === y && s.version === v)
    if (hit) setSel(hit)
  }

  // The facsimile is form-version-aware: the STB renumbered Schedule 200 (and
  // revised 210, added 210A) across revisions, so render the page set matching the
  // filing's form_version. Falls back to the latest revision before a doc loads.
  const formVersion = resolveFormVersion(doc, template)
  const pages = useMemo(
    () => includeFiledSchedules(splitCombinedPages(pagesForVersion(template, formVersion)), doc?.schedules, doc?.legacy_schedules), [template, formVersion, doc])
  const dataSchedules = useMemo(
    () => new Set([...Object.keys(doc?.schedules || {}), ...Object.keys(doc?.legacy_schedules || {})]), [doc])

  // Every schedule that filed explanatory notes gets its OWN side-nav tab + page:
  // a synthetic "Explanatory notes" page inserted right after that schedule's last
  // template page (appended if the schedule has no template page). This keeps the
  // notes off the schedule's facsimile and gives them a dedicated, linkable view.
  const notesSchedules = useMemo(
    () => Object.keys(doc?.schedules || {})
      .filter((id) => ((doc.schedules[id] || {}).explanatory_notes || []).length > 0),
    [doc])
  const navPages = useMemo(() => {
    if (!notesSchedules.length) return pages
    const out = []
    const pending = new Set(notesSchedules)
    pages.forEach((p, i) => {
      out.push(p)
      for (const id of [...pending]) {
        const isLastPageOfSchedule = pageMatchesSchedule(p, id) &&
          !pages.slice(i + 1).some((q) => pageMatchesSchedule(q, id))
        if (isLastPageOfSchedule) {
          out.push({ sheet: 'Explanatory notes', schedule: id, notesFor: id })
          pending.delete(id)
        }
      }
    })
    for (const id of pending) out.push({ sheet: 'Explanatory notes', schedule: id, notesFor: id })
    return out
  }, [pages, notesSchedules])

  // Default page: a ?sched=<id> / #<id> deep link if present, else the first
  // page the submission has data for, else page 0.
  useEffect(() => {
    if (!navPages.length || !doc) return
    let want = null
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('sched')
      want = q || decodeURIComponent((window.location.hash || '').replace(/^#/, '')) || null
    }
    let idx = want ? navPages.findIndex((p) => pageMatchesSchedule(p, want)) : -1
    if (idx < 0) idx = navPages.findIndex((p) => pageHasData(p, dataSchedules))
    setActivePage(idx >= 0 ? idx : 0)
  }, [template, doc, dataSchedules, navPages])

  const page = navPages[activePage]
  // The schedule a page draws data from - page.schedule, or the SHEET_SCHEDULES
  // mapping for combined sheets (Sch C -> C, Memoranda -> Memoranda) so the
  // facsimile gets the data (e.g. to place narrative answers on the form).
  const primaryScheduleId = primaryScheduleIdForPage(page)
  const pageSchedule = primaryScheduleId ? doc?.schedules?.[primaryScheduleId] : null
  const renderFacsimile = !page?.notesFor && shouldRenderFacsimile(page)
  // Width of the printed form for this page, so the filled-data panel above the
  // facsimile lines up to the same width (only when a facsimile actually renders).
  const pageWidth = useMemo(
    () => (renderFacsimile ? pageWidthPx(page) : 0), [page, renderFacsimile])
  const pageFindings = useMemo(
    () => findingsForPage(reviewFindings, sel, page),
    [reviewFindings, sel, page])
  const anchored = useMemo(
    () => anchorFindings(pageFindings, primaryScheduleId, doc),
    [pageFindings, primaryScheduleId, doc])
  const findingCounts = useMemo(
    () => findingCountsByPage(navPages, reviewFindings, sel),
    [navPages, reviewFindings, sel])

  function renderComparedPage(p) {
    const id = primaryScheduleIdForPage(p)
    const findings = findingsForPage(reviewFindings, sel, p)
    if (p.notesFor) return <NotesPanel id={p.notesFor} schedule={doc.schedules?.[p.notesFor]} />
    return <><FilledPanel page={p} doc={doc} width={pageWidthPx(p)} />
      {shouldRenderFacsimile(p) && <FormFacsimile page={p} schedule={doc.schedules?.[id]}
        scheduleId={id} envelope={doc.envelope} panelIndex={p.comparisonPanel}
        findingsByLine={anchorFindings(findings, id, doc).byLine} />}
      <FiledDetails page={p} pages={navPages} doc={doc} /></>
  }

  function renderComparedFindings(p) {
    return <DqSidePanel findings={findingsForPage(reviewFindings, sel, p)} scheduleId={p.schedule}
      doc={doc} lineage={lineage} lineageScheduleId={primaryScheduleIdForPage(p)} ocrBase={config.ocrBase} />
  }

  const reportIssue = config.issuesBase && doc && loadedDoc.sha256
    ? (p, comparison = null) => setIssueContext(captureIssueContext(sel, loadedDoc.sha256, p, formVersion, comparison))
    : null

  return (
    <div class="r1-app">
      <Picker {...{ carriers, years, versions, sel, pickSub }} lineage={lineage} />
      {(config.sourceBase || config.issuesBase) && !compareSource && <div class="r1-source-action">
        {config.sourceBase && <><button type="button" disabled={!doc || loading} onClick={() => setCompareSource(true)}>Compare source pages</button>
          <span>Original PDF beside the extracted form</span></>}
        {config.issuesBase && <><button type="button" disabled={!reportIssue || loading}
          title={!reportIssue ? 'Load a filing on localhost or HTTPS to report an issue.' : undefined}
          onClick={() => reportIssue(page)}>Report issue</button>
          <a href={`${config.issuesBase}/`} target="_blank" rel="noopener">View issue log</a></>}
      </div>}
      {issueContext && <IssueReport base={config.issuesBase} context={issueContext} close={() => setIssueContext(null)} />}
      {error && <div class="r1-error">{error}</div>}
      {!template && !error && <div class="r1-loading">Loading form…</div>}
      {compareSource && doc && <SourceComparison key={sel.file} base={config.sourceBase} sel={sel}
        navPages={navPages} scheduleId={primaryScheduleId} renderPage={renderComparedPage}
        renderFindings={renderComparedFindings} close={() => setCompareSource(false)}
        issuesBase={config.issuesBase} reportIssue={reportIssue} />}
      {compareSource && !doc && !error && <div class="r1-loading">Loading extraction…</div>}
      {template && !compareSource && (
        <div class="r1-body">
          <nav class="r1-nav">
            <ul>
              {navPages.map((p, i) => {
                const hasData = pageHasData(p, dataSchedules)
                const findingCount = findingCounts[i] || 0
                return (
                  <li>
                    <button
                      class={'r1-nav-item' + (i === activePage ? ' is-active' : '')
                        + (hasData ? ' has-data' : '') + (p.notesFor ? ' is-notes' : '')}
                      onClick={() => setActivePage(i)}
                      title={p.notesFor ? `Schedule ${p.notesFor} — explanatory notes` : p.sheet}
                    >
                      <span class="r1-nav-id">{p.notesFor ? `${p.notesFor} ✎` : navScheduleLabel(p)}</span>
                      <span class="r1-nav-name">{p.sheet}</span>
                      {findingCount > 0 && <span class="r1-nav-finding-count">{findingCount}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
          <main class="r1-main">
            {loading && <div class="r1-loading">Loading…</div>}
            <div class="r1-doc">
              {page?.notesFor ? (
                doc && <NotesPanel id={page.notesFor} schedule={doc.schedules?.[page.notesFor]} />
              ) : (
                <>
                  {page && doc && <FilledPanel page={page} doc={doc} width={pageWidth} />}
                  {page && renderFacsimile && (
                    <FormFacsimile
                      page={page}
                      schedule={pageSchedule}
                      scheduleId={primaryScheduleId}
                      envelope={doc?.envelope}
                      findingsByLine={anchored.byLine}
                    />
                  )}
                  {page && doc && <FiledDetails page={page} pages={navPages} doc={doc} />}
                </>
              )}
            </div>
            <DqSidePanel
              findings={pageFindings}
              scheduleId={page?.schedule}
              doc={doc}
              lineage={lineage}
              lineageScheduleId={primaryScheduleId}
              ocrBase={config.ocrBase}
            />
          </main>
        </div>
      )}
    </div>
  )
}

const SEVERITY_ORDER = { FATAL: 0, WARNING: 1, INFO: 2 }

function flashRow(scheduleId, lineNo) {
  if (typeof document === 'undefined' || lineNo == null) return
  const el = document.getElementById(findingRowId(scheduleId, lineNo))
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('r1-fac-flash')
  setTimeout(() => el.classList.remove('r1-fac-flash'), 1600)
}

// Side panel of DQ findings for the active schedule. Findings that resolve to a
// printed line are clickable and scroll the facsimile to (and flash) that row, so
// the feedback tracks the part of the form that has the problem.
// Where the active schedule came from and how sure the pipeline is (TTF-6):
// source profile, sheet/page/member with an OCR page-text link for scans, the
// routing evidence, the per-schedule confidence and the source capture rate.
// The as-filed deviations come from the submission JSON itself (schema
// common__as_filed), so they render even without a lineage sidecar.
function AsFiledPanel({ schedule }) {
  const items = useMemo(() => asFiledDeviations(schedule), [schedule])
  if (!items.length) return null
  return (
    <details class="r1-prov r1-asfiled">
      <summary>As filed ({items.length})</summary>
      <p class="r1-prov-note">Where the JSON standardized a label, number or text, this is what the carrier printed.</p>
      <table class="r1-asfiled-table">
        <thead><tr><th>Where</th><th>Field</th><th>Printed</th><th>In JSON</th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr><td>{it.where}</td><td>{it.field}</td><td>{it.printed}</td><td>{it.canonical}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

function ProvenancePanel({ lineage, scheduleId, ocrBase }) {
  if (!lineage) return null
  const filing = describeFiling(lineage)
  const sched = scheduleId ? describeSchedule(lineage, scheduleId) : null
  const lowConfidence = sched?.confidence != null && sched.confidence < 0.8
  return (
    <details class="r1-prov" open>
      <summary>Provenance</summary>
      <dl class="r1-prov-list">
        {filing.map(([k, v]) => (
          <div class="r1-prov-row"><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {scheduleId && !sched && (
        <p class="r1-prov-note">Schedule {scheduleId}: not routed from the source
          ({lineage.schedule_states?.[scheduleId] || 'no lineage recorded'}).</p>
      )}
      {sched && (
        <div class="r1-prov-sched">
          <h4>Schedule {scheduleId}</h4>
          <dl class="r1-prov-list">
            <div class="r1-prov-row"><dt>Read from</dt><dd>
              {sched.sources.length ? sched.sources.map((src, i) => {
                const url = ocrPageUrl(ocrBase, lineage, src.page)
                return (
                  <span class="r1-prov-src">{i > 0 ? ', ' : ''}
                    {url ? <a href={url} target="_blank" rel="noopener" title="Open the OCR text of this page">{src.label}</a> : src.label}
                  </span>
                )
              }) : <em class="r1-muted">not recorded</em>}
            </dd></div>
            {sched.routing && <div class="r1-prov-row"><dt>Identified by</dt><dd>{sched.routing}</dd></div>}
            <div class="r1-prov-row"><dt>Confidence</dt>
              <dd class={lowConfidence ? 'r1-prov-low' : ''}>{sched.confidenceLabel ?? '—'}</dd></div>
            <div class="r1-prov-row"><dt>Source capture</dt>
              <dd class={sched.tierAMissed ? 'r1-prov-low' : ''}>
                {sched.captureLabel ?? '—'}
                {sched.tierAMissed ? ` (${sched.tierAMissed} value${sched.tierAMissed === 1 ? '' : 's'} not captured: ${sched.tierAValues.slice(0, 6).join(', ')}${sched.tierAValues.length > 6 ? ', …' : ''})` : ''}
              </dd></div>
            <div class="r1-prov-row"><dt>Rows extracted</dt><dd>{sched.extractedRows}</dd></div>
            {Object.keys(sched.transformations).length > 0 && (
              <div class="r1-prov-row"><dt>Transformations</dt><dd>
                {Object.entries(sched.transformations).map(([rule, n]) => `${rule} ×${n}`).join(', ')}
              </dd></div>
            )}
          </dl>
        </div>
      )}
    </details>
  )
}

function DqSidePanel({ findings, scheduleId, doc, lineage, lineageScheduleId, ocrBase }) {
  const items = useMemo(() => {
    return (findings || [])
      .map((f) => ({ finding: f, lineNo: findingLineNo(f, doc) }))
      .sort((a, b) => {
        const s = (SEVERITY_ORDER[a.finding.severity] ?? 3) - (SEVERITY_ORDER[b.finding.severity] ?? 3)
        if (s) return s
        return (a.lineNo ?? 1e9) - (b.lineNo ?? 1e9)
      })
  }, [findings, doc])

  const counts = items.reduce((acc, { finding }) => {
    const k = (finding.severity || 'INFO').toLowerCase()
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  return (
    <aside class="r1-dq" aria-label="Data-quality findings for this schedule">
      <ProvenancePanel lineage={lineage} scheduleId={lineageScheduleId} ocrBase={ocrBase} />
      <AsFiledPanel schedule={lineageScheduleId ? doc?.schedules?.[lineageScheduleId] : null} />
      <div class="r1-dq-head">
        <h3>Data quality</h3>
        {items.length ? (
          <div class="r1-dq-counts">
            {counts.fatal ? <span class="r1-dq-pill is-fatal">{counts.fatal} fatal</span> : null}
            {counts.warning ? <span class="r1-dq-pill is-warning">{counts.warning} warning</span> : null}
            {counts.info ? <span class="r1-dq-pill is-info">{counts.info} info</span> : null}
          </div>
        ) : null}
      </div>
      {!items.length ? (
        <p class="r1-dq-empty">No findings on this schedule.</p>
      ) : (
        <ol class="r1-dq-list">
          {items.map(({ finding, lineNo }) => {
            const sev = (finding.severity || 'INFO').toLowerCase()
            const clickable = lineNo != null
            return (
              <li
                class={`r1-dq-item is-${sev}` + (clickable ? ' is-clickable' : '')}
                onClick={clickable ? () => flashRow(scheduleId, lineNo) : undefined}
                title={clickable ? `Go to line ${lineNo}` : undefined}
              >
                <div class="r1-dq-item-head">
                  <span class={`r1-dq-sev is-${sev}`}>{finding.severity}</span>
                  <strong>{finding.rule_id}</strong>
                  {lineNo != null && <span class="r1-dq-line">line {lineNo}</span>}
                  {finding.is_new && <span class="r1-dq-new">new</span>}
                </div>
                <p class="r1-dq-msg">{finding.message || 'No finding message provided.'}</p>
                {finding.actual_value != null && finding.actual_value !== '' && (
                  <p class="r1-dq-meta"><b>Actual:</b> {String(finding.actual_value)}</p>
                )}
                {finding.expected_value != null && finding.expected_value !== '' && (
                  <p class="r1-dq-meta"><b>Expected:</b> {String(finding.expected_value)}</p>
                )}
                {finding.expected_for_profile && (
                  <p class="r1-dq-meta r1-dq-expected" title="A documented steady-state warning for this filing's source profile">Expected for this source profile</p>
                )}
                {finding.suggested_action && (
                  <p class="r1-dq-meta"><b>Fix:</b> {finding.suggested_action}</p>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </aside>
  )
}

function Picker({ carriers, years, versions, sel, pickSub, lineage }) {
  if (!sel) return <div class="r1-picker r1-picker-empty">No submissions found.</div>
  return (
    <div class="r1-picker">
      <label>
        Carrier
        <select value={sel.carrier} onChange={(e) => pickSub(e.currentTarget.value, sel.year, null)}>
          {carriers.map((c) => <option value={c}>{c}</option>)}
        </select>
      </label>
      <label>
        Year
        <select value={sel.year} onChange={(e) => pickSub(sel.carrier, Number(e.currentTarget.value), null)}>
          {years.map((y) => <option value={y}>{y}</option>)}
        </select>
      </label>
      <label>
        Version
        <select value={sel.version} onChange={(e) => pickSub(sel.carrier, sel.year, Number(e.currentTarget.value))}>
          {versions.map((v) => <option value={v}>v{v}</option>)}
        </select>
      </label>
      {lineage?.source_profile && (
        <span class="r1-profile-badge" title={profileLabel(lineage.source_profile)}>
          {lineage.source_profile}
        </span>
      )}
    </div>
  )
}
