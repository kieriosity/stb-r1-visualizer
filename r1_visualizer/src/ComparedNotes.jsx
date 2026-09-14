import { NotesPanel } from './FilledPanel.jsx'
import { notesForComparedPage } from './comparedNotes.js'

export function ComparedNotes({ page, schedule, id }) {
  const count = schedule?.explanatory_notes?.length || 0
  if (!count) return null
  const { isNotesPage, matching } = notesForComparedPage(page, schedule)
  const allNotes = <NotesPanel id={id} schedule={schedule} />
  return <section class="r1-compared-notes" aria-label={`Schedule ${id} filed explanatory notes`}>
    {isNotesPage && matching.length > 0 && <>
      <p>Filed notes matching this form page’s questions. Matched by question text;
        a note may continue onto another source page.</p>
      <NotesPanel id={id} schedule={schedule} indexes={matching} />
    </>}
    {isNotesPage && !matching.length ? <>
      <p>All filed notes for Schedule {id}. These notes are not linked to individual PDF pages.</p>
      {allNotes}
    </> : <details>
      <summary>All filed explanatory notes for Schedule {id} ({count})</summary>
      <p>This list covers the whole schedule, including notes not matched to this form page.</p>
      {allNotes}
    </details>}
  </section>
}
