import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createSocialsHost} from '../server/node-host.mjs';

test('Node mount persists account-owned posts and activity, protects media and ignores forged identity headers',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'elleson-socials-node-'));let host=createSocialsHost({dataDir:dir});
 // Test-only host session resolver emulates Connect's authenticated principal.
 const server=createServer(async(req,res)=>{try{const user=req.headers['x-test-session'];const principal=user?{id:'connect:'+user,email:user+'@example.test',admin:user==='alice'}:null;if(!await host.handle(req,res,{principal,origin:'http://'+req.headers.host})){res.writeHead(404);res.end();}}catch(error){res.writeHead(500);res.end(error.message);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const call=(route,{user='alice',method='GET',body,headers={}}={})=>fetch(origin+'/socials/'+route,{method,headers:{...(user?{'x-test-session':user}:{}),...(method==='GET'?{}:{Origin:origin}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 try{
  assert.equal((await call('api/session',{user:null})).status,401);
  const session=await call('api/session');assert.equal(session.status,200,await session.clone().text());assert.equal((await session.json()).user.role,'admin');
  let posts=await (await call('api/posts')).json();assert.equal(posts.length,65);const first=posts[0];
  const files=await (await call('api/media')).json();assert.ok(files[0].url.startsWith('/socials/api/media/'));
  const image=await fetch(origin+files[0].url,{headers:{'x-test-session':'alice'}});assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');
  assert.equal((await fetch(origin+files[0].url,{headers:{'x-test-session':'bob'}})).status,404);
  const bob=await call('api/posts',{user:'bob',headers:{'oai-authenticated-user-id':'connect:alice'}});assert.deepEqual(await bob.json(),[]);
  const changed={...first,caption:'Saved through the shared PC server'};
  assert.equal((await call('api/posts/'+first.id,{method:'PUT',body:changed,headers:{'If-Match':'1','Content-Type':'application/json'}})).status,200);
  const history=await (await call('api/activity')).json();assert.ok(history.some(row=>row.event==='post.saved'));assert.deepEqual(await (await call('api/activity',{user:'bob'})).json(),[]);
  const page=await call('');assert.equal(page.status,200);const html=await page.text();assert.match(html,/name="api-base" content="\/socials\/api\/"/);assert.match(html,/← Projects/);
  const leak=await call('%2e%2e/server-secrets.json');assert.equal(leak.status,404);
  host.close();host=createSocialsHost({dataDir:dir});posts=await (await call('api/posts')).json();assert.equal(posts.find(p=>p.id===first.id).caption,changed.caption);assert.equal(posts.length,65);
 }finally{
  await new Promise(r=>server.close(r));host.close();const resolved=path.resolve(dir);assert.ok(resolved.startsWith(path.resolve(tmpdir())+path.sep+'elleson-socials-node-'));rmSync(resolved,{recursive:true,force:true});
 }
});
