import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeOptions,validateFormat,formatFields} from '../public/planner/formats.js';
import {validatePost} from '../public/planner/platforms.js';
import {previewHTML,extrasHTML} from '../public/planner/composer-extras.js';
import {publicationStatus,asNewDraft} from '../public/planner/manual-publishing.js';
test('each thread part is checked independently',()=>{
 const errors=validateFormat({id:'x',format:'Thread',options:{segments:['First', 'a'.repeat(281), '']}},{},280);
 assert.ok(errors.some(e=>e.includes('post 2')));assert.ok(errors.some(e=>e.includes('post 3')));
});
test('a thread can be planned using its own text without a shared caption',()=>assert.deepEqual(validatePost({caption:'',targets:[{id:'x',format:'Thread',options:{segments:['First post','Second post']}}]},[]),[]));
test('YouTube can have a platform-specific title and audience',()=>assert.deepEqual(validateFormat({id:'youtube',format:'Video',options:{title:'A video',madeForKids:'no',visibility:'private'}},{title:''},5000),[]));
test('offer and event dates must be complete and in order',()=>{
 assert.ok(validateFormat({id:'google',format:'Offer',options:{}},{},1500).length);
 assert.ok(validateFormat({id:'google',format:'Event',options:{eventTitle:'Launch',startsAt:'2026-11-06T12:00:00Z',endsAt:'2026-11-05T12:00:00Z'}},{},1500).some(e=>e.includes('after')));
});
test('unsafe destination links and malformed flags are rejected',()=>{
 assert.throws(()=>sanitizeOptions({url:'javascript:alert(1)'}));assert.throws(()=>sanitizeOptions({allowComments:'yes'}));
 assert.equal(sanitizeOptions({url:'https://example.com'}).url,'https://example.com');
});
test('format-specific fields avoid showing irrelevant channel settings',()=>{
 assert.ok(formatFields('youtube','Short').some(f=>f.key==='madeForKids'));assert.ok(!formatFields('x','Text').some(f=>f.key==='madeForKids'));assert.ok(formatFields('google','Offer').some(f=>f.key==='coupon'));
});
test('preview escapes captions and reflects a vertical format',()=>{
 const html=previewHTML({id:'instagram',format:'Reel',caption:'<script>bad</script>'},{name:'Instagram',mark:'I'},{},[],()=>'',0);
 assert.ok(html.includes('vertical'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});
test('thread editor contains separate numbered post fields',()=>{
 const html=extrasHTML({id:'threads',format:'Thread',options:{segments:['one','two']}},[]);assert.ok(html.includes('thread post 1'));assert.ok(html.includes('thread post 2'));
});
test('manual posting is complete only when every target was confirmed',()=>{
 const first={id:'x',options:{manualCompletedAt:'2026-11-02T10:00:00Z'}},second={id:'bluesky',options:{}};
 assert.equal(publicationStatus({status:'planned',targets:[first,second]}),'planned');second.options.manualCompletedAt='2026-11-02T10:00:00Z';assert.equal(publicationStatus({status:'manual',targets:[first,second]}),'manual');
});
test('reusing a posted item preserves the original and clears completion records',()=>{
 const post={id:crypto.randomUUID(),version:4,status:'manual',plannedAt:'2026-11-01T10:00:00Z',targets:[{id:'x',options:{manualCompletedAt:'2026-11-01T10:00:00Z'}}]};
 const copy=asNewDraft(post);assert.notEqual(copy.id,post.id);assert.equal(copy.version,0);assert.equal(copy.plannedAt,null);assert.equal(publicationStatus(copy),'draft');assert.equal(post.targets[0].options.manualCompletedAt,'2026-11-01T10:00:00Z');
});
test('polls require choices and valid voting duration',()=>{
 assert.ok(validateFormat({id:'x',format:'Poll',options:{pollQuestion:'Choose one',pollChoices:['a'],pollDuration:'1'}},{},280).length>=2);
 assert.deepEqual(validateFormat({id:'linkedin',format:'Poll',options:{pollQuestion:'What next?',pollChoices:['A','B'],pollDuration:'10080'}},{},3000),[]);
});
