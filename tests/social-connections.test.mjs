import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {socialAPI} from '../lib/social-connections.mjs';
import {seal,unseal} from '../lib/token-vault.mjs';
let db,env;
const key='ab'.repeat(32),ws={id:'test-workspace'};
beforeEach(()=>{
 db=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())db.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const D1={prepare(sql){return {bind(...args){const s=db.prepare(sql);return {async run(){return {meta:{changes:Number(s.run(...args).changes)}};},async first(){return s.get(...args)||null;},async all(){return {results:s.all(...args)};}};}};},async batch(stmts){db.exec('BEGIN');try{const result=[];for(const s of stmts)result.push(await s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};env={DB:D1,SOCIAL_TOKEN_KEY:key};
});
const response=data=>Response.json(data);
const request=(path,method='GET',body)=>new Request('https://app.test/api/social/'+path,{method,headers:{Origin:'https://app.test'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
const call=(path,method='GET',body,admin=true,workspace=ws,fetcher)=>socialAPI(request(path,method,body),env,workspace,admin,{fetcher});
async function setup(provider='meta'){const r=await call('settings','PUT',{provider,clientId:'client-123',clientSecret:'do-not-disclose-secret',apiVersion:'v23.0'});assert.equal(r.status,200);}
async function start(provider='facebook'){const r=await call(provider+'/start','POST');assert.equal(r.status,200);return new URL((await r.json()).url);}
function cb(provider,state,workspace=ws,fetcher){return socialAPI(new Request('https://app.test/api/social/'+provider+'/callback?code=one-use-code&state='+encodeURIComponent(state)),env,workspace,true,{fetcher});}
test('encrypted tokens reject tampering and cross-workspace substitution',async()=>{
 const encrypted=await seal({access_token:'secret'},key,'account:one');assert.ok(!encrypted.includes('secret'));assert.deepEqual(await unseal(encrypted,key,'account:one'),{access_token:'secret'});await assert.rejects(unseal(encrypted,key,'account:two'));await assert.rejects(unseal(encrypted.slice(0,-3)+'aaa',key,'account:one'));
});
test('only admin can configure apps and saved secrets never return to the browser',async()=>{
 assert.equal((await call('settings','GET',undefined,false)).status,403);assert.equal((await call('settings','PUT',{},false)).status,403);await setup();
 const stored=db.prepare('SELECT secret FROM social_apps').get().secret;assert.ok(!stored.includes('do-not-disclose-secret'));
 const settings=await (await call('settings')).text();assert.ok(!settings.includes('do-not-disclose-secret'));const data=await (await call('')).json();assert.equal(data.providers.find(p=>p.id==='facebook').ready,true);assert.equal(data.providers.find(p=>p.id==='linkedin').ready,false);
});
test('unconfigured apps cannot claim a successful connection',async()=>{
 assert.equal((await call('facebook/start','POST')).status,503);assert.equal(db.prepare('SELECT count(*) AS n FROM social_states').get().n,0);
 assert.equal((await (await call('')).json()).accounts.length,0);
});
test('Facebook authorization is bound to one workspace and cannot be replayed',async()=>{
 await setup();const url=await start(),state=url.searchParams.get('state');assert.equal(url.origin,'https://www.facebook.com');assert.equal(url.searchParams.get('redirect_uri'),'https://app.test/api/social/facebook/callback');assert.ok(state.length>=40);
 let calls=0;const fake=async url=>{calls++;if(String(url).includes('/oauth/access_token'))return response({access_token:'private-user-token',expires_in:3600});return response({data:[{id:'page-123',name:'My real Page',access_token:'private-page-token'}]});};
 assert.equal((await cb('facebook',state,{id:'another-owner'},fake)).status,400);assert.equal(calls,0);
 const r=await cb('facebook',state,ws,fake);assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/planner/#channels');assert.equal(calls,3);
 const data=await (await call('')).text();assert.ok(data.includes('My real Page'));assert.ok(!data.includes('private-page-token'));assert.ok(!data.includes('private-user-token'));
 assert.equal((await cb('facebook',state,ws,fake)).status,400);assert.equal(calls,3);
});
test('expired state does not exchange an authorization code',async()=>{
 await setup();const state=(await start()).searchParams.get('state');db.prepare('UPDATE social_states SET expires_at = 0').run();const r=await cb('facebook',state,ws,()=>{throw Error('must not call');});assert.equal(r.status,400);
});
test('Google authorization uses PKCE and keeps refresh tokens server-side',async()=>{
 await setup('google');const url=await start('youtube'),state=url.searchParams.get('state');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('access_type'),'offline');
 const fake=async(url,options)=>{if(String(url).includes('oauth2.googleapis.com/token')){assert.ok(options.body.get('code_verifier'));assert.equal(options.body.get('client_secret'),'do-not-disclose-secret');return response({access_token:'private-google-token',refresh_token:'private-refresh-token',expires_in:3600});}return response({items:[{id:'channel-1',snippet:{title:'My channel'}}]});};
 assert.equal((await cb('youtube',state,ws,fake)).status,303);const result=await (await call('')).text();assert.ok(result.includes('My channel'));assert.ok(!result.includes('private-refresh-token'));assert.ok(!db.prepare('SELECT token FROM social_accounts').get().token.includes('private-refresh-token'));
});
test('Bluesky uses only the official host and does not save the supplied app password',async()=>{
 const fake=async(url,options)=>{assert.equal(url,'https://bsky.social/xrpc/com.atproto.server.createSession');assert.equal(JSON.parse(options.body).password,'app-password-only');return response({did:'did:plc:abc',handle:'example.bsky.social',accessJwt:'access-jwt',refreshJwt:'refresh-jwt'});};
 assert.equal((await call('bluesky/connect','POST',{handle:'example.bsky.social',password:'app-password-only'},true,ws,fake)).status,200);const row=db.prepare('SELECT * FROM social_accounts').get();assert.ok(!row.token.includes('app-password-only'));assert.equal(row.name,'example.bsky.social');
 assert.equal((await call('account/'+row.id,'DELETE',undefined,true,{id:'other'})).status,404);assert.equal((await call('account/'+row.id,'DELETE')).status,200);
});
test('provider rejection does not create a connected account or leak its response',async()=>{
 await setup();const state=(await start()).searchParams.get('state');const r=await cb('facebook',state,ws,async()=>new Response(JSON.stringify({error:{code:190,message:'secret-token-in-response'}}),{status:400,headers:{'Content-Type':'application/json'}}));assert.equal(r.status,502);assert.ok(!(await r.text()).includes('secret-token'));assert.equal(db.prepare('SELECT count(*) AS n FROM social_accounts').get().n,0);
});
test('social settings reject oversized streamed bodies',async()=>{
 const r=await socialAPI(new Request('https://app.test/api/social/settings',{method:'PUT',body:JSON.stringify({clientSecret:'x'.repeat(9000)})}),env,ws,true);assert.equal(r.status,413);
});
