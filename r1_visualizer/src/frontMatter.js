export const isReal = (v) => v != null && v !== '' && String(v).toUpperCase() !== 'UNKNOWN'

export function addressLines(addr) {
  if (!addr) return []
  if (typeof addr === 'string') {
    return addr.split(/\r?\n/).map((line) => line.trim()).filter(isReal)
  }
  if (Array.isArray(addr)) return addr.filter(isReal)
  if (typeof addr !== 'object') return []

  const lines = [...(addr.street_lines || [])].filter(isReal)
  const cityState = [addr.city, addr.state].filter(isReal).join(', ')
  const tail = [cityState, isReal(addr.postal_code) ? addr.postal_code : null].filter(Boolean).join('  ')
  if (tail) lines.push(tail)
  return lines
}

export function phoneText(tel) {
  if (!tel || !isReal(tel.number)) return null
  const area = isReal(tel.area_code) ? `(${tel.area_code}) ` : ''
  const ext = isReal(tel.extension) ? ` x${tel.extension}` : ''
  return `${area}${tel.number}${ext}`
}

function formatExpirationDate(formVersion) {
  if (!isReal(formVersion)) return ''
  const match = String(formVersion).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return String(formVersion)
  const [, year, month, day] = match
  return `${Number(month)}-${Number(day)}-${year}`
}

export function buildFrontMatter(sheet, envelope = {}) {
  const meta = envelope?.form_metadata || {}
  const resp = envelope?.respondent || {}
  const officer = envelope?.officer_in_charge || {}
  const reportYear = isReal(meta.report_year) ? String(meta.report_year) : ''
  const reportingMark = isReal(resp.reporting_mark) ? String(resp.reporting_mark) : ''

  return {
    sheet,
    reportYear,
    respondentName: isReal(resp.legal_name) ? String(resp.legal_name) : '',
    reportingMark,
    mailingAddressLines: addressLines(resp.mailing_address),
    correctNameAddressLines: addressLines(resp.correct_name_address_if_different),
    ombControlNumber: isReal(meta.omb_control_number) ? String(meta.omb_control_number) : '',
    expirationDate: formatExpirationDate(meta.form_version),
    titleYearEndingLine: `For the Year Ending December 31, ${reportYear || '20'}`,
    roadInitialsLine: `Road Initials: ${reportingMark} Year: ${reportYear}`.trim(),
    coverYearEndedLine: `YEAR ENDED DECEMBER 31, ${reportYear || '200_'}`,
    officer: {
      name: isReal(officer.name) ? String(officer.name) : '',
      title: isReal(officer.title) ? String(officer.title) : '',
      telephone: phoneText(officer.telephone) || '',
      officeAddressLines: addressLines(officer.office_address),
    },
  }
}
