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
 const files=path.join(dataDir,'files');mkdirSync(files,{recursive:true});
 function objectPath(key){if(typeof key!=='string'||!/^[-a-z0-9/]{1,240}$/i.test(key)||key.includes('..'))throw Error('Invalid media key.');const target=path.resolve(files,key);if(!target.startsWith(files+path.sep))throw Error('Invalid media key.');return target;}
 const BUCKET={async put(key,bytes){const target=objectPath(key);mkdirSync(path.dirname(target),{recursive:true});const tmp=target+'.'+randomBytes(8).toString('hex')+'.tmp';await writeFile(tmp,bytes,{mode:0o600});await rename(tmp,target);},async get(key){const target=objectPath(key);try{await stat(target);return {body:Readable.toWeb(createReadStream(target))};}catch(error){if(error.code==='ENOENT')return null;throw error;}},async delete(){/* Retain private orphan objects for recovery; no destructive purge on app updates. */}};
 const publicRoot=realpathSync(path.join(root,'public'));
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
   const response=await handleAPI(request,{DB,BUCKET,SOCIAL_TOKEN_KEY:tokenKey,ADMIN_BOOTSTRAP_EMAIL:principal.admin?principal.email:undefined,API_PREFIX:mount+'/api',APP_PATH:mount+'/'});
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
 return {handle,close(){sqlite.close();},dataDir};
}
