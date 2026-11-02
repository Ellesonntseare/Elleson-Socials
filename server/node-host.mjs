// Mount the standalone app inside a trusted Node host (for example Elleson Connect).
// The host authenticates requests and passes a stable account principal. Browser
// headers never determine identity. No cloud credentials or data are copied.
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes} from 'node:crypto';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,existsSync,realpathSync} from 'node:fs';
import {readFile,writeFile,rename,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {handleAPI} from '../lib/backend.mjs';
import {recoverScheduledJobs,runScheduledJobs} from '../lib/posting-queue.mjs';
import {deliverPhoneNotifications} from '../lib/phone-notifications.mjs';
import {seal,unseal} from '../lib/token-vault.mjs';
const sourceRoot=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
export function createSocialsHost({dataDir,mount='/socials',root=sourceRoot}={}){
 if(!dataDir||!/^\/[a-z0-9-]+$/.test(mount))throw Error('Choose a Socials data folder and a simple mount path.');
 dataDir=path.resolve(dataDir);mkdirSync(dataDir,{recursive:true});
 const secrets=path.join(dataDir,'server-secrets.json');
 if(!existsSync(secrets))writeFileSync(secrets,JSON.stringify({tokenKey:randomBytes(32).toString('hex')}),{flag:'wx',mode:0o600});
 const tokenKey=JSON.parse(readFileSync(secrets,'utf8')).tokenKey;
 const sqlite=new DatabaseSync(path.join(dataDir,'socials.sqlite'));sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
 sqlite.exec('CREATE TABLE IF NOT EXISTS _socials_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL)');
 for(const name of readdirSync(path.join(root,'drizzle')).filter(n=>n.endsWith('.sql')).sort()){
  const sql=readFileSync(path.join(root,'drizzle',name),'utf8').replaceAll('\r\n','\n'),hash=createHash('sha256').update(sql).digest('hex');
  const old=sqlite.prepare('SELECT hash FROM _socials_migrations WHERE name = ?').get(name);if(old){if(old.hash!==hash)throw Error('An applied Socials migration changed: '+name);continue;}
  sqlite.exec('BEGIN');try{sqlite.exec(sql);sqlite.prepare('INSERT INTO _socials_migrations VALUES (?, ?)').run(name,hash);sqlite.exec('COMMIT');}catch(error){sqlite.exec('ROLLBACK');sqlite.close();throw error;}
 }
 const DB={prepare(sql){return {bind(...args){const statement=sqlite.prepare(sql);return {run(){return {meta:{changes:Number(statement.run(...args).changes)}};},first(){return statement.get(...args)||null;},all(){return {results:statement.all(...args)};}};}};},batch(statements){sqlite.exec('BEGIN');try{const rows=statements.map(s=>s.run());sqlite.exec('COMMIT');return rows;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
 // Retain one consistent database snapshot per UTC day, separate from source.
 const backupDir=path.join(dataDir,'backups');mkdirSync(backupDir,{recursive:true});
 function dailyBackup(){
  const day=new Date().toISOString().slice(0,10),file=path.join(backupDir,day+'.sqlite');
  if(!existsSync(file))sqlite.prepare('VACUUM INTO ?').run(file);
  const keyFile=path.join(backupDir,'server-secrets.json');if(!existsSync(keyFile))writeFileSync(keyFile,readFileSync(secrets),{flag:'wx',mode:0o600});
 }
 dailyBackup();const backupTimer=setInterval(()=>{try{dailyBackup();}catch(error){console.error('Socials backup failed',error?.name);}},60*60*1000);backupTimer.unref();
 const files=path.join(dataDir,'files');mkdirSync(files,{recursive:true});
 function objectPath(key){if(typeof key!=='string'||!/^[-a-z0-9/]{1,240}$/i.test(key)||key.includes('..'))throw Error('Invalid media key.');const target=path.resolve(files,key);if(!target.startsWith(files+path.sep))throw Error('Invalid media key.');return target;}
 const BUCKET={async put(key,bytes){const target=objectPath(key);mkdirSync(path.dirname(target),{recursive:true});const tmp=target+'.'+randomBytes(8).toString('hex')+'.tmp';await writeFile(tmp,bytes,{mode:0o600});await rename(tmp,target);},async get(key){const target=objectPath(key);try{await stat(target);return {body:Readable.toWeb(createReadStream(target))};}catch(error){if(error.code==='ENOENT')return null;throw error;}},async delete(){/* Retain private orphan objects for recovery; no destructive purge on app updates. */}};
 const publicRoot=realpathSync(path.join(root,'public'));
 const schedulerState={lastTick:null,running:false};
 const runtime={DB,BUCKET,SOCIAL_TOKEN_KEY:tokenKey,API_PREFIX:mount+'/api',APP_PATH:mount+'/',OAUTH_RETURN_BASE:mount+'/connect',SCHEDULER_ENABLED:true,schedulerState,async readBundledMedia(asset){if(!/^\/content-packs\/sa-provinces\/\d\d\.png$/.test(asset))throw Error('Invalid bundled media.');return new Uint8Array(await readFile(path.join(publicRoot,asset.slice(1))));}};
 // Push setup is independent of publishing. A missing optional runtime package
 // must never stop the posting scheduler or prevent access to saved work.
 void (async()=>{try{const {default:webpush}=await import('web-push');const keyFile=path.join(dataDir,'phone-push-key.json');let keys;
  if(existsSync(keyFile))keys=await unseal(JSON.parse(readFileSync(keyFile,'utf8')).sealed,tokenKey,'phone-push-key');
  else{keys=webpush.generateVAPIDKeys();writeFileSync(keyFile,JSON.stringify({sealed:await seal(keys,tokenKey,'phone-push-key')}),{flag:'wx',mode:0o600});}
  const savedKey=path.join(backupDir,'phone-push-key.json');if(!existsSync(savedKey))writeFileSync(savedKey,readFileSync(keyFile),{flag:'wx',mode:0o600});
  runtime.PUSH_PUBLIC_KEY=keys.publicKey;runtime.pushSender=(subscription,payload)=>webpush.sendNotification(subscription,payload,{vapidDetails:{subject:'https://github.com/Ellesonntseare/Elleson-Socials',publicKey:keys.publicKey,privateKey:keys.privateKey},TTL:86400,urgency:'high',timeout:10000});
 }catch(error){console.error('Phone notifications unavailable',error?.name);}})();
 let stopping=false,recovered=false;
 async function tick(){if(stopping||schedulerState.running)return;schedulerState.running=true;try{if(!recovered){await recoverScheduledJobs(runtime);await DB.prepare("UPDATE push_deliveries SET status = 'retry', next_attempt = ? WHERE status = 'sending'").bind(new Date().toISOString()).run();recovered=true;}schedulerState.lastTick=Date.now();await runScheduledJobs(runtime);await deliverPhoneNotifications(runtime);}catch(error){console.error('Socials queue check failed',error?.name);}finally{schedulerState.running=false;}}
 const queueTimer=setInterval(tick,10000);queueTimer.unref();void tick();
 async function handle(req,res,{principal,origin}={}){
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname!==mount&&!pathname.startsWith(mount+'/'))return false;
  if(!principal?.id||!principal.email){res.writeHead(401,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({error:'Sign in to Elleson Connect.'}));return true;}
  if(pathname===mount){res.writeHead(303,{Location:mount+'/','Cache-Control':'no-store'});res.end();return true;}
  const url=new URL(req.url,origin||'http://'+req.headers.host);
  const relative=url.pathname.slice(mount.length)||'/';
  if(relative.startsWith('/api/')){
   const headers=new Headers();for(const key of ['content-type','content-length','if-match','x-media-name','origin'])if(typeof req.headers[key]==='string')headers.set(key,req.headers[key]);
   headers.set('oai-authenticated-user-id',principal.id);headers.set('oai-authenticated-user-email',principal.email);
   // Host-approved same-origin writes only. No missing-Origin exception.
   const target=new URL(url);target.pathname=relative;
   const request=new Request(target,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
   const response=await handleAPI(request,{...runtime,ADMIN_BOOTSTRAP_EMAIL:principal.admin?principal.email:undefined});
   const responseHeaders=Object.fromEntries(response.headers);
   if(responseHeaders.location?.startsWith('/content-packs/'))responseHeaders.location=mount+responseHeaders.location;
   res.writeHead(response.status,responseHeaders);if(response.body)Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);else res.end();return true;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return true;}
  let asset=relative==='/'||relative==='/index.html'?'planner/index.html':relative.startsWith('/content-packs/')?relative.slice(1):'planner/'+relative.slice(1);
  let file;try{file=realpathSync(path.resolve(publicRoot,decodeURIComponent(asset)));}catch{res.writeHead(404);res.end();return true;}
  if(!file.startsWith(publicRoot+path.sep)){res.writeHead(404);res.end();return true;}
  let bytes=await readFile(file);const ext=path.extname(file);
  if(ext==='.html'){
   bytes=Buffer.from(bytes.toString().replace('<head>','<head><meta name="api-base" content="'+mount+'/api/">').replace('<div id="view">','<a class="projects-home" href="/" target="_top">← Projects</a><div id="view">'));
  }
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'}[ext]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type,'Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"});res.end(req.method==='HEAD'?undefined:bytes);return true;
 }
 return {handle,close(){stopping=true;clearInterval(queueTimer);clearInterval(backupTimer);if(!schedulerState.running)sqlite.close();else{const wait=setInterval(()=>{if(!schedulerState.running){clearInterval(wait);sqlite.close();}},100);wait.unref();}},dataDir};
}
