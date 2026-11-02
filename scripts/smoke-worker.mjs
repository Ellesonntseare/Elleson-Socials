// CI integration check against the built Worker and actual local D1/R2 bindings.
// Test identity headers emulate the trusted dispatch boundary only on loopback.
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:8788';
const processHandle=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','8788','--inspector-port','0'],{stdio:'inherit'});
const postId=crypto.randomUUID(),mediaId=crypto.randomUUID();
async function call(path,{method='GET',body,user='ci-user',version}={}){
 const headers={...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':user+'@example.test'}:{}),...(method!=='GET'?{Origin:origin}:{}),...(version!==undefined?{'If-Match':String(version)}:{})};
 if(body&&!(body instanceof Uint8Array))headers['Content-Type']='application/json';
 if(body instanceof Uint8Array){headers['Content-Type']='image/png';headers['X-Media-Name']='ci-image.png';}
 return fetch(origin+'/api/'+path,{method,headers,signal:AbortSignal.timeout(15000),...(body?{body:body instanceof Uint8Array?body:JSON.stringify(body)}:{})});
}
try{
 let up=false;for(let i=0;i<60;i++){try{const r=await call('session',{user:null});if(r.status===401){up=true;break;}}catch{}if(processHandle.exitCode!==null)throw Error('Worker exited before startup.');await new Promise(resolve=>setTimeout(resolve,1000));}
 assert.ok(up,'Worker starts and rejects anonymous requests');
 const session=await call('session');assert.equal(session.status,200,await session.clone().text());
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7XcAAAAASUVORK5CYII=','base64'));
 const upload=await call('media/'+mediaId,{method:'PUT',body:png});assert.equal(upload.status,201,await upload.clone().text());
 assert.equal((await call('media/'+mediaId+'/file')).status,200);
 assert.equal((await call('media/'+mediaId+'/file',{user:'other-ci-user'})).status,404);
 const draft={id:postId,caption:'Worker integration check',title:'',board:'',targets:[{id:'instagram',format:'Image'}],mediaIds:[mediaId],plannedAt:null,timezone:'Africa/Johannesburg',status:'draft'};
 const saved=await call('posts/'+postId,{method:'PUT',body:draft,version:0});assert.equal(saved.status,200,await saved.clone().text());
 assert.ok((await (await call('posts')).json()).some(p=>p.id===postId));
 assert.deepEqual(await (await call('posts',{user:'other-ci-user'})).json(),[]);
 assert.equal((await call('posts/'+postId,{method:'PUT',body:{...draft,caption:'Updated'},version:1})).status,200);
 assert.equal((await call('posts/'+postId,{method:'PUT',body:draft,version:1})).status,409);
 assert.equal((await call('media/'+mediaId,{method:'DELETE'})).status,409);
 assert.equal((await call('posts/'+postId,{method:'DELETE',version:2})).status,200);
 assert.equal((await call('media/'+mediaId,{method:'DELETE'})).status,200);
 const page=await fetch(origin+'/planner/index.html');assert.equal(page.status,200);assert.ok((await page.text()).includes('Elleson Socials'));
 console.log('Built Worker integration check passed: identity, D1, R2, isolation, revisions, deletion, static planner.');
}finally{processHandle.kill('SIGTERM');}
