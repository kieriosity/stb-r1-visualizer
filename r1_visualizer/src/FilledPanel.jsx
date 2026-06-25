import { formatValue } from './util.js'
import { addressLines, buildFrontMatter, isReal, phoneText } from './frontMatter.js'
import { SHEET_SCHEDULES } from './pageSchedules.js'
import { columnSpec } from './formLayout.js'
import { matchAnswers } from './narrativeAnswers.js'

// Renders the EXTRACTED data for form pages that the facsimile grid cannot fill
// from line/account-keyed values: the cover/title/verification envelope pages and
// the narrative schedules (B, C as answers; Memoranda, PTC_Grants as content; A as
// an entity list). The facsimile (blank template) still renders beneath this panel
// for visual context; this surfaces the values the submission actually carries.

// Which template sheets are envelope (cover-block) pages.
const ENVELOPE_SHEETS = new Set(['Title', 'Cover', 'Verification'])

const SCHEDULE_DISPLAY = { PTC_Grants: 'PTC Grants' }

function Field({ label, value }) {
  const real = isReal(value)
  return (
    <div class="r1-filled-row">
      <dt class="r1-filled-label">{label}</dt>
      <dd class="r1-filled-value">{real ? value : <em class="r1-muted">not reported</em>}</dd>
    </div>
  )
}

function FrontValue({ value }) {
  return isReal(value) ? value : <em class="r1-muted">not reported</em>
}

function AddressBlock({ lines }) {
  return lines?.length
    ? lines.map((line, i) => <>{i > 0 && <br />}{line}</>)
    : <em class="r1-muted">not reported</em>
}

function TitlePageFiled({ view }) {
  const fullAddressLines = [view.respondentName, ...view.mailingAddressLines].filter(isReal)
  return (
    <section class="r1-front-page r1-front-title-page" aria-label="Title page filed">
      <div class="r1-title-meta">
        <div>OEEAA - R1</div>
        <div>OMB Clearance No. <FrontValue value={view.ombControlNumber} /></div>
        <strong>Expiration Date <FrontValue value={view.expirationDate} /></strong>
      </div>

      <div class="r1-title-main">
        <h3>Class I Railroad</h3>
        <div>Annual Report</div>
      </div>

      <div class="r1-title-boxes">
        <div class="r1-title-box">
          <div>Correct name and address if different than shown</div>
          <div class="r1-title-box-fill">
            {view.correctNameAddressLines.length ? <AddressBlock lines={view.correctNameAddressLines} /> : ' '}
          </div>
        </div>
        <div class="r1-title-box r1-title-box-carrier">
          <div>
            Full name and address of reporting carrier<br />
            (Use mailing label on original, copy in full on duplicate)
          </div>
          <div class="r1-title-box-fill">
            <AddressBlock lines={fullAddressLines} />
          </div>
        </div>
      </div>

      <div class="r1-title-to">
        <div>To The</div>
        <div>Surface Transportation Board</div>
        <div><FrontValue value={view.titleYearEndingLine} /></div>
      </div>
    </section>
  )
}

function Underline({ label, children, wide = false }) {
  return (
    <div class={wide ? 'r1-front-line r1-front-line-wide' : 'r1-front-line'}>
      <span class="r1-front-line-label">{label}</span>
      <span class="r1-front-line-fill">{children}</span>
    </div>
  )
}

function CoverPageFiled({ view }) {
  const respondentLines = [view.respondentName, ...view.mailingAddressLines].filter(isReal)
  return (
    <section class="r1-front-page r1-front-cover-page" aria-label="Cover page filed">
      <div class="r1-cover-initials"><FrontValue value={view.roadInitialsLine} /></div>

      <div class="r1-cover-center">
        <div>ANNUAL REPORT</div>
        <div>OF</div>
        <div class="r1-cover-respondent"><AddressBlock lines={respondentLines} /></div>
        <div>TO THE</div>
        <div>SURFACE TRANSPORTATION BOARD</div>
        <div>FOR THE</div>
        <div><FrontValue value={view.coverYearEndedLine} /></div>
      </div>

      <div class="r1-cover-correspondence">
        <p>
          Name, official title, telephone number, and office address of officer in charge of correspondence with<br />
          the Board regarding this report.
        </p>
        <div class="r1-cover-name-title">
          <Underline label="(Name)"><FrontValue value={view.officer.name} /></Underline>
          <Underline label="(Title)"><FrontValue value={view.officer.title} /></Underline>
        </div>
        <Underline label="(Telephone number)" wide>
          <FrontValue value={view.officer.telephone} />
        </Underline>
        <div class="r1-cover-caption">(Area code) (Telephone number)</div>
        <Underline label="(Office address)" wide>
          <AddressBlock lines={view.officer.officeAddressLines} />
        </Underline>
        <div class="r1-cover-caption">(Street and number, city, state, and ZIP code)</div>
      </div>
    </section>
  )
}

