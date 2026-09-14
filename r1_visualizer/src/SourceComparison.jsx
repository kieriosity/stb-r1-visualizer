import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { pageWidthPx } from './formGrid.js'
import { extractedPagesForSource, initialSourcePage, linkedExtractedPage, selectedExtractedPage, sourceReviewUrl } from './sourceReview.js'

function Zoom({ label, value, onChange }) {
  return <label>{label}<select value={value} onChange={(e) => onChange(Number(e.currentTarget.value))}>
    {[0.75, 1, 1.25, 1.5, 2, 3].map((n) => <option value={n}>{n === 1 ? 'Fit' : `${n * 100}%`}</option>)}
  </select></label>
}

export function SourceComparison({ base, sel, navPages, scheduleId, renderPage, renderFindings, close }) {
  const [manifest, setManifest] = useState(null)
  const [error, setError] = useState(null)
  const [selection, setSelection] = useState({ page: 1, index: null })
  const [pageTogether, setPageTogether] = useState(true)
  const pageNo = selection.page
  const [sourceZoom, setSourceZoom] = useState(1)
  const [extractZoom, setExtractZoom] = useState(1)
  const [failedImage, setFailedImage] = useState(null)
  const [loadedImage, setLoadedImage] = useState(null)
  const [width, setWidth] = useState(600)
  const viewport = useRef(null)
  const sourceViewport = useRef(null)
  const url = sourceReviewUrl(base, sel)

  useEffect(() => {
    const controller = new AbortController()
    setManifest(null)
    setError(null)
    fetch(`${url}/manifest.json`, { signal: controller.signal, cache: 'no-store' })
      .then(async (res) => {
        const value = await res.json()
        if (!res.ok || !value.available) throw new Error(value.message || 'Source preview unavailable.')
        return value
      })
      .then((value) => {
        if (controller.signal.aborted) return
        setManifest(value)
        const requested = new URLSearchParams(window.location.search).get('sourcePage')
        setSelection({ page: initialSourcePage(value, scheduleId, requested), index: null })
      })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [url])

  const sourcePage = manifest?.pages.find((p) => p.page === pageNo)
  const choices = useMemo(() => extractedPagesForSource(navPages, sourcePage), [navPages, sourcePage])
  const chosen = choices.find((p) => p.index === selection.index)
    || (pageTogether ? linkedExtractedPage(choices, manifest, sourcePage) : selectedExtractedPage(choices, null))
  function navigateTo(nextPage) {
    const nextSource = manifest.pages.find((p) => p.page === nextPage)
    const nextChoices = extractedPagesForSource(navPages, nextSource)
    const next = pageTogether
      ? linkedExtractedPage(nextChoices, manifest, nextSource, { sourcePage, chosen })
      : selectedExtractedPage(nextChoices, chosen?.index)
    setSelection({ page: nextPage, index: next?.index ?? null })
  }
  const imageUrl = manifest ? `${url}/${pageNo}.png?binding=${encodeURIComponent(manifest.binding)}` : null
  const imageReady = imageUrl !== null && loadedImage === imageUrl
  const imageFailed = imageUrl !== null && failedImage === imageUrl
  useEffect(() => {
    sourceViewport.current?.scrollTo(0, 0)
  }, [imageUrl])
  useEffect(() => { viewport.current?.scrollTo(0, 0) }, [pageNo, chosen?.index])
  useEffect(() => {
    if (!viewport.current) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [manifest])
  const paperWidth = chosen?.page.notesFor ? 800 : chosen ? pageWidthPx(chosen.page) || 800 : 800
  const fit = Math.min(1, Math.max(0.1, (width - 24) / paperWidth))

  return <section class="r1-compare" aria-label="Source and extraction comparison">
    <div class="r1-compare-toolbar">
      <button type="button" onClick={close}>← Form view</button>
      <strong>Source comparison</strong>
      {manifest && <>
        <button type="button" disabled={pageNo <= 1} onClick={() => navigateTo(pageNo - 1)}>Previous page</button>
        <label>Source page<select value={pageNo} onChange={(e) => navigateTo(Number(e.currentTarget.value))}>
          {manifest.pages.map((p) => <option value={p.page}>Page {p.page}{p.schedules.length ? ` · ${p.schedules.join(', ')}` : ' · no link'}</option>)}
        </select></label>
        <span>of {manifest.page_count}</span>
        <button type="button" disabled={pageNo >= manifest.page_count} onClick={() => navigateTo(pageNo + 1)}>Next page</button>
        <label><input type="checkbox" checked={pageTogether}
          onChange={(e) => setPageTogether(e.currentTarget.checked)} /> Page together</label>
      </>}
    </div>
    {error && <div class="r1-compare-empty" role="alert">{error}</div>}
    {!manifest && !error && <div class="r1-loading" role="status">Loading source information…</div>}
    {manifest && <>
      <div class="r1-compare-context">
        <span title={`SHA-256: ${manifest.input_sha256}`}>{manifest.input_file.split('/').pop()} · original PDF</span>
        <span>{pageTogether
          ? 'Pages advance together within each linked schedule. Pairing follows page order; adjust the extracted page if needed.'
          : 'Schedule-level association; select the extracted page manually.'}</span>
        {manifest.is_amendment && <span>Amendment: links describe this run’s source. Retained content may come from an earlier version.</span>}
      </div>
      <div class="r1-compare-panes">
        <section class="r1-compare-pane" aria-label="Original source">
          <div class="r1-compare-pane-head"><strong>Original · PDF page {pageNo}</strong>
            <Zoom label="Source zoom" value={sourceZoom} onChange={setSourceZoom} /></div>
          {manifest.correction_pages.includes(pageNo) && <div class="r1-compare-correction">OCR correction evidence was used for this page. The image below is the original.</div>}
          <div class="r1-source-viewport" ref={sourceViewport}>
            {!imageReady && !imageFailed && <p role="status">Loading source page…</p>}
            {imageFailed && <p role="alert">The verified source page could not be loaded. Reopen source comparison to retry.</p>}
            <img key={imageUrl} src={imageUrl} alt={`Original ${manifest.input_file.split('/').pop()}, PDF page ${pageNo}`}
              style={{ width: `${sourceZoom * 100}%`, visibility: imageReady ? 'visible' : 'hidden', display: imageFailed ? 'none' : 'block' }}
              onLoad={() => setLoadedImage(imageUrl)} onError={() => setFailedImage(imageUrl)} />
          </div>
        </section>
        <section class="r1-compare-pane" aria-label="Extracted content">
          <div class="r1-compare-pane-head"><strong>Extracted form</strong>
            <Zoom label="Extract zoom" value={extractZoom} onChange={setExtractZoom} /></div>
          {choices.length > 0 && <label class="r1-extract-picker">Associated extracted page
            <select value={chosen.index} onChange={(e) => setSelection({ page: pageNo, index: Number(e.currentTarget.value) })}>
              {choices.map(({ page, index }) => <option value={index}>{page.notesFor ? `${page.notesFor} · Explanatory notes` : page.comparisonLabel}</option>)}
            </select></label>}
          <div class="r1-extract-viewport" ref={viewport}>
            {chosen ? <><div class="r1-compare-paper" style={{ width: `${paperWidth}px`, zoom: fit * extractZoom }}>
              {renderPage(chosen.page)}
            </div><details class="r1-compare-findings"><summary>Findings and provenance</summary>{renderFindings(chosen.page)}</details></> :
              <div class="r1-compare-empty"><h3>No extracted page linked</h3>
                <p>{sourcePage?.schedules.length ? `This source page is associated with ${sourcePage.schedules.join(', ')}, which has no available form page.` : 'The transform log records no schedule association for this source page.'}</p>
                <p>The original remains available for review.</p></div>}
          </div>
        </section>
      </div>
    </>}
  </section>
}
