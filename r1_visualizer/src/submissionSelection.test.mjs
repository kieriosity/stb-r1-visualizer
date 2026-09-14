import assert from 'node:assert/strict'
import test from 'node:test'
import { initialSubmission } from './config.js'

const submissions=[{carrier:'BNSF',year:2008,version:1},{carrier:'BNSF',year:2008,version:2},
  {carrier:'UP',year:2025,version:3}]

test('filing preselection accepts lowercase carrier and numeric query strings',()=>{
  assert.equal(initialSubmission(submissions,{carrier:'bnsf',year:'2008',version:'2'}),submissions[1])
})
test('an unavailable requested filing never falls back to a different filing',()=>{
  for(const options of [{carrier:'missing'},{carrier:'BNSF',year:2025},{carrier:'BNSF',year:2008,version:3}]) {
    assert.equal(initialSubmission(submissions,options),null)
  }
})
test('unfiltered browsing and partial selectors keep the existing latest-match behavior',()=>{
  assert.equal(initialSubmission(submissions),submissions[2])
  assert.equal(initialSubmission(submissions,{carrier:'BNSF'}),submissions[1])
  assert.equal(initialSubmission([],{}),null)
})
