import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleAPI,cleanPost,checkedMediaType,readLimited} from '../lib/backend.mjs';
let db,env,objects;
beforeEach(()=>{
 db=new DatabaseSync(':memory:');
 // Exercise the exact generated schema, rather than a parallel test-only schema.
 const files=readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort();
 for(const file of files)db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const D1={async batch(statements){db.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());db.exec('COMMIT');return results;}catch(error){db.exec('ROLLBACK');throw error;}},prepare(sql){return {bind(...args){const statement=db.prepare(sql);return {async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}};},async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};}};}};}};
 objects=new Map();env={DB:D1,BUCKET:{async put(key,body){objects.set(key,new Uint8Array(body));},async get(key){const body=objects.get(key);return body?{body}:null;},async delete(key){objects.delete(key);}}};
});
const postId='11111111-1111-4111-8111-111111111111',mediaId='22222222-2222-4222-8222-222222222222';
const example=()=>({id:postId,caption:'A cloud draft.',title:'',board:'',targets:[{id:'facebook',format:'Text'}],mediaIds:[],plannedAt:null,timezone:'Africa/Johannesburg',status:'draft'});
function req(path,method='GET',data,user='alice',extra={}){
 const headers={...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':`${user}@example.test`}:{}),...(method!=='GET'?{origin:'https://app.test'}:{}),...extra};
 return new Request('https://app.test/api/'+path,{method,headers,...(data!==undefined?{body:typeof data==='string'||data instanceof Uint8Array?data:JSON.stringify(data)}:{})});
}
const call=(...args)=>handleAPI(req(...args),env);
test('anonymous requests cannot read the cloud workspace',async()=>assert.equal((await call('posts','GET',undefined,null)).status,401));
test('cross-origin writes are rejected before any record is created',async()=>{
 const r=await call('posts/'+postId,'PUT',example(),'alice',{'if-match':'0',origin:'https://evil.test'});assert.equal(r.status,403);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n,0);
});
test('cloud posts survive separate API requests and are scoped to the owner',async()=>{
 assert.equal((await call('posts/'+postId,'PUT',example(),'alice',{'if-match':'0'})).status,200);
 assert.equal((await (await call('posts')).json()).length,1);
 assert.deepEqual(await (await call('posts','GET',undefined,'bob')).json(),[]);
});
test('two devices cannot silently overwrite a newer post',async()=>{
 await call('posts/'+postId,'PUT',example(),'alice',{'if-match':'0'});
 const edited={...example(),caption:'Newer caption'};
 assert.equal((await call('posts/'+postId,'PUT',edited,'alice',{'if-match':'1'})).status,200);
 assert.equal((await call('posts/'+postId,'PUT',example(),'alice',{'if-match':'1'})).status,409);
 assert.equal((await (await call('posts')).json())[0].caption,'Newer caption');
});
test('another owner cannot edit or delete a known post ID',async()=>{
 await call('posts/'+postId,'PUT',example(),'alice',{'if-match':'0'});
 assert.equal((await call('posts/'+postId,'PUT',example(),'bob',{'if-match':'1'})).status,409);
 assert.equal((await call('posts/'+postId,'DELETE',undefined,'bob',{'if-match':'1'})).status,409);
});
test('stale deletes fail and deleted posts cannot be resurrected by an old create',async()=>{
 await call('posts/'+postId,'PUT',example(),'alice',{'if-match':'0'});
 assert.equal((await call('posts/'+postId,'DELETE',undefined,'alice',{'if-match':'0'})).status,409);
 assert.equal((await call('posts/'+postId,'DELETE',undefined,'alice',{'if-match':'1'})).status,200);
 assert.equal((await call('posts/'+postId,'PUT',example(),'alice',{'if-match':'0'})).status,409);
 assert.deepEqual(await (await call('posts')).json(),[]);
});
test('writes require a revision and valid platform data',async()=>{
 assert.equal((await call('posts/'+postId,'PUT',example())).status,428);
 assert.equal((await call('posts/'+postId,'PUT',{...example(),targets:[{id:'made-up',format:'Text'}]},'alice',{'if-match':'0'})).status,400);
});
test('server validates planned content independently of client checks',async()=>{
 const p={...example(),status:'planned',plannedAt:'2026-12-01T10:00:00Z',targets:[{id:'instagram',format:'Reel'}]};
 assert.equal((await call('posts/'+postId,'PUT',p,'alice',{'if-match':'0'})).status,400);
});
test('media upload, retrieval and ownership checks use private storage',async()=>{
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);
 assert.equal((await call('media/'+mediaId,'PUT',png,'alice',{'content-type':'image/png','x-media-name':'test.png'})).status,201);
 assert.equal((await call('media/'+mediaId+'/file')).status,200);
 assert.equal((await call('media/'+mediaId+'/file','GET',undefined,'bob')).status,404);
 assert.equal(objects.size,1);
});
test('SVG or HTML cannot masquerade as an image upload',async()=>{
 const r=await call('media/'+mediaId,'PUT','<svg onload="alert(1)"></svg>','alice',{'content-type':'image/png'});assert.equal(r.status,415);assert.equal(objects.size,0);
});
test('referenced media cannot be removed',async()=>{
 await call('media/'+mediaId,'PUT',new TextEncoder().encode('%PDF-test'),'alice',{'content-type':'application/pdf'});
 await call('posts/'+postId,'PUT',{...example(),mediaIds:[mediaId]},'alice',{'if-match':'0'});
 assert.equal((await call('media/'+mediaId,'DELETE')).status,409);
});
test('media from another workspace cannot be attached to a post',async()=>{
 await call('media/'+mediaId,'PUT',new TextEncoder().encode('%PDF-test'),'alice',{'content-type':'application/pdf'});
 assert.equal((await call('posts/'+postId,'PUT',{...example(),mediaIds:[mediaId]},'bob',{'if-match':'0'})).status,400);
});
test('unreferenced media is hidden after deletion',async()=>{
 await call('media/'+mediaId,'PUT',new TextEncoder().encode('%PDF-test'),'alice',{'content-type':'application/pdf'});
 assert.equal((await call('media/'+mediaId,'DELETE')).status,200);
 assert.equal((await call('media/'+mediaId+'/file')).status,404);
});
test('body limits are enforced even without a Content-Length header',async()=>{
 await assert.rejects(()=>readLimited(new Request('https://app.test',{method:'POST',body:'123456'}),4),error=>error.status===413);
});
test('server-owned fields cannot be supplied by a client',()=>{
 const p=cleanPost({...example(),workspaceId:'someone-else',version:900,updatedAt:'bad'},postId);assert.equal(p.workspaceId,undefined);assert.equal(p.version,undefined);assert.notEqual(p.updatedAt,'bad');
});
test('invalid timezones and duplicate target IDs are rejected',()=>{
 assert.throws(()=>cleanPost({...example(),timezone:'invented'},postId));assert.throws(()=>cleanPost({...example(),targets:[...example().targets,...example().targets]},postId));
});
test('media type derives from its signature rather than a claimed MIME header',()=>assert.equal(checkedMediaType(new TextEncoder().encode('%PDF-test'),'image/png'),'application/pdf'));
test('format options and image descriptions survive the cloud round trip',async()=>{
 await call('media/'+mediaId,'PUT',new Uint8Array([137,80,78,71,13,10,26,10,0]),'alice',{'content-type':'image/png'});
 const p={...example(),mediaIds:[mediaId],mediaDetails:{[mediaId]:{altText:'A bright studio window'}},targets:[{id:'youtube',format:'Video',options:{title:'A new film',madeForKids:'no',coverId:mediaId}}]};
 assert.equal((await call('posts/'+postId,'PUT',p,'alice',{'if-match':'0'})).status,200);
 const saved=(await (await call('posts')).json())[0];assert.equal(saved.targets[0].options.title,'A new film');assert.equal(saved.mediaDetails[mediaId].altText,'A bright studio window');
});
test('a cover image remains protected even when it is not a post attachment',async()=>{
 await call('media/'+mediaId,'PUT',new Uint8Array([137,80,78,71,13,10,26,10,0]),'alice',{'content-type':'image/png'});
 const p={...example(),targets:[{id:'youtube',format:'Video',options:{coverId:mediaId}}]};await call('posts/'+postId,'PUT',p,'alice',{'if-match':'0'});
 assert.equal((await call('media/'+mediaId,'DELETE')).status,409);
});
test('manual status requires completion records for all channels',async()=>{
 const invalid={...example(),status:'manual'};assert.equal((await call('posts/'+postId,'PUT',invalid,'alice',{'if-match':'0'})).status,400);
 const valid={...invalid,targets:[{id:'facebook',format:'Text',options:{manualCompletedAt:new Date().toISOString()}}]};assert.equal((await call('posts/'+postId,'PUT',valid,'alice',{'if-match':'0'})).status,200);
});

