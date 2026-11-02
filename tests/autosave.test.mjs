import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Autosave} from '../public/planner/autosave.js';
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
test('autosave combines pending edits into one write',async()=>{let writes=0;const statuses=[];const autosave=new Autosave(async()=>writes++,s=>statuses.push(s),10000);autosave.touch();autosave.touch();await autosave.flush();assert.equal(writes,1);assert.equal(autosave.pending,false);assert.equal(statuses.at(-1),'Saved');autosave.reset();});
test('typing during a save writes the newest version afterwards without overlap',async()=>{
 const gate=deferred();let active=0,maximum=0,writes=0,value='first';const saved=[];
 const autosave=new Autosave(async()=>{const captured=value;active++;maximum=Math.max(maximum,active);if(writes++===0)await gate.promise;saved.push(captured);active--;},()=>{},10000);
 autosave.touch();const saving=autosave.flush();await Promise.resolve();value='latest';autosave.touch();gate.resolve();await saving;assert.deepEqual(saved,['first','latest']);assert.equal(maximum,1);assert.equal(autosave.pending,false);autosave.reset();
});
test('a failed save retains pending changes and can be retried',async()=>{
 let fail=true,saved=0;const statuses=[];const autosave=new Autosave(()=>{if(fail)throw Error('Offline');saved++;},s=>statuses.push(s),10000);autosave.touch();await assert.rejects(autosave.flush(),/Offline/);assert.equal(autosave.pending,true);assert.match(statuses.at(-1),/^Not saved/);fail=false;await autosave.flush();assert.equal(saved,1);assert.equal(autosave.pending,false);autosave.reset();
});
