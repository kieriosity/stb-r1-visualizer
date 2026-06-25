import { useEffect, useMemo, useState } from 'preact/hooks'
import { createStaticSource } from './dataSource.js'
import { resolveConfig } from './config.js'
import { FormFacsimile, findingRowId } from './FormFacsimile.jsx'
import { FilledPanel, NotesPanel } from './FilledPanel.jsx'
import { pageWidthPx } from './formGrid.js'
import { anchorFindings, findingLineNo } from './findingLocation.js'
import { shouldRenderFacsimile } from './pageRender.js'
import { navScheduleLabel, pageHasData, pageMatchesSchedule, primaryScheduleIdForPage, splitCombinedPages } from './pageSchedules.js'
import { findingCountsByPage, findingsForPage, normalizeReviewFindings } from './reviewFindings.js'
import { pagesForVersion, resolveFormVersion } from './formVersion.js'
import formTemplate from './formTemplate.json'

export function App({ options = {} }) {
  const config = useMemo(() => resolveConfig(options), [options])
  const source = useMemo(
    () => createStaticSource(config.dataBase, config.reviewFindingsBase),
    [config.dataBase, config.reviewFindingsBase])

  const [template] = useState(formTemplate)
  const [subs, setSubs] = useState([])
  const [sel, setSel] = useState(null) // { carrier, year, version, file }
  const [doc, setDoc] = useState(null)
  const [reviewFindings, setReviewFindings] = useState([])
  const [activePage, setActivePage] = useState(0)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

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
    setLoading(true)
    setError(null)
    source.loadSubmission(sel.file)
      .then((d) => setDoc(d))
      .catch((e) => setError(`Could not load ${sel.file}: ${e.message}`))
      .finally(() => setLoading(false))
  }, [sel, source])

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
    () => splitCombinedPages(pagesForVersion(template, formVersion)), [template, formVersion])
  const dataSchedules = useMemo(
    () => new Set(Object.keys(doc?.schedules || {})), [doc])

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

  return (
    <div class="r1-app">
      <Picker {...{ carriers, years, versions, sel, pickSub }} />
      {error && <div class="r1-error">{error}</div>}
      {!template && !error && <div class="r1-loading">Loading form…</div>}
      {template && (
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
                </>
              )}
            </div>
            <DqSidePanel
              findings={pageFindings}
              scheduleId={page?.schedule}
              doc={doc}
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
function DqSidePanel({ findings, scheduleId, doc }) {
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

function Picker({ carriers, years, versions, sel, pickSub }) {
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
    </div>
  )
}
