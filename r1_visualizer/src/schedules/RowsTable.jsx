import { DataTable } from './DataTable.jsx'
import { prettifyKey } from '../util.js'
import { getColumnOrder, hasCrossCheck } from '../formLayout.js'

// shape: rows[] -> { line_no, title, cells{} }
export function RowsTable({ schedule }) {
  return (
    <DataTable
      records={schedule.rows}
      valueKey="cells"
      order={getColumnOrder(schedule.schedule_id)}
      crossCheck={hasCrossCheck(schedule.schedule_id)}
      leading={[
        { header: 'Line No.', get: (r) => r.line_no, line: true },
        { header: 'Title', get: (r) => r.title },
      ]}
    />
  )
}

// shape: items[] -> { line_no, fields{} }  (no title; fields carry everything)
export function ItemsTable({ schedule }) {
  return (
    <DataTable
      records={schedule.items}
      valueKey="fields"
      order={getColumnOrder(schedule.schedule_id)}
      crossCheck={hasCrossCheck(schedule.schedule_id)}
      leading={[{ header: 'Line No.', get: (r) => r.line_no, line: true }]}
    />
  )
}

// shape: categories[] -> { category_id, line_no, title, measures{} }
export function CategoriesTable({ schedule }) {
  return (
    <DataTable
      records={schedule.categories}
      valueKey="measures"
      order={getColumnOrder(schedule.schedule_id)}
      crossCheck={hasCrossCheck(schedule.schedule_id)}
      leading={[
        { header: 'Line No.', get: (r) => r.line_no, line: true },
        { header: 'Category', get: (r) => r.title || prettifyKey(r.category_id) },
      ]}
    />
  )
}
