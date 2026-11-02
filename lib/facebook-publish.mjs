import {unseal} from './token-vault.mjs';
import {bundledMediaPath} from './admin.mjs';
export class PublishError extends Error{constructor(status,message){super(message);this.status=status;}}
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function draft(env,ws,id){
 const row=await env.DB.prepare('SELECT document, version FROM posts WHERE workspace_id = ? AND id = ? AND deleted = 0').bind(ws.id,id).first();if(!row)throw new PublishError(404,'Draft not found.');
 const post=JSON.parse(row.document),target=post.targets.find(t=>t.id==='facebook');if(!target)throw new PublishError(400,'Choose Facebook in this post first.');
 const errors=[];
 if(!['Text','Image'].includes(target.format))errors.push('Direct publishing supports text and one image for now.');
 if(target.format==='Image'&&post.mediaIds.length!==1||target.format==='Text'&&post.mediaIds.length)errors.push('Use one image for an image post, or no files for a text post.');
 const caption=target.caption??post.caption;if(!caption.trim()&&!post.mediaIds.length)errors.push('Add a caption or image.');if([...caption].length>16192)errors.push('Shorten the Facebook caption.');
 if(target.options?.firstComment||target.options?.location)errors.push('Remove the first comment or location before direct publishing. You can add these on Facebook.');
 let file=null;if(post.mediaIds[0]){file=await env.DB.prepare('SELECT * FROM media WHERE workspace_id = ? AND id = ? AND deleted = 0').bind(ws.id,post.mediaIds[0]).first();if(!file||!['image/png','image/jpeg'].includes(file.type))errors.push('Use a saved PNG or JPEG image.');}
 return {row,post,target,caption,file,errors};
}
const receipt=row=>({id:row.id,postId:row.post_id,accountId:row.account_id,status:row.status,remoteId:row.remote_id,error:row.error,updatedAt:row.updated_at,url:row.remote_id&&/^\d+(?:_\d+)?$/.test(row.remote_id)?'https://www.facebook.com/'+row.remote_id:null});
export async function publishingAPI(request,env,ws,{fetcher=fetch}={}){
 const url=new URL(request.url),parts=url.pathname.split('/').filter(Boolean).slice(2);
 try{
  if(request.method==='GET'&&!parts.length){const rows=await env.DB.prepare('SELECT * FROM publishing WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 100').bind(ws.id).all();return json(rows.results.map(receipt));}
  const id=parts[0];if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new PublishError(404,'Draft not found.');
  const content=await draft(env,ws,id);
  if(request.method==='GET'){
   const accounts=await env.DB.prepare("SELECT id, name, expires_at, status FROM social_accounts WHERE workspace_id = ? AND provider = 'facebook' ORDER BY name").bind(ws.id).all();
   const rows=await env.DB.prepare('SELECT * FROM publishing WHERE workspace_id = ? AND post_id = ?').bind(ws.id,id).all();
   return json({postId:id,version:content.row.version,title:content.post.title,caption:content.caption,mediaId:content.file?.id||null,format:content.target.format,errors:content.errors,accounts:accounts.results.map(a=>({...a,available:a.status==='connected'&&(!a.expires_at||a.expires_at>Date.now())})),receipts:rows.results.map(receipt)});
  }
  if(request.method!=='POST'||parts.length!==1)throw new PublishError(405,'Unsupported publishing action.');
  if(content.errors.length)throw new PublishError(400,content.errors.join(' '));
  if(Number(request.headers.get('content-length'))>1024)throw new PublishError(413,'Invalid publishing request.');
  const reader=request.body?.getReader();if(!reader)throw new PublishError(400,'Invalid publishing request.');let text='',size=0;const decoder=new TextDecoder();try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();throw new PublishError(413,'Invalid publishing request.');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}let body;try{body=JSON.parse(text);}catch{throw new PublishError(400,'Invalid publishing request.');}
  if(!body||body.confirm!==true||body.version!==content.row.version)throw new PublishError(409,'This draft changed. Review the latest version before publishing.');
  const account=await env.DB.prepare("SELECT * FROM social_accounts WHERE workspace_id = ? AND id = ? AND provider = 'facebook'").bind(ws.id,body.accountId||'').first();
  if(!account||account.status!=='connected'||account.expires_at&&account.expires_at<Date.now())throw new PublishError(409,'Connect an available Facebook Page first.');
  if(!/^\d+$/.test(account.remote_id))throw new PublishError(400,'The connected Page ID is invalid.');
  const app=await env.DB.prepare("SELECT api_version FROM social_apps WHERE provider = 'meta'").bind().first();if(!app||!/^v\d+\.\d+$/.test(app.api_version))throw new PublishError(503,'Finish the Facebook app setup first.');
  const token=await unseal(account.token,env.SOCIAL_TOKEN_KEY,'account:'+ws.id+':facebook:'+account.remote_id);
  // Resolve private image bytes before reserving the send. Never expose a signed
  // or public media URL to make a private image available to Facebook.
  let image=null;
  if(content.file){
   const bundled=bundledMediaPath(content.file);
   if(bundled){if(env.readBundledMedia)image=await env.readBundledMedia(bundled);else if(env.ASSETS){const r=await env.ASSETS.fetch(new Request(new URL(bundled,request.url)));if(r.ok)image=new Uint8Array(await r.arrayBuffer());}}
   else {const object=await env.BUCKET.get(content.file.object_key);if(object)image=new Uint8Array(await new Response(object.body).arrayBuffer());}
   if(!image?.length||image.length>25*1024*1024)throw new PublishError(409,'The image could not be read. Your post has not been sent.');
  }
  const attempt=crypto.randomUUID(),now=new Date().toISOString();
  const reservation=await env.DB.prepare("INSERT INTO publishing (id, workspace_id, post_id, account_id, post_version, status, created_at, updated_at) SELECT ?, ?, ?, ?, ?, 'sending', ?, ? WHERE EXISTS (SELECT 1 FROM posts WHERE workspace_id = ? AND id = ? AND version = ? AND deleted = 0) ON CONFLICT(workspace_id, post_id, account_id) DO UPDATE SET status = 'sending', post_version = excluded.post_version, error = NULL, updated_at = excluded.updated_at WHERE publishing.status = 'failed'").bind(attempt,ws.id,id,account.id,content.row.version,now,now,ws.id,id,content.row.version).run();
  if(!reservation.meta.changes){const existing=await env.DB.prepare('SELECT * FROM publishing WHERE workspace_id = ? AND post_id = ? AND account_id = ?').bind(ws.id,id,account.id).first();if(existing?.status==='posted')return json(receipt(existing));throw new PublishError(409,'This post is already sending or needs checking on Facebook. It has not been sent again.');}
  const endpoint='https://graph.facebook.com/'+app.api_version+'/'+account.remote_id+(image?'/photos':'/feed');
  let payload;if(image){payload=new FormData();payload.set('source',new Blob([image],{type:content.file.type}),content.file.name);payload.set('caption',content.caption);payload.set('published','true');}else payload=new URLSearchParams({message:content.caption});
  let response,data;
  try{response=await fetcher(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token.access_token},body:payload,redirect:'error',signal:AbortSignal.timeout(60000)});data=await response.json();}
  catch{await env.DB.prepare("UPDATE publishing SET status = 'unknown', error = ?, updated_at = ? WHERE workspace_id = ? AND post_id = ? AND account_id = ?").bind('Check your Page before trying again. Facebook may have received the post.',new Date().toISOString(),ws.id,id,account.id).run();throw new PublishError(502,'Facebook did not return a clear result. Check your Page; automatic retry is paused to avoid duplicates.');}
  if(!response.ok||data.error){
   // Explicit provider rejection is safe to retry after the user fixes access.
   const ambiguous=response.status>=500;
   const message=ambiguous?'Check your Page before trying again.':'Facebook rejected the post. Check Page access and app permissions.';
   await env.DB.prepare('UPDATE publishing SET status = ?, error = ?, updated_at = ? WHERE workspace_id = ? AND post_id = ? AND account_id = ?').bind(ambiguous?'unknown':'failed',message,new Date().toISOString(),ws.id,id,account.id).run();
   throw new PublishError(502,message);
  }
  const remoteId=String(data.post_id||data.id||'');
  if(!/^\d+(?:_\d+)?$/.test(remoteId)){await env.DB.prepare("UPDATE publishing SET status = 'unknown', error = ?, updated_at = ? WHERE workspace_id = ? AND post_id = ? AND account_id = ?").bind('Facebook did not return a post reference.',new Date().toISOString(),ws.id,id,account.id).run();throw new PublishError(502,'Check your Facebook Page. The response did not include a usable post reference.');}
  await env.DB.batch([
   env.DB.prepare("UPDATE publishing SET status = 'posted', remote_id = ?, error = NULL, updated_at = ? WHERE workspace_id = ? AND post_id = ? AND account_id = ?").bind(remoteId,new Date().toISOString(),ws.id,id,account.id),
   env.DB.prepare('INSERT INTO account_activity (id, workspace_id, event, entity_id, label, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(),ws.id,'post.published',id,'Published to '+account.name,new Date().toISOString())
  ]);
  return json(receipt(await env.DB.prepare('SELECT * FROM publishing WHERE workspace_id = ? AND post_id = ? AND account_id = ?').bind(ws.id,id,account.id).first()));
 }catch(error){if(error instanceof PublishError)return json({error:error.message},error.status);console.error('Facebook publish failed',error?.name);return json({error:'Publishing could not finish. Check your Page before retrying.'},500);}
}
