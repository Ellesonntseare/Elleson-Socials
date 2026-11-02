import {socialProviders,socialAppNames,providerURL} from './social-providers.mjs';
import {seal,unseal,digest,base64url} from './token-vault.mjs';
import {selectedFacebookPage} from './page-selection.mjs';
export class SocialError extends Error{constructor(status,message){super(message);this.status=status;}}
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
const redirect=path=>new Response(null,{status:303,headers:{Location:path,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const callback=(origin,provider,prefix='/api',returnBase)=>returnBase?origin+returnBase+'/'+provider:origin+prefix+'/social/'+provider+'/callback';
const random=()=>base64url(crypto.getRandomValues(new Uint8Array(32)));
async function readJSON(request){
 if(Number(request.headers.get('content-length'))>8192)throw new SocialError(413,'These settings are too large.');
 const reader=request.body?.getReader();if(!reader)throw new SocialError(400,'Enter the connection details.');let total=0;const chunks=[];
 try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>8192){await reader.cancel();throw new SocialError(413,'These settings are too large.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new SocialError(400,'Invalid connection details.');}
}
async function remote(url,options={},fetcher=fetch){
 let r;try{r=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new SocialError(502,'The social app did not respond. Please try again.');}
 let data;try{data=await r.json();}catch{throw new SocialError(502,'The social app returned an unreadable response.');}
 const providerError=data.error&&(typeof data.error==='string'?data.error!=='ok':data.error.code&&data.error.code!=='ok');
 if(!r.ok||providerError)throw new SocialError(r.status===401||r.status===403?409:502,'The social app did not approve this request. Check its permissions or reconnect.');
 return data;
}
async function appConfig(env,provider){
 const p=socialProviders[provider];if(!p)throw new SocialError(404,'Account type not found.');
 const app=await env.DB.prepare('SELECT * FROM social_apps WHERE provider = ?').bind(p.app).first();
 if(!app||!env.SOCIAL_TOKEN_KEY)throw new SocialError(503,'This connection needs to be set up by the administrator.');
 return {...app,clientSecret:(await unseal(app.secret,env.SOCIAL_TOKEN_KEY,'app:'+p.app)).secret};
}
async function tokenRequest(p,app,params,fetcher){
 const body=new URLSearchParams(params),headers={'Content-Type':'application/x-www-form-urlencoded'};
 if(p.basic)headers.Authorization='Basic '+btoa(app.client_id+':'+app.clientSecret);
 else {body.set(p.app==='tiktok'?'client_key':'client_id',app.client_id);body.set('client_secret',app.clientSecret);}
 if(p.app==='meta')return remote(providerURL(p.token,app.api_version)+'?'+body,{},fetcher);
 return remote(providerURL(p.token,app.api_version),{method:'POST',headers,body},fetcher);
}
async function profiles(provider,token,app,fetcher){
 const auth={headers:{Authorization:'Bearer '+token.access_token}};
 if(provider==='facebook'||provider==='instagram'){
  const base='https://graph.facebook.com/'+app.api_version;
  const data=await remote(base+'/me/accounts?fields='+encodeURIComponent(provider==='facebook'?'id,name,picture{url},access_token,tasks':'id,name,access_token,tasks,instagram_business_account{id,username,name}')+'&limit=100',auth,fetcher);
  if(data.paging?.next)throw new SocialError(409,'Choose fewer than 100 Pages when connecting, then try again.');
  return (data.data||[]).filter(p=>provider==='facebook'||p.instagram_business_account).map(p=>({id:provider==='facebook'?p.id:p.instagram_business_account.id,name:provider==='facebook'?p.name:(p.instagram_business_account.username||p.instagram_business_account.name),picture:provider==='facebook'?p.picture?.data?.url:'',token:{...token,access_token:p.access_token},kind:provider==='facebook'?'page':'instagram'}));
 }
 if(provider==='youtube'){
  const data=await remote('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',auth,fetcher);
  return (data.items||[]).map(p=>({id:p.id,name:p.snippet.title,token}));
 }
 if(provider==='google'){
  const data=await remote('https://mybusinessaccountmanagement.googleapis.com/v1/accounts',auth,fetcher);const result=[];
  if(data.nextPageToken)throw new SocialError(409,'This Google account has too many businesses for one connection.');
  for(const account of (data.accounts||[]).slice(0,20)){
   if(!/^accounts\/\d+$/.test(account.name))continue;
   const list=await remote('https://mybusinessbusinessinformation.googleapis.com/v1/'+account.name+'/locations?readMask=name,title&pageSize=100',auth,fetcher);
   if(list.nextPageToken)throw new SocialError(409,'This business has more than 100 locations. Connect a smaller account.');
   for(const location of list.locations||[])result.push({id:account.name+'/'+location.name,name:location.title,token});
  }return result;
 }
 if(provider==='linkedin'){const p=await remote('https://api.linkedin.com/v2/userinfo',auth,fetcher);return [{id:p.sub,name:p.name,token}];}
 if(provider==='tiktok'){const d=await remote('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',auth,fetcher);return [{id:d.data?.user?.open_id,name:d.data?.user?.display_name,token}];}
 if(provider==='pinterest'){const p=await remote('https://api.pinterest.com/v5/user_account',auth,fetcher);return [{id:p.id||p.username,name:p.username,token}];}
 if(provider==='x'){const d=await remote('https://api.x.com/2/users/me',auth,fetcher);return [{id:d.data?.id,name:d.data?.username,token}];}
 if(provider==='threads'){const p=await remote('https://graph.threads.net/v1.0/me?fields=id,username',auth,fetcher);return [{id:p.id,name:p.username,token}];}
 return [];
}
async function saveAccounts(env,ws,provider,items){
 if(!items.length)throw new SocialError(409,'No eligible accounts were found. Check which Pages or profiles you allowed.');
 const now=new Date().toISOString();const statements=[];
 for(const item of items){
  if(typeof item.id!=='string'||!item.id||typeof item.name!=='string'||!item.name||!item.token.access_token)throw new SocialError(502,'The social app did not return a usable account.');
  const token=await seal(item.token,env.SOCIAL_TOKEN_KEY,'account:'+ws.id+':'+provider+':'+item.id);
  const expires=item.token.expires_at||null;
  statements.push(env.DB.prepare('INSERT INTO social_accounts (id, workspace_id, provider, remote_id, name, token, expires_at, scopes, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(workspace_id, provider, remote_id) DO UPDATE SET name = excluded.name, token = excluded.token, expires_at = excluded.expires_at, scopes = excluded.scopes, status = excluded.status, updated_at = excluded.updated_at').bind(crypto.randomUUID(),ws.id,provider,item.id,item.name.slice(0,300),token,expires,String(item.token.scope||''),'connected',now));
 }
 for(let i=0;i<statements.length;i+=20)await env.DB.batch(statements.slice(i,i+20));
 for(const item of items){const account=await env.DB.prepare('SELECT id FROM social_accounts WHERE workspace_id = ? AND provider = ? AND remote_id = ?').bind(ws.id,provider,item.id).first();let picture='';try{const u=new URL(item.picture);if(u.protocol==='https:'&&/(^|\.)(fbcdn\.net|fbsbx\.com|facebook\.com)$/.test(u.hostname))picture=u.href;}catch{}await env.DB.prepare('INSERT INTO account_profiles (account_id, workspace_id, picture, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET picture = excluded.picture, updated_at = excluded.updated_at').bind(account.id,ws.id,picture,now).run();}
}
export async function socialAPI(request,env,ws,isAdmin,{fetcher=fetch}={}){
 const url=new URL(request.url),path=url.pathname.split('/').filter(Boolean).slice(2),method=request.method;
 try{
  if((path.length===0||path.length===1&&path[0]==='pages')&&method==='GET'){
   const accounts=await env.DB.prepare('SELECT id, provider, remote_id, name, expires_at, scopes, status, updated_at FROM social_accounts WHERE workspace_id = ? ORDER BY name').bind(ws.id).all();
   const apps=await env.DB.prepare('SELECT provider, client_id, api_version FROM social_apps').bind().all();
   const profiles=await env.DB.prepare("SELECT account_id FROM account_profiles WHERE workspace_id = ? AND picture != ''").bind(ws.id).all();const pictures=new Set(profiles.results.map(p=>p.account_id));
   const activePageId=await selectedFacebookPage(env,ws.id);
   const visible=accounts.results.filter(a=>path[0]==='pages'?a.provider==='facebook':a.provider!=='facebook'||a.id===activePageId);
   return json({activePageId,facebookPageCount:accounts.results.filter(a=>a.provider==='facebook').length,accounts:visible.map(a=>({...a,avatarURL:pictures.has(a.id)?(env.API_PREFIX||'/api')+'/social/account/'+a.id+'/picture':null,status:a.expires_at&&a.expires_at<Date.now()?'expired':a.status})),providers:Object.entries(socialProviders).map(([id,p])=>({id,name:p.name,ready:!!env.SOCIAL_TOKEN_KEY&&(id==='bluesky'||apps.results.some(a=>a.provider===p.app)),callback:callback(url.origin,id,env.API_PREFIX||'/api',env.OAUTH_RETURN_BASE)})),isAdmin});
  }
  if(path.length===1&&path[0]==='active-page'&&method==='PUT'){
   const data=await readJSON(request);
   if(typeof data?.accountId!=='string'||!/^[0-9a-f-]{36}$/i.test(data.accountId))throw new SocialError(400,'Choose a Facebook Page.');
   const account=await env.DB.prepare("SELECT id FROM social_accounts WHERE workspace_id = ? AND id = ? AND provider = 'facebook'").bind(ws.id,data.accountId).first();
   if(!account)throw new SocialError(404,'Page not found in your account.');
   await env.DB.prepare('INSERT INTO page_preferences (workspace_id, account_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET account_id = excluded.account_id, updated_at = excluded.updated_at').bind(ws.id,account.id,new Date().toISOString()).run();
   return json({activePageId:account.id});
  }
  if(path[0]==='settings'){
   if(!isAdmin)throw new SocialError(403,'Administrator access is required.');
   if(method==='GET'){
    const rows=await env.DB.prepare('SELECT provider, client_id, api_version FROM social_apps').bind().all();
    return json({secureStorage:!!env.SOCIAL_TOKEN_KEY,apps:Object.entries(socialAppNames).map(([id,name])=>({id,name,clientId:rows.results.find(r=>r.provider===id)?.client_id||'',apiVersion:rows.results.find(r=>r.provider===id)?.api_version||'v23.0',configured:rows.results.some(r=>r.provider===id),callbacks:Object.entries(socialProviders).filter(([,p])=>p.app===id).map(([p])=>callback(url.origin,p,env.API_PREFIX||'/api',env.OAUTH_RETURN_BASE)),portal:Object.values(socialProviders).find(p=>p.app===id).docs}))});
   }
   if(method==='PUT'){
    if(!env.SOCIAL_TOKEN_KEY)throw new SocialError(503,'Secure account storage needs to be enabled first.');
    const data=await readJSON(request);
    if(!socialAppNames[data.provider]||typeof data.clientId!=='string'||!data.clientId.trim()||data.clientId.length>500||typeof data.clientSecret!=='string'||data.clientSecret.length>2000||!/^v\d{1,3}\.\d+$/.test(data.apiVersion||''))throw new SocialError(400,'Check the app ID, secret and version.');
    const old=await env.DB.prepare('SELECT secret FROM social_apps WHERE provider = ?').bind(data.provider).first();
    if(!data.clientSecret&&!old)throw new SocialError(400,'Enter the app secret.');
    const secret=data.clientSecret?await seal({secret:data.clientSecret},env.SOCIAL_TOKEN_KEY,'app:'+data.provider):old.secret;
    await env.DB.prepare('INSERT INTO social_apps (provider, client_id, secret, api_version, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(provider) DO UPDATE SET client_id = excluded.client_id, secret = excluded.secret, api_version = excluded.api_version, updated_at = excluded.updated_at').bind(data.provider,data.clientId.trim(),secret,data.apiVersion,new Date().toISOString()).run();return json({saved:true});
   }
  }
  const provider=path[0],p=socialProviders[provider];
  if(p&&path[1]==='start'&&method==='POST'){
   if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new SocialError(400,'Open your secure website address to connect this account.');
   const app=await appConfig(env,provider),state=random(),hash=await digest(state),verifier=random();
   await env.DB.prepare('DELETE FROM social_states WHERE expires_at < ?').bind(Date.now()).run();
   await env.DB.prepare('INSERT INTO social_states (hash, workspace_id, provider, verifier, expires_at) VALUES (?, ?, ?, ?, ?)').bind(hash,ws.id,provider,await seal({verifier},env.SOCIAL_TOKEN_KEY,'state:'+hash),Date.now()+600000).run();
   const destination=new URL(providerURL(p.auth,app.api_version));destination.search=new URLSearchParams({[provider==='tiktok'?'client_key':'client_id']:app.client_id,redirect_uri:callback(url.origin,provider,env.API_PREFIX||'/api',env.OAUTH_RETURN_BASE),response_type:'code',scope:p.scope,state});
   if(p.pkce){destination.searchParams.set('code_challenge',await digest(verifier));destination.searchParams.set('code_challenge_method','S256');}
   if(p.app==='google'){destination.searchParams.set('access_type','offline');destination.searchParams.set('prompt','consent');destination.searchParams.set('include_granted_scopes','true');}
   return json({url:destination.href});
  }
  if(p&&path[1]==='callback'&&method==='GET'){
   const hash=await digest(url.searchParams.get('state')||'');
   const state=await env.DB.prepare('DELETE FROM social_states WHERE hash = ? AND workspace_id = ? AND provider = ? AND expires_at > ? RETURNING verifier').bind(hash,ws.id,provider,Date.now()).first();
   if(!state)throw new SocialError(400,'This connection link expired. Please start again.');
   if(url.searchParams.has('error'))return redirect((env.APP_PATH||'/planner/')+'#channels');
   const code=url.searchParams.get('code');if(!code||code.length>4096)throw new SocialError(400,'The social app did not return an approval code.');
   const app=await appConfig(env,provider),{verifier}=await unseal(state.verifier,env.SOCIAL_TOKEN_KEY,'state:'+hash);
   let token=await tokenRequest(p,app,{grant_type:'authorization_code',code,redirect_uri:callback(url.origin,provider,env.API_PREFIX||'/api',env.OAUTH_RETURN_BASE),...(p.pkce?{code_verifier:verifier}:{})},fetcher);
   if(p.app==='meta')token=await tokenRequest(p,app,{grant_type:'fb_exchange_token',fb_exchange_token:token.access_token},fetcher);
   if(provider==='threads')token={...token,...await remote('https://graph.threads.net/access_token?'+new URLSearchParams({grant_type:'th_exchange_token',client_secret:app.clientSecret,access_token:token.access_token}),{},fetcher)};
   if(!token.access_token)throw new SocialError(502,'The social app did not return access.');
   token.expires_at=Number(token.expires_in)>0?Date.now()+Number(token.expires_in)*1000:null;
   await saveAccounts(env,ws,provider,await profiles(provider,token,app,fetcher));return redirect((env.APP_PATH||'/planner/')+'#channels');
  }
  if(provider==='bluesky'&&path[1]==='connect'&&method==='POST'){
   if(!env.SOCIAL_TOKEN_KEY)throw new SocialError(503,'Secure account storage needs to be enabled first.');
   const data=await readJSON(request);if(typeof data.handle!=='string'||!data.handle||data.handle.length>250||typeof data.password!=='string'||!data.password||data.password.length>100)throw new SocialError(400,'Enter your Bluesky handle and app password.');
   const result=await remote('https://bsky.social/xrpc/com.atproto.server.createSession',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:data.handle,password:data.password})},fetcher);
   await saveAccounts(env,ws,provider,[{id:result.did,name:result.handle,token:{access_token:result.accessJwt,refresh_token:result.refreshJwt,scope:'app-password',expires_at:Date.now()+90*60000}}]);return json({connected:true});
  }
  if(path[0]==='account'&&/^[0-9a-f-]{36}$/i.test(path[1]||'')){
   const account=await env.DB.prepare('SELECT * FROM social_accounts WHERE workspace_id = ? AND id = ?').bind(ws.id,path[1]).first();if(!account)throw new SocialError(404,'Account not found.');
   if(method==='GET'&&path[2]==='picture'){
    const profile=await env.DB.prepare('SELECT picture FROM account_profiles WHERE workspace_id = ? AND account_id = ?').bind(ws.id,account.id).first();let target;try{target=new URL(profile?.picture);}catch{throw new SocialError(404,'Page picture unavailable.');}if(target.protocol!=='https:'||!/(^|\.)(fbcdn\.net|fbsbx\.com|facebook\.com)$/.test(target.hostname))throw new SocialError(404,'Page picture unavailable.');
    const response=await fetcher(target.href,{redirect:'error',signal:AbortSignal.timeout(15000)});const type=response.headers.get('content-type')?.split(';')[0];if(!response.ok||!['image/png','image/jpeg','image/webp'].includes(type))throw new SocialError(404,'Page picture unavailable.');const bytes=await (async()=>{const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>1024*1024){await reader.cancel();throw new SocialError(413,'Page picture too large.');}chunks.push(r.value);}}finally{reader.releaseLock();}const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}return all;})();return new Response(bytes,{headers:{'Content-Type':type,'Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
   }
   if(method==='DELETE'&&path.length===2){await env.DB.prepare('DELETE FROM social_accounts WHERE workspace_id = ? AND id = ?').bind(ws.id,account.id).run();return json({disconnected:true});}
   if(method==='POST'&&path[2]==='check'){
    try{
     let token=await unseal(account.token,env.SOCIAL_TOKEN_KEY,'account:'+ws.id+':'+account.provider+':'+account.remote_id);
     const p=socialProviders[account.provider];let app;
     if(account.provider!=='bluesky')app=await appConfig(env,account.provider);
     if(token.expires_at&&token.expires_at<Date.now()+300000){
      if(account.provider==='threads')token={...token,...await remote('https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token',{headers:{Authorization:'Bearer '+token.access_token}},fetcher)};
      else if(account.provider==='bluesky'){const d=await remote('https://bsky.social/xrpc/com.atproto.server.refreshSession',{method:'POST',headers:{Authorization:'Bearer '+token.refresh_token}},fetcher);token={...token,access_token:d.accessJwt,refresh_token:d.refreshJwt,expires_in:90*60};}
      else if(token.refresh_token)token={...token,...await tokenRequest(p,app,{grant_type:'refresh_token',refresh_token:token.refresh_token},fetcher)};
      else throw new SocialError(409,'Reconnect this account to renew access.');
      token.expires_at=Number(token.expires_in)>0?Date.now()+Number(token.expires_in)*1000:null;
     }
     if(account.provider==='facebook'||account.provider==='instagram')await remote('https://graph.facebook.com/'+app.api_version+'/'+encodeURIComponent(account.remote_id)+'?fields=id',{headers:{Authorization:'Bearer '+token.access_token}},fetcher);
     else if(account.provider==='bluesky')await remote('https://bsky.social/xrpc/com.atproto.server.getSession',{headers:{Authorization:'Bearer '+token.access_token}},fetcher);
     else if(!(await profiles(account.provider,token,app,fetcher)).some(p=>p.id===account.remote_id))throw new SocialError(409,'This account is no longer available.');
     const encrypted=await seal(token,env.SOCIAL_TOKEN_KEY,'account:'+ws.id+':'+account.provider+':'+account.remote_id);
     await env.DB.prepare('UPDATE social_accounts SET token = ?, expires_at = ?, status = ?, updated_at = ? WHERE workspace_id = ? AND id = ?').bind(encrypted,token.expires_at||null,'connected',new Date().toISOString(),ws.id,account.id).run();return json({connected:true});
    }catch(error){await env.DB.prepare('UPDATE social_accounts SET status = ? WHERE workspace_id = ? AND id = ?').bind('reconnect',ws.id,account.id).run();if(account.status!=='reconnect')await env.DB.prepare('INSERT INTO notices (id, workspace_id, kind, title, message, entity_id, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)').bind(crypto.randomUUID(),ws.id,'attention','Reconnect your account','Open Accounts to reconnect '+account.name+'.',account.id,new Date().toISOString()).run();throw error;}
   }
  }
  throw new SocialError(404,'Connection action not found.');
 }catch(error){
  if(error instanceof SocialError)return json({error:error.message},error.status);
  console.error('Social account request failed',error?.name);return json({error:'This connection could not be saved. Please try again.'},500);
 }
}
