import assert from 'node:assert/strict'
import test from 'node:test'

import { buildFrontMatter } from './frontMatter.js'

const envelope = {
  form_metadata: {
    form_version: '2026-07-31',
    omb_control_number: '2140-0009',
    report_year: 2013,
  },
  respondent: {
    legal_name: 'CSX Transportation, Inc.',
    reporting_mark: 'CSXT',
    mailing_address: {
      street_lines: ['500 Water Street', '2nd Floor C729'],
      city: 'Jacksonville',
      state: 'Florida',
      postal_code: '32202-4423',
    },
  },
  officer_in_charge: {
    name: 'Angie Williams',
    title: 'Assistant Controller',
    telephone: {
      area_code: '904',
      number: '366-4365',
    },
    office_address: {
      street_lines: ['500 Water Street', '2nd Floor C729'],
      city: 'Jacksonville',
      state: 'Florida',
      postal_code: '32202-4423',
    },
  },
}

test('title front matter maps respondent data into printed form labels', () => {
  const view = buildFrontMatter('Title', envelope)

  assert.equal(view.respondentName, 'CSX Transportation, Inc.')
  assert.equal(view.reportingMark, 'CSXT')
  assert.deepEqual(view.mailingAddressLines, [
    '500 Water Street',
    '2nd Floor C729',
    'Jacksonville, Florida  32202-4423',
  ])
  assert.equal(view.ombControlNumber, '2140-0009')
  assert.equal(view.expirationDate, '7-31-2026')
  assert.equal(view.titleYearEndingLine, 'For the Year Ending December 31, 2013')
})

test('cover front matter formats road initials and officer correspondence lines', () => {
  const view = buildFrontMatter('Cover', envelope)

  assert.equal(view.roadInitialsLine, 'Road Initials: CSXT Year: 2013')
  assert.equal(view.coverYearEndedLine, 'YEAR ENDED DECEMBER 31, 2013')
  assert.equal(view.officer.name, 'Angie Williams')
  assert.equal(view.officer.title, 'Assistant Controller')
  assert.equal(view.officer.telephone, '(904) 366-4365')
  assert.deepEqual(view.officer.officeAddressLines, [
    '500 Water Street',
    '2nd Floor C729',
    'Jacksonville, Florida  32202-4423',
  ])
})