test('only the configured verified owner can bind admin, which then follows the stable ID',async()=>{
 env.ADMIN_BOOTSTRAP_EMAIL='alice@example.test';
 assert.equal((await (await call('session','GET',undefined,'bob')).json()).user.role,'member');
 assert.equal((await call('admin/history','GET',undefined,'bob')).status,403);
 const session=await (await call('session')).json();assert.equal(session.user.role,'admin');
 const changed=await (await call('session','GET',undefined,'alice',{'oai-authenticated-user-email':'changed@example.test'})).json();assert.equal(changed.user.role,'admin');
 assert.equal((await (await call('session','GET',undefined,'impostor',{'oai-authenticated-user-email':'alice@example.test'})).json()).user.role,'member');
});
test('65 draft pairs seed once without overwriting edits or reviving deletions',async()=>{
 env.ADMIN_BOOTSTRAP_EMAIL='alice@example.test';await call('session');
 const posts=await (await call('posts')).json(),media=await (await call('media')).json();
 assert.equal(posts.length,65);assert.equal(media.length,65);assert.ok(posts.every(p=>p.status==='draft'&&p.targets[0].id==='facebook'&&p.plannedAt===null));
 const post=posts[0];await call('posts/'+post.id,'PUT',{...post,caption:'My edited caption'},'alice',{'if-match':'1'});
 await call('posts/'+posts[1].id,'DELETE',undefined,'alice',{'if-match':'1'});
 await call('session');const reopened=await (await call('posts')).json();assert.equal(reopened.length,64);assert.equal(reopened.find(p=>p.id===post.id).caption,'My edited caption');
 // Simulate an interrupted import retry, including after deletion.
 db.prepare('UPDATE app_admins SET seeded = 0').run();await call('session');assert.equal((await (await call('posts')).json()).length,64);
 const file=await call('media/'+media[0].id+'/file');assert.equal(file.status,302);assert.match(file.headers.get('location'),/^\/content-packs\/sa-provinces\/\d\d\.png$/);
 assert.equal((await call('media/'+media[0].id+'/file','GET',undefined,'bob')).status,404);
});
test('history captures edits and deletion and recovers a new copy with its removed media',async()=>{
 env.ADMIN_BOOTSTRAP_EMAIL='alice@example.test';await call('session');
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);await call('media/'+mediaId,'PUT',png,'alice',{'content-type':'image/png'});
 const original={...example(),mediaIds:[mediaId]};await call('posts/'+postId,'PUT',original,'alice',{'if-match':'0'});
 await call('posts/'+postId,'PUT',{...original,caption:'Changed'},'alice',{'if-match':'1'});
 await call('posts/'+postId,'DELETE',undefined,'alice',{'if-match':'2'});
 await call('media/'+mediaId,'DELETE');
 const history=await (await call('admin/history')).json();assert.equal(history.filter(p=>p.postId===postId).length,3);
 assert.equal((await call('admin/recover/'+postId+'/1','POST',undefined,'bob')).status,403);
 const response=await call('admin/recover/'+postId+'/1','POST');assert.equal(response.status,201);const recovered=await response.json();assert.notEqual(recovered.id,postId);assert.equal(recovered.caption,original.caption);assert.equal(recovered.status,'draft');
 assert.equal((await call('media/'+mediaId+'/file')).status,200);
 assert.equal(db.prepare('SELECT deleted FROM posts WHERE id = ?').get(postId).deleted,1);
 assert.equal((await call('admin/recover/'+postId+'/999','POST')).status,404);
});
test('failed media recovery leaves content unchanged',async()=>{
 env.ADMIN_BOOTSTRAP_EMAIL='alice@example.test';await call('session');
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);await call('media/'+mediaId,'PUT',png,'alice',{'content-type':'image/png'});
 await call('posts/'+postId,'PUT',{...example(),mediaIds:[mediaId]},'alice',{'if-match':'0'});objects.clear();
 const before=db.prepare('SELECT count(*) AS n FROM posts').get().n;
 assert.equal((await call('admin/recover/'+postId+'/1','POST')).status,409);assert.equal(db.prepare('SELECT count(*) AS n FROM posts').get().n,before);
});
