import { useEffect, useRef, useState } from 'preact/hooks'
import { saveIssue } from './issueReport.js'

export function IssueReport({ base, context, close }) {
  const dialog = useRef(null)
  const [issueId] = useState(() => crypto.randomUUID())
  const [fields, setFields] = useState({ category: 'unsure', summary: '', details: '', expected_behavior: '', field_or_line: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null)
  useEffect(() => { dialog.current.showModal() }, [])
  const update = (key) => (event) => {
    const value = event.currentTarget.value
    setFields((values) => ({ ...values, [key]: value }))
  }
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try { setSaved(await saveIssue(base, { issue_id: issueId, ...context, ...fields })) }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }
  const { filing, location } = context
  return <dialog ref={dialog} class="r1-issue-dialog" aria-labelledby="r1-issue-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) close() }}>
    <h2 id="r1-issue-title">{saved ? 'Issue saved' : 'Report a transformation or display issue'}</h2>
    <p class="r1-issue-context">{filing.carrier} · {filing.year} · version {filing.version}
      {location.source_page !== null && ` · PDF page ${location.source_page}`}
      {' · '}{location.extracted_page?.label || 'No extracted page linked'}</p>
    {saved ? <>
      <p>Your report is saved as a separate file:</p><p><code>{saved.file}</code></p>
      <p><a href={`${base}/${saved.issue_id}.json`} target="_blank" rel="noopener">Open report JSON</a>
        {' · '}<a href={`${base}/`} target="_blank" rel="noopener">View issue log</a></p>
      <button type="button" onClick={close}>Done</button>
    </> : <form onSubmit={submit}>
      <p>The filing and page context above will be saved with your report.</p>
      <label>Issue type<select value={fields.category} onChange={update('category')} disabled={busy}>
        <option value="unsure">Not sure</option><option value="transformation">Transformation / extracted data</option>
        <option value="display">Display / viewer layout</option>
      </select></label>
      <label>Summary<input autoFocus required maxLength={200} value={fields.summary} onInput={update('summary')} disabled={busy} /></label>
      <label>What is wrong?<textarea required rows={4} maxLength={8000} value={fields.details} onInput={update('details')} disabled={busy} /></label>
      <label>What should it show? (optional)<textarea rows={3} maxLength={4000} value={fields.expected_behavior} onInput={update('expected_behavior')} disabled={busy} /></label>
      <label>Field, row, or line number (optional)<input maxLength={240} value={fields.field_or_line} onInput={update('field_or_line')} disabled={busy} /></label>
      {error && <p class="r1-error" role="alert">{error}</p>}
      <div class="r1-issue-actions"><button type="button" onClick={close} disabled={busy}>Cancel</button>
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save issue'}</button></div>
    </form>}
  </dialog>
}
