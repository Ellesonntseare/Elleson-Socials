import {test} from 'node:test';
import assert from 'node:assert/strict';
async function client(handler){
 globalThis.location={pathname:'/planner/index.html',search:''};globalThis.fetch=handler;
 return import('../public/planner/storage.js?case='+crypto.randomUUID());
}
test('an unavailable cloud API does not fall back to device storage',async()=>{
 const storage=await client(async()=>Response.json({error:'Cloud unavailable'},{status:503}));
 await assert.rejects(()=>storage.all('posts'),error=>error.status===503);
 assert.equal(storage.storageState.mode,'cloud');
});
test('cloud writes send the revision read by the editor',async()=>{
 const requests=[];const storage=await client(async(path,options)=>{
  requests.push({path,options});if(path==='/api/session')return Response.json({mode:'cloud'});
  if(options.method==='PUT')return Response.json({id:'post-1',version:4});
  return Response.json([{id:'post-1',version:3}]);
 });
 await storage.all('posts');await storage.put('posts',{id:'post-1',version:3,caption:'Edited'});
 assert.equal(requests.at(-1).options.headers['If-Match'],'3');
 assert.equal(requests.at(-1).options.credentials,'same-origin');
});
test('a conflict reaches the editor with the server message',async()=>{
 const storage=await client(async path=>path==='/api/session'?Response.json({mode:'cloud'}):Response.json({error:'Changed on another device'},{status:409}));
 await assert.rejects(()=>storage.put('posts',{id:'p',version:1}),error=>error.status===409&&error.message==='Changed on another device');
});
test('cloud media upload sends a Blob without expanding it to base64',async()=>{
 let upload;const storage=await client(async(path,options)=>{if(path==='/api/session')return Response.json({mode:'cloud'});upload=options;return Response.json({id:'m'});});
 const blob=new Blob(['a'],{type:'image/png'});await storage.put('media',{id:'m',name:'My image.png',type:'image/png',blob});
 assert.equal(upload.body,blob);assert.equal(upload.headers['X-Media-Name'],'My%20image.png');
});
