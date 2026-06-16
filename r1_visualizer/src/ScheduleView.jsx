import { detectShape, scheduleName } from './formLayout.js'
import { SectionsTable } from './schedules/SectionsTable.jsx'
import { RowsTable, ItemsTable, CategoriesTable } from './schedules/RowsTable.jsx'
import { AnswersView, GenericView } from './schedules/AnswersView.jsx'

const RENDERERS = {
  sections: SectionsTable,
  rows: RowsTable,
  items: ItemsTable,
  categories: CategoriesTable,
  answers: AnswersView,
}

// Schedules whose printed form pages do not carry the dollars note.
const NON_DOLLAR = new Set(['A', 'B', 'C', 'Memoranda'])

// Renders one schedule as a printed R-1 form page: bordered frame, the
// "Road Initials / Year" strip, centered uppercase title with the dollars
// note, and the "Railroad Annual Report R-1" footer rule.
export function ScheduleView({ id, schedule, envelope }) {
  if (!schedule) return null
  const shape = detectShape(schedule)
  const Renderer = RENDERERS[shape] || GenericView
  const rev = schedule.revision || {}
  const meta = envelope?.form_metadata || {}
  const resp = envelope?.respondent || {}
  const name = scheduleName(id)
  const showUnits = meta.monetary_units === 'thousands' && !NON_DOLLAR.has(id) && shape !== 'content'
  return (
    <article class="r1-page">
      <header class="r1-page-head">
        <span>Road Initials: <b>{resp.reporting_mark || ''}</b></span>
        <span>Year: <b>{meta.report_year || ''}</b></span>
      </header>
      <div class="r1-page-title">
        <h2>{id === name ? name : `${id.replace(/_/g, ' ')}. ${name}`}</h2>
        {showUnits && <p class="r1-page-units">(Dollars in Thousands)</p>}
      </div>
      <div class="r1-page-body">
        <Renderer schedule={schedule} />
        {rev.change_note && <p class="r1-rev-note">{rev.change_note}</p>}
      </div>
      <footer class="r1-page-foot">Railroad Annual Report R-1</footer>
    </article>
  )
}