function CoverTitlePanel({ sheet, envelope }) {
  const view = buildFrontMatter(sheet, envelope)
  return sheet === 'Cover'
    ? <CoverPageFiled view={view} />
    : <TitlePageFiled view={view} />
}

function AddressField({ label, address }) {
  const lines = addressLines(address)
  return (
    <div class="r1-filled-row">
      <dt class="r1-filled-label">{label}</dt>
      <dd class="r1-filled-value">
        {lines.length
          ? lines.map((line, i) => <>{i > 0 && <br />}{line}</>)
          : <em class="r1-muted">not reported</em>}
      </dd>
    </div>
  )
}

function EnvelopePanel({ sheet, envelope }) {
  const resp = envelope?.respondent || {}
  const officer = envelope?.officer_in_charge || {}
  const ver = envelope?.verification || {}
  const meta = envelope?.form_metadata || {}

  if (sheet === 'Verification') {
    return (
      <section class="r1-filled">
        <h3 class="r1-filled-head">Verification — filed</h3>
        <dl class="r1-filled-grid">
          <Field label="Affiant" value={ver.affiant_name} />
          <Field label="Title" value={ver.affiant_title} />
          <Field label="Execution date" value={ver.execution_date} />
        </dl>
      </section>
    )
  }
  if (sheet === 'Title' || sheet === 'Cover') {
    return <CoverTitlePanel sheet={sheet} envelope={envelope} />
  }
  return (
    <section class="r1-filled">
      <h3 class="r1-filled-head">{sheet === 'Cover' ? 'Cover' : 'Title'} page — filed</h3>
      <dl class="r1-filled-grid">
        <Field label="Reporting carrier" value={resp.legal_name} />
        <Field label="Reporting mark" value={resp.reporting_mark} />
        <AddressField label="Mailing address" address={resp.mailing_address} />
        <Field label="Report year" value={meta.report_year} />
      </dl>
      {sheet === 'Cover' && (
        <>
          <p class="r1-filled-sub">Officer in charge of correspondence</p>
          <dl class="r1-filled-grid">
            <Field label="Name" value={officer.name} />
            <Field label="Title" value={officer.title} />
            <Field label="Telephone" value={phoneText(officer.telephone)} />
            <AddressField label="Office address" address={officer.office_address} />
          </dl>
        </>
      )}
    </section>
  )
}

// "Q1" -> "1.", "Q5a" -> "5a." to match the form's inquiry numbering.
function questionLabel(key) {
  const bare = String(key).replace(/^Q/i, '')
  return /^\d/.test(bare) ? `${bare}.` : key
}

function renderAnswer(a) {
  if (!a || typeof a !== 'object') return <span>{formatValue(a)}</span>
  switch (a.answer_type) {
    case 'text': return <span>{a.text}</span>
    case 'date': return <span>{a.date}</span>
    case 'choice': return <span>{a.choice}</span>
    case 'not_applicable': return <em class="r1-na">Not applicable</em>
    case 'text_list':
      return <ul class="r1-answer-list">{(a.text_list || []).map((t) => <li>{t}</li>)}</ul>
    default: return <span>{formatValue(a.text ?? a.value ?? a)}</span>
  }
}

