import { scheduleIdsForPage } from './pageSchedules.js'

export async function submissionSnapshot(response) {
  const bytes = await response.arrayBuffer()
  const digest = globalThis.crypto?.subtle ? await crypto.subtle.digest('SHA-256', bytes) : null
  return { data: JSON.parse(new TextDecoder().decode(bytes)),
    sha256: digest ? Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('') : null }
}

export function captureIssueContext(sel, sha256, page, formVersion, comparison = null) {
  return {
    filing: { carrier: sel.carrier, year: sel.year, version: sel.version, file: sel.file, output_sha256: sha256 },
    location: {
      view: comparison ? 'comparison' : 'form',
      source_page: comparison?.page ?? null,
      source_binding: comparison?.binding ?? null,
      source_image_loaded: comparison?.imageReady ?? false,
      page_together: comparison?.pageTogether ?? false,
      extracted_page: page ? {
        sheet: page.sheet,
        label: page.notesFor ? `${page.notesFor} · Explanatory notes` : page.comparisonLabel || page.sheet,
        schedules: [...scheduleIdsForPage(page)],
        panel: Number.isInteger(page.comparisonPanel) ? page.comparisonPanel + 1 : null,
        form_version: formVersion || '',
      } : null,
    },
  }
}

export async function saveIssue(base, request) {
  const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request), cache: 'no-store' })
  let result
  try { result = await response.json() } catch { throw new Error(`Issue not saved (HTTP ${response.status}). Your draft is still here.`) }
  if (!response.ok) throw new Error(result.message || `Issue not saved (HTTP ${response.status}).`)
  return result
}
