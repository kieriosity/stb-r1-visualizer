import { useEffect, useMemo, useState } from 'preact/hooks'
import { createStaticSource } from './dataSource.js'
import { resolveConfig } from './config.js'
import { FormFacsimile } from './FormFacsimile.jsx'
import formTemplate from './formTemplate.json'

export function App({ options = {} }) {
  const config = useMemo(() => resolveConfig(options), [options])
  const source = useMemo(() => createStaticSource(config.dataBase), [config.dataBase])

  const [template] = useState(formTemplate)
  const [subs, setSubs] = useState([])
  const [sel, setSel] = useState(null) // { carrier, year, version, file }
  const [doc, setDoc] = useState(null)
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
            (!options.year || s.year === Number(options.year)))
          const pick = (want.length ? want : list)[want.length ? want.length - 1 : list.length - 1]
          setSel(pick)
        }
      })
      .catch((e) => setError(`Could not load manifest: ${e.message}`))
  }, [source])

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

  const pages = template?.pages || []
  const dataSchedules = useMemo(
    () => new Set(Object.keys(doc?.schedules || {})), [doc])

  // Default page: a ?sched=<id> / #<id> deep link if present, else the first
  // page the submission has data for, else page 0.
  useEffect(() => {
    if (!pages.length || !doc) return
    let want = null
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('sched')
      want = q || decodeURIComponent((window.location.hash || '').replace(/^#/, '')) || null
    }
    let idx = want ? pages.findIndex((p) => p.schedule === want || p.sheet === want) : -1
    if (idx < 0) idx = pages.findIndex((p) => p.schedule && dataSchedules.has(p.schedule))
    setActivePage(idx >= 0 ? idx : 0)
  }, [template, doc])

  const page = pages[activePage]
  const pageSchedule = page?.schedule ? doc?.schedules?.[page.schedule] : null

  return (
    <div class="r1-app">
      <Picker {...{ carriers, years, versions, sel, pickSub }} />
      {error && <div class="r1-error">{error}</div>}
      {!template && !error && <div class="r1-loading">Loading form…</div>}
      {template && (
        <div class="r1-body">
          <nav class="r1-nav">
            <ul>
              {pages.map((p, i) => {
                const hasData = p.schedule && dataSchedules.has(p.schedule)
                return (
                  <li>
                    <button
                      class={'r1-nav-item' + (i === activePage ? ' is-active' : '') + (hasData ? ' has-data' : '')}
                      onClick={() => setActivePage(i)}
                      title={p.sheet}
                    >
                      <span class="r1-nav-id">{p.schedule || '—'}</span>
                      <span class="r1-nav-name">{p.sheet}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
          <main class="r1-main">
            {loading && <div class="r1-loading">Loading…</div>}
            {page && (
              <FormFacsimile
                page={page}
                schedule={pageSchedule}
                scheduleId={page.schedule}
                envelope={doc?.envelope}
              />
            )}
          </main>
        </div>
      )}
    </div>
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
