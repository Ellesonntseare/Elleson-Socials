import {test} from 'node:test';
import assert from 'node:assert/strict';
import {activitySummary,planningCSV} from '../public/planner/reports.js';
const platforms=[{id:'x',name:'X'},{id:'linkedin',name:'LinkedIn'}];
test('planning reports count each channel version and manual confirmation',()=>{
 const posts=[{status:'planned',targets:[{id:'x',options:{manualCompletedAt:'2026-11-02T12:00:00Z'}},{id:'linkedin'}]},{status:'draft',targets:[{id:'x'}]}];
 assert.deepEqual(activitySummary(posts,platforms),[{name:'X',drafts:1,planned:0,manual:1,total:2},{name:'LinkedIn',drafts:0,planned:1,manual:0,total:1}]);
});
test('CSV escapes multiline captions and neutralizes spreadsheet formulas',()=>{
 const csv=planningCSV([{id:'1',status:'draft',caption:'=SUM(1,2)\n"caption"',targets:[{id:'x',format:'Text'}]}],platforms);
 assert.ok(csv.includes("'=SUM(1,2)"));assert.ok(csv.includes('""caption""'));assert.ok(csv.startsWith('\ufeff'));assert.ok(csv.includes('"X"'));
});
