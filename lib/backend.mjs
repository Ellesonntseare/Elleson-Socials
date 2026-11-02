import {validatePost,platforms} from '../public/planner/platforms.js';
const JSON_LIMIT=128*1024,MEDIA_LIMIT=25*1024*1024;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class APIError extends Error{constructor(status,message){super(message);this.status=status;}}
function json(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export async function readLimited(request,limit){
 if(Number(request.headers.get('content-length'))>limit)throw new APIError(413,'Upload exceeds the allowed size. Cloud files are limited to 25 MB.');
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new APIError(413,'Upload exceeds the allowed size.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}return bytes;
}
export function assertWriteOrigin(request){
 if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==new URL(request.url).origin)throw new APIError(403,'Open the workspace in the signed-in browser to save changes.');
}
export function cleanPost(input,id){
 if(!input||typeof input!=='object'||input.id!==id||!uuid.test(id))throw new APIError(400,'Invalid post ID.');
 if(typeof input.caption!=='string'||input.caption.length>100000||typeof input.title!=='string'||input.title.length>300||typeof input.board!=='string'||input.board.length>500)throw new APIError(400,'Invalid caption, title or board.');
 if(!['draft','planned'].includes(input.status)||!Array.isArray(input.targets)||input.targets.length>10||!Array.isArray(input.mediaIds)||input.mediaIds.length>35||input.mediaIds.some(id=>typeof id!=='string'||!uuid.test(id)))throw new APIError(400,'Invalid post content.');
 const seen=new Set();const targets=input.targets.map(t=>{
  const p=platforms.find(p=>p.id===t?.id);if(!p||!p.formats.includes(t.format)||seen.has(t.id)||t.caption!==undefined&&(typeof t.caption!=='string'||t.caption.length>100000))throw new APIError(400,'Invalid channel options.');seen.add(t.id);return {id:t.id,format:t.format,...(t.caption!==undefined?{caption:t.caption}:{})};
 });
 if(input.plannedAt!==null&&(typeof input.plannedAt!=='string'||!Number.isFinite(Date.parse(input.plannedAt))))throw new APIError(400,'Invalid planned date.');
 if(typeof input.timezone!=='string'||input.timezone.length>100)throw new APIError(400,'Invalid timezone.');
 try{new Intl.DateTimeFormat('en',{timeZone:input.timezone});}catch{throw new APIError(400,'Choose a valid timezone.');}
 if(input.status==='planned'&&!input.plannedAt)throw new APIError(400,'Choose a planned date.');
 return {id,caption:input.caption,title:input.title,board:input.board,targets,mediaIds:[...new Set(input.mediaIds)],status:input.status,plannedAt:input.plannedAt,timezone:input.timezone,updatedAt:new Date().toISOString()};
}
export function checkedMediaType(bytes,claimed){
 const ascii=(start,end)=>new TextDecoder().decode(bytes.slice(start,end));
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
 if(bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10')return 'image/png';
 if(['GIF87a','GIF89a'].includes(ascii(0,6)))return 'image/gif';
 if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return 'image/webp';
 if(ascii(4,8)==='ftyp')return claimed==='video/quicktime'?'video/quicktime':'video/mp4';
 if(ascii(0,5)==='%PDF-')return 'application/pdf';
 if(bytes[0]===0x50&&bytes[1]===0x4b&&['application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(claimed))return claimed;
 if(bytes.slice(0,4).join(',')==='208,207,17,224'&&['application/msword','application/vnd.ms-powerpoint'].includes(claimed))return claimed;
 throw new APIError(415,'Use a JPEG, PNG, WebP, GIF, MP4/MOV, PDF or supported Office document. SVG and unsupported formats cannot be uploaded.');
}
async function workspace(db,user){
 await db.prepare('INSERT INTO workspaces (id, owner_id, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(owner_id) DO NOTHING').bind(crypto.randomUUID(),user.id,'My workspace',new Date().toISOString()).run();
 return await db.prepare('SELECT id, name FROM workspaces WHERE owner_id = ?').bind(user.id).first();
}
function postJSON(row){return {...JSON.parse(row.document),version:row.version};}
function mediaJSON(row){return {id:row.id,name:row.name,type:row.type,size:row.size,createdAt:row.created_at,...JSON.parse(row.metadata),url:`/api/media/${row.id}/file`};}
function version(request){const value=request.headers.get('if-match');if(!value||!/^\d+$/.test(value))throw new APIError(428,'Reload this post before saving.');return Number(value);}
export async function handleAPI(request,env){
 try{
  assertWriteOrigin(request);
  const id=request.headers.get('oai-authenticated-user-id'),email=request.headers.get('oai-authenticated-user-email');
  if(!id||!email)throw new APIError(401,'Sign in to open your cloud workspace.');
  if(!env.DB||!env.BUCKET)throw new APIError(503,'Cloud storage is not configured yet. Your device drafts are unchanged.');
  const ws=await workspace(env.DB,{id});const path=new URL(request.url).pathname.split('/').filter(Boolean).slice(1);
  if(path[0]==='session'&&request.method==='GET')return json({user:{email},workspace:ws,mediaLimit:MEDIA_LIMIT,mode:'cloud'});
  if(path[0]==='posts'){
   if(path.length===1&&request.method==='GET'){const result=await env.DB.prepare('SELECT document, version FROM posts WHERE workspace_id = ? AND deleted = 0 ORDER BY updated_at DESC').bind(ws.id).all();return json(result.results.map(postJSON));}
   const postId=path[1];if(!uuid.test(postId||'')||path.length!==2)throw new APIError(404,'Post not found.');
   if(request.method==='PUT'){
    const expected=version(request);let body;try{body=JSON.parse(new TextDecoder().decode(await readLimited(request,JSON_LIMIT)));}catch(error){if(error instanceof APIError)throw error;throw new APIError(400,'Invalid post JSON.');}
    const data=cleanPost(body,postId);const assets=[];
    for(const mediaId of data.mediaIds){const item=await env.DB.prepare('SELECT type FROM media WHERE workspace_id = ? AND id = ? AND deleted = 0').bind(ws.id,mediaId).first();if(!item)throw new APIError(400,'A media file is missing. Reload before saving.');assets.push(item);}
    if(data.status==='planned'){const errors=validatePost(data,assets);if(errors.length)throw new APIError(400,errors.join(' '));}
    else if(!data.caption.trim()&&!data.title.trim()&&!data.mediaIds.length)throw new APIError(400,'Add text or media to save a draft.');
    const mediaGuard='NOT EXISTS (SELECT 1 FROM json_each(?) AS wanted LEFT JOIN media ON media.workspace_id = ? AND media.id = wanted.value AND media.deleted = 0 WHERE media.id IS NULL)';
    const statement=expected===0?env.DB.prepare(`INSERT INTO posts (workspace_id, id, document, version, deleted, updated_at) SELECT ?, ?, ?, 1, 0, ? WHERE ${mediaGuard} ON CONFLICT(workspace_id, id) DO NOTHING`).bind(ws.id,postId,JSON.stringify(data),data.updatedAt,JSON.stringify(data.mediaIds),ws.id):env.DB.prepare(`UPDATE posts SET document = ?, version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ? AND version = ? AND deleted = 0 AND ${mediaGuard}`).bind(JSON.stringify(data),data.updatedAt,ws.id,postId,expected,JSON.stringify(data.mediaIds),ws.id);
    const result=await statement.run();if(!result.meta.changes)throw new APIError(409,'This post changed on another device. Keep your text, close the editor, refresh, and reopen the latest version.');return json({...data,version:expected+1});
   }
   if(request.method==='DELETE'){const expected=version(request);const result=await env.DB.prepare('UPDATE posts SET deleted = 1, version = version + 1, updated_at = ? WHERE workspace_id = ? AND id = ? AND version = ? AND deleted = 0').bind(new Date().toISOString(),ws.id,postId,expected).run();if(!result.meta.changes)throw new APIError(409,'This post changed on another device. Refresh before deleting.');return json({deleted:true});}
  }
  if(path[0]==='media'){
   if(path.length===1&&request.method==='GET'){const result=await env.DB.prepare('SELECT * FROM media WHERE workspace_id = ? AND deleted = 0 ORDER BY created_at DESC').bind(ws.id).all();return json(result.results.map(mediaJSON));}
   const mediaId=path[1];if(!uuid.test(mediaId||''))throw new APIError(404,'File not found.');
   if(path.length===2&&request.method==='PUT'){
    const exists=await env.DB.prepare('SELECT id FROM media WHERE workspace_id = ? AND id = ?').bind(ws.id,mediaId).first();if(exists)throw new APIError(409,'A media file with this ID already exists.');
    const bytes=await readLimited(request,MEDIA_LIMIT);if(!bytes.length)throw new APIError(400,'Choose a non-empty file.');const type=checkedMediaType(bytes,request.headers.get('content-type')||'');
    let name;try{name=decodeURIComponent(request.headers.get('x-media-name')||'Media');}catch{throw new APIError(400,'Invalid file name.');}name=name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,240)||'Media';
    const objectKey=`${ws.id}/${mediaId}/${crypto.randomUUID()}`;const createdAt=new Date().toISOString();await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType:type}});
    try{await env.DB.prepare('INSERT INTO media (workspace_id, id, name, type, size, object_key, metadata, created_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)').bind(ws.id,mediaId,name,type,bytes.byteLength,objectKey,'{}',createdAt).run();}catch(error){await env.BUCKET.delete(objectKey);throw error;}
    return json({id:mediaId,name,type,size:bytes.byteLength,createdAt,url:`/api/media/${mediaId}/file`},201);
   }
   const item=await env.DB.prepare('SELECT * FROM media WHERE workspace_id = ? AND id = ? AND deleted = 0').bind(ws.id,mediaId).first();if(!item)throw new APIError(404,'File not found.');
   if(path[2]==='file'&&path.length===3&&request.method==='GET'){
    const object=await env.BUCKET.get(item.object_key);if(!object)throw new APIError(404,'File not found.');const inline=/^(image\/(jpeg|png|gif|webp)|video\/(mp4|quicktime))$/.test(item.type);
    return new Response(object.body,{headers:{'Content-Type':item.type,'Content-Length':String(item.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(item.name)}`}});
   }
   if(path.length===2&&request.method==='DELETE'){
    const result=await env.DB.prepare("UPDATE media SET deleted = 1 WHERE workspace_id = ? AND id = ? AND deleted = 0 AND NOT EXISTS (SELECT 1 FROM posts, json_each(json_extract(posts.document, '$.mediaIds')) AS ref WHERE posts.workspace_id = media.workspace_id AND posts.deleted = 0 AND ref.value = media.id)").bind(ws.id,mediaId).run();
    if(!result.meta.changes)throw new APIError(409,'This file is attached to a post. Remove it from the post first.');return json({deleted:true});
   }
  }
  throw new APIError(404,'Endpoint not found.');
 }catch(error){if(error instanceof APIError)return json({error:error.message},error.status);console.error('Cloud API failed',error?.name);return json({error:'Cloud storage could not complete this request. Your editor content has been kept; please try again.'},500);}
}
