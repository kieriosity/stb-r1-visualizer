// Per-submission lineage (TTF-6): what the steward needs to answer "where did
// this schedule come from and how sure is the pipeline?" The host serves it from
// the transform log at <lineageBase>/<carrier>/<year>/<version>.json; the shape is
// tools/r1_visualizer.py build_lineage(). Pure helpers here so they are testable
// without the DOM.

export const PROFILE_LABELS = {
  selected_data_xls: 'STB Selected Data extract (.xls, 1996-2004)',
  scanned_pdf_ocr: 'Scanned PDF read by OCR (2005-2012)',
  per_schedule_zip: 'ZIP of per-schedule workbooks',
  legacy_form_xlsx: 'Native workbook, 2015-08-31 form (2013-2015)',
  modern_form_xlsx: 'Native workbook, 2026-07-31 form (2016+)',
}

export function profileLabel(profile) {
  return PROFILE_LABELS[profile] || (profile ? String(profile) : 'not recorded')
}

export function lineageUrl(base, sel) {
  if (!base || !sel) return null
  const b = String(base).replace(/\/$/, '')
  return `${b}/${String(sel.carrier).toLowerCase()}/${sel.year}/${sel.version}.json`
}

// The OCR page-text endpoint for one printed page of a scanned filing.
export function ocrPageUrl(base, lineage, page) {
  const key = lineage?.ocr?.cache_key
  if (!base || !key || page == null) return null
  return `${String(base).replace(/\/$/, '')}?key=${encodeURIComponent(key)}&page=${encodeURIComponent(page)}`
}

function pct(v) {
  return v == null || Number.isNaN(Number(v)) ? null : `${Math.round(Number(v) * 100)}%`
}

// One schedule's lineage, flattened for display. Returns null when the lineage
// has no entry for the schedule (not routed, or an older log).
export function describeSchedule(lineage, scheduleId) {
  const entry = lineage?.schedule_provenance?.[scheduleId]
  if (!entry) return null
  const fid = entry.fidelity || {}
  const sources = (entry.sources || []).map((src) => {
    const range = src.row_range ? ` rows ${src.row_range[0]}-${src.row_range[1]}` : ''
    if (src.member) return { label: `member ${src.member}${range}`, page: null }
    const label = src.page != null ? `page ${src.page}` : `sheet ${src.sheet}`
    return { label: label + range, page: src.page ?? null }
  })
  return {
    scheduleId,
    state: lineage.schedule_states?.[scheduleId] || 'present',
    sources,
    routing: entry.routing_method
      ? `${entry.routing_method}${entry.routing_score != null ? ` (${Number(entry.routing_score).toFixed(2)})` : ''}`
      : null,
    confidence: entry.confidence == null ? null : Number(entry.confidence),
    confidenceLabel: entry.confidence == null ? null : Number(entry.confidence).toFixed(2),
    captureRate: fid.capture_rate == null ? null : Number(fid.capture_rate),
    captureLabel: pct(fid.capture_rate),
    tierAMissed: Number(fid.tier_a_missed || 0),
    tierAValues: Array.isArray(fid.tier_a_values) ? fid.tier_a_values : [],
    extractedRows: Number(entry.extracted_rows || 0),
    transformations: lineage.transformations?.[scheduleId] || {},
  }
}

// Filing-level summary line items.
export function describeFiling(lineage) {
  if (!lineage) return []
  const items = [
    ['Source profile', profileLabel(lineage.source_profile)],
    ['Source file', lineage.input_file || null],
    ['Source sha256', lineage.input_sha256 ? String(lineage.input_sha256).slice(0, 12) + '…' : null],
    ['Confidence', lineage.mapping_confidence_overall == null ? null : Number(lineage.mapping_confidence_overall).toFixed(2)],
    ['Schedule coverage', pct(lineage.schedule_coverage)],
    ['Pipeline', lineage.pipeline_version
      ? `${lineage.pipeline_version}${lineage.pipeline_git_sha ? ' @' + String(lineage.pipeline_git_sha).slice(0, 8) : ''}`
      : null],
    ['Processed', lineage.processed_at || null],
  ]
  if (lineage.ocr) {
    items.push(['OCR', `${lineage.ocr.model || 'unknown model'}, ${lineage.ocr.page_count ?? '?'} pages` +
      (lineage.ocr.cache_hit ? ' (cached)' : '')])
  }
  return items.filter(([, v]) => v != null && v !== '')
}