function AnswersPanel({ id, schedule, hideKeys }) {
  const answers = schedule?.answers || {}
  const keys = Object.keys(answers)
    .filter((k) => !hideKeys || !hideKeys.has(k))
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ''), 10)
      const nb = parseInt(b.replace(/\D/g, ''), 10)
      return (na || 0) - (nb || 0) || a.localeCompare(b)
    })
  if (!keys.length) return null
  return (
    <section class="r1-filled">
      <h3 class="r1-filled-head">Schedule {id} — filed answers</h3>
      <dl class="r1-answers">
        {keys.map((k) => (
          <div class="r1-answer-row">
            <dt class="r1-answer-q">{questionLabel(k)}</dt>
            <dd class="r1-answer-a">{renderAnswer(answers[k])}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ContentPanel({ id, schedule }) {
  const blocks = (schedule?.content || []).filter((b) => isReal(b?.text))
  if (!blocks.length) return null
  return (
    <section class="r1-filled">
      <h3 class="r1-filled-head">{SCHEDULE_DISPLAY[id] || id} — filed content</h3>
      <div class="r1-content">
        {blocks.map((b) => <p class="r1-content-block">{b.text}</p>)}
      </div>
    </section>
  )
}

function humanizeKey(key) {
  return String(key).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Row data as a printed-style table (Line + one column per field), used only for
// item schedules the facsimile has no column mapping for. Mirrors the form's
// look: tabular numbers right-aligned, TOTAL rows bold, accounting zeros as "-".
function ItemsTable({ items }) {
  const cols = []
  const seen = new Set()
  for (const it of items) {
    for (const key of Object.keys(it?.fields || {})) {
      if (!seen.has(key)) { seen.add(key); cols.push(key) }
    }
  }
  const hasLine = items.some((it) => it?.line_no != null)
  return (
    <div class="r1-table-wrap">
      <table class="r1-table">
        <thead>
          <tr>
            {hasLine && <th class="r1-th-line">Line</th>}
            {cols.map((c) => <th>{humanizeKey(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const label = String(it?.fields?.issuer_name_and_lien_reference
              || it?.fields?.title || it?.fields?.name || '')
            const total = /^total\b/i.test(label.trim())
            return (
              <tr class={total ? 'r1-row-total' : undefined}>
                {hasLine && <td class="r1-td-line">{it?.line_no ?? ''}</td>}
                {cols.map((c) => {
                  const v = it?.fields?.[c]
                  return (
                    <td class={typeof v === 'number' ? 'r1-td-num' : 'r1-td-text'}>
                      {v == null || v === '' ? '' : formatValue(v)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ItemsPanel({ id, schedule }) {
  const items = schedule?.items || []
  if (!items.length) return null
  const tabular = items.every((it) => it && typeof it.fields === 'object' && it.fields)
  return (
    <section class="r1-filled">
      <h3 class="r1-filled-head">Schedule {id} — filed items</h3>
      {tabular
        ? <ItemsTable items={items} />
        : (
          <ul class="r1-answer-list">
            {items.map((it) => <li>{formatValue(it.title || it.name || it.text || '')}</li>)}
          </ul>
        )}
    </section>
  )
}

export function NotesPanel({ id, schedule }) {
  const notes = schedule?.explanatory_notes || []
  if (!notes.length) return null
  return (
    <section class="r1-filled">
      <h3 class="r1-filled-head">Schedule {id} — explanatory notes filed</h3>
      <ol class="r1-note-list">
        {notes.map((note) => (
          <li class="r1-note">
            <span class="r1-note-id">Note {note.note_id}</span>
            <p>{note.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

function SchedulePanel({ id, schedule, page }) {
  if (!schedule) return null
  // narrative_qa answers are now placed onto the form's inquiry lines by the
  // facsimile; only list the answers it could NOT pin to a line (over-extracted
  // keys) so nothing is lost, instead of repeating them all above the form.
  if (schedule.answers) {
    return <AnswersPanel id={id} schedule={schedule} hideKeys={matchAnswers(page, schedule).matchedKeys} />
  }
  if (schedule.content) return <ContentPanel id={id} schedule={schedule} />
  // Row data the facsimile already draws to scale (it has a column spec, e.g.
  // 310/310A/352A/510/512) is NOT re-listed here - the printed form grid is the
  // closest match. Only item schedules with no facsimile mapping (e.g. PTC_501)
  // fall back to a printed-style table so their values stay visible.
  if (schedule.items && !columnSpec[id]) return <ItemsPanel id={id} schedule={schedule} />
  // explanatory_notes are surfaced on their own side-nav tab/page (see App.jsx),
  // not inline beneath the schedule's facsimile.
  return null
}

// Returns the filled-data panel for a template page, or null when the page is an
// ordinary tabular schedule (handled by the facsimile) or carries no extra data.
// `width` (px) is the printed form's width, so the panel lines up with the
// facsimile rendered beneath it instead of spanning the full viewport.
export function FilledPanel({ page, doc, width }) {
  const sheet = page?.sheet
  if (!sheet || !doc) return null

  let content = null
  if (ENVELOPE_SHEETS.has(sheet)) {
    content = <EnvelopePanel sheet={sheet} envelope={doc.envelope} />
  } else if (page.schedule) {
    content = <SchedulePanel id={page.schedule} schedule={doc.schedules?.[page.schedule]} page={page} />
  } else {
    const ids = SHEET_SCHEDULES[sheet]
    if (ids) {
      const panels = ids
        .map((id) => <SchedulePanel id={id} schedule={doc.schedules?.[id]} page={page} />)
        .filter(Boolean)
      content = panels.length ? <>{panels}</> : null
    }
  }
  if (!content) return null
  return width
    ? <div class="r1-filled-wrap" style={{ width: `${width}px`, maxWidth: '100%' }}>{content}</div>
    : content
}
