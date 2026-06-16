// columnSpec.json is generated from the canonical r1_schema (see
// scripts note in README): authoritative schedule names + form-ordered columns.
import columnSpec from './columnSpec.json'

export { columnSpec }

// Authoritative form column order for a schedule's value object, or null.
export function getColumnOrder(scheduleId) {
  return columnSpec[scheduleId]?.columns || null
}

// Official STB Form R-1 schedule names, keyed by schedule_id. Falls back to
// this hand map only if a schedule is missing from the generated spec.

export const SCHEDULE_NAMES = {
  '200': 'Comparative Statement of Financial Position — Assets',
  '210': 'Comparative Statement of Financial Position — Liabilities & Shareholders’ Equity',
  '210A': 'Capital Stock & Other Capital',
  '220': 'Results of Operations',
  '240': 'Retained Earnings',
  '245': 'Statement of Cash Flows',
  '310': 'Investments & Advances — Affiliated Companies',
  '310A': 'Investments in Common Stocks of Affiliated Companies',
  '330': 'Road Property & Equipment Owned and Used',
  '332': 'Depreciation Base & Rates — Road & Equipment Owned and Used',
  '335': 'Accumulated Depreciation — Road & Equipment Owned and Used',
  '342': 'Depreciation Base & Rates — Improvements to Leased Property',
  '352A': 'Investment in Railroad Property Used in Transportation Service (by Company)',
  '352B': 'Investment in Railroad Property Used in Transportation Service (by Property Account)',
  '410': 'Railway Operating Revenues',
  '412': 'Way & Structures',
  '414': 'Rents for Interchanged Freight Train Cars & Other Freight-Carrying Equipment',
  '415': 'Supporting Schedule — Equipment',
  '417': 'Specialized Service Subschedule — Transportation',
  '450': 'Analysis of Taxes',
  '501': 'Guaranties & Suretyships',
  '502': 'Compensating Balances & Short-Term Borrowing Arrangements',
  '510': 'Separation of Debtholdings Between Road Property & Equipment',
  '512': 'Supporting Schedule — Capital Leases',
  '700': 'Mileage Operated at Close of Year',
  '702': 'Miles of Road at Close of Year — by States & Territories',
  '710': 'Inventory of Equipment',
  '710S': 'Unit Cost of Equipment Installed During the Year',
  '720': 'Track & Traffic Conditions',
  '750': 'Consumption of Diesel Fuel',
  '755': 'Railroad Operating Statistics',
  'A': 'Certification',
  'B': 'Identity of Respondent',
  'C': 'Voting Powers & Elections',
  'Memoranda': 'Memoranda',
}

export function scheduleName(id) {
  return columnSpec[id]?.name || SCHEDULE_NAMES[id] || `Schedule ${id}`
}

// Display order: numeric schedules ascending, then lettered/named ones.
export function orderSchedules(ids) {
  return [...ids].sort((a, b) => {
    const na = parseInt(a, 10)
    const nb = parseInt(b, 10)
    const aNum = !Number.isNaN(na)
    const bNum = !Number.isNaN(nb)
    if (aNum && bNum) return na - nb || a.localeCompare(b)
    if (aNum) return -1
    if (bNum) return 1
    return a.localeCompare(b)
  })
}

// Schedules whose printed form carries a blank "Cross Check" column — a
// manual verification column shown left of Account/Title. Presentation-only;
// it is never populated by data. Derived from the official xlsx form template
// (forms/R1-7-31-2026.xlsx) by scanning each sheet for a "Cross Check" header.
const CROSS_CHECK_SCHEDULES = new Set([
  '200', '210', '210A', '220', '240',
  '335', '342', '352B', '410', '412', '414', '415', '417', '450', '702', '710', '755',
  'PTC_335', 'PTC_352B', 'PTC_410', 'PTC_710',
])

export function hasCrossCheck(scheduleId) {
  return CROSS_CHECK_SCHEDULES.has(scheduleId)
}

export function detectShape(schedule) {
  for (const key of ['sections', 'rows', 'items', 'categories', 'answers', 'content']) {
    if (key in schedule) return key
  }
  return 'unknown'
}
