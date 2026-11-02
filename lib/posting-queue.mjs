import {publishingAPI,reviewedDraft,PublishError} from './facebook-publish.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const validId=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/i.test(id);
const changed='This queue changed on another device. Refresh it before trying again.';
async function bodyJSON(request){
 const reader=request.body?.getReader();if(!reader)throw new PublishError(400,'Choose the posts to update.');let size=0,text='',decoder=new TextDecoder();
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();throw new PublishError(413,'Choose up to 100 posts at once.');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
 try{return JSON.parse(text);}catch{throw new PublishError(400,'Invalid queue request.');}
}
export function noticeStatement(env,workspaceId,kind,title,message,entityId){return env.DB.prepare('INSERT INTO notices (id, workspace_id, kind, title, message, entity_id, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)').bind(crypto.randomUUID(),workspaceId,kind,title,message,entityId,new Date().toISOString());}
async function availablePage(env,ws,accountId){
 const account=await env.DB.prepare("SELECT id, name, status, expires_at FROM social_accounts WHERE workspace_id = ? AND id = ? AND provider = 'facebook'").bind(ws.id,accountId).first();
 if(!account||account.status!=='connected'||account.expires_at&&account.expires_at<=Date.now())throw new PublishError(409,'Connect an available Facebook Page first.');return account;
}
export async function queueAPI(request,env,ws){
 const path=new URL(request.url).pathname.split('/').filter(Boolean).slice(2);
 try{
  if(path[0]==='notices'){
   if(request.method==='GET'){const rows=await env.DB.prepare('SELECT * FROM notices WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 100').bind(ws.id).all();return json(rows.results.map(r=>({id:r.id,kind:r.kind,title:r.title,message:r.message,entityId:r.entity_id,read:Boolean(r.read),createdAt:r.created_at})));}
   if(request.method==='POST'){await env.DB.prepare('UPDATE notices SET read = 1 WHERE workspace_id = ? AND read = 0').bind(ws.id).run();return json({read:true});}
  }
  if(request.method==='GET'){
   const jobs=await env.DB.prepare('SELECT j.*, a.name AS page_name, p.document FROM scheduled_jobs j LEFT JOIN social_accounts a ON a.workspace_id = j.workspace_id AND a.id = j.account_id LEFT JOIN posts p ON p.workspace_id = j.workspace_id AND p.id = j.post_id WHERE j.workspace_id = ? ORDER BY j.scheduled_at, j.created_at').bind(ws.id).all();
   const published=await env.DB.prepare("SELECT p.*, a.name AS page_name FROM publishing p LEFT JOIN social_accounts a ON a.id = p.account_id AND a.workspace_id = p.workspace_id WHERE p.workspace_id = ? ORDER BY p.updated_at DESC LIMIT 200").bind(ws.id).all();
   return json({scheduler:{enabled:!!env.SCHEDULER_ENABLED,online:!!env.schedulerState?.lastTick&&Date.now()-env.schedulerState.lastTick<60000,lastCheck:env.schedulerState?.lastTick||null},jobs:jobs.results.map(r=>({id:r.id,postId:r.post_id,accountId:r.account_id,pageName:r.page_name||'Disconnected Page',title:r.document?JSON.parse(r.document).title:'Deleted post',scheduledAt:r.scheduled_at,status:r.status,revision:r.revision,error:r.error,updatedAt:r.updated_at})),receipts:published.results.map(r=>({postId:r.post_id,accountId:r.account_id,pageName:r.page_name,status:r.status,remoteId:r.remote_id,error:r.error,updatedAt:r.updated_at,url:r.remote_id&&/^\d+(?:_\d+)?$/.test(r.remote_id)?'https://www.facebook.com/'+r.remote_id:null}))});
  }
  if(request.method!=='POST')throw new PublishError(405,'Unsupported queue action.');
  const data=await bodyJSON(request);const now=new Date().toISOString();
  if(!path.length){
   if(!env.SCHEDULER_ENABLED)throw new PublishError(503,'Automatic publishing is available through your Connect server.');
   if(data?.confirm!==true||!validId(data.accountId)||!Array.isArray(data.posts)||!data.posts.length||data.posts.length>100)throw new PublishError(400,'Review and confirm up to 100 posts for one Page.');
   await availablePage(env,ws,data.accountId);const seen=new Set(),checked=[];
   for(const item of data.posts){
    if(!validId(item?.id)||seen.has(item.id)||!Number.isInteger(item.version)||typeof item.scheduledAt!=='string'||!Number.isFinite(Date.parse(item.scheduledAt))||Date.parse(item.scheduledAt)<Date.now()+60000)throw new PublishError(400,'Choose unique posts and times at least one minute in the future.');seen.add(item.id);
    const content=await reviewedDraft(env,ws,item.id);if(content.row.version!==item.version)throw new PublishError(409,'A draft changed. Refresh and review the latest version.');if(content.errors.length)throw new PublishError(400,(content.post.title||'Post')+': '+content.errors.join(' '));
    const receipt=await env.DB.prepare('SELECT status FROM publishing WHERE workspace_id = ? AND post_id = ? AND account_id = ?').bind(ws.id,item.id,data.accountId).first();if(receipt&&receipt.status!=='failed')throw new PublishError(409,'A selected post has already been sent or needs checking on Facebook.');
    const job=await env.DB.prepare('SELECT status, revision FROM scheduled_jobs WHERE workspace_id = ? AND post_id = ? AND account_id = ?').bind(ws.id,item.id,data.accountId).first();if(job&&!['cancelled','failed'].includes(job.status))throw new PublishError(409,'A selected post is already in the queue. Move or cancel its existing job.');
    checked.push({item,job});
   }
   // Each create/review is protected by source and queue revisions. Batches are
   // committed together; source guards also cover a concurrent edit during review.
   const guard=JSON.stringify(checked.map(({item})=>({id:item.id,version:item.version})));
   const postGuard='NOT EXISTS (SELECT 1 FROM json_each(?) x LEFT JOIN posts p ON p.workspace_id = ? AND p.id = json_extract(x.value,\'$.id\') AND p.version = json_extract(x.value,\'$.version\') AND p.deleted = 0 WHERE p.id IS NULL)';
   const statements=checked.map(({item})=>env.DB.prepare(`INSERT INTO scheduled_jobs (id, workspace_id, post_id, account_id, post_version, scheduled_at, status, revision, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, 'scheduled', 1, ?, ? WHERE ${postGuard} ON CONFLICT(workspace_id, post_id, account_id) DO UPDATE SET post_version = excluded.post_version, scheduled_at = excluded.scheduled_at, status = 'scheduled', revision = scheduled_jobs.revision + 1, error = NULL, updated_at = excluded.updated_at WHERE scheduled_jobs.status IN ('failed', 'cancelled')`).bind(crypto.randomUUID(),ws.id,item.id,data.accountId,item.version,new Date(item.scheduledAt).toISOString(),now,now,guard,ws.id));
   const results=await env.DB.batch(statements);const count=results.filter(r=>r.meta.changes).length;
   if(count!==checked.length)throw new PublishError(409,`${count} jobs saved. ${changed}`);
   await noticeStatement(env,ws.id,'scheduled','Posts scheduled',`${count} posts added to the publishing queue.`,data.accountId).run();return json({scheduled:count});
  }
  const action=path[0];if(!['pause','resume','cancel','move','retry'].includes(action)||!Array.isArray(data?.jobs)||!data.jobs.length||data.jobs.length>100)throw new PublishError(400,'Choose a queue action and up to 100 jobs.');
  const ids=new Set();for(const job of data.jobs){if(!validId(job?.id)||ids.has(job.id)||!Number.isInteger(job.revision))throw new PublishError(400,'Choose valid queue jobs.');ids.add(job.id);}
  const selected=[];
  for(const item of data.jobs){const row=await env.DB.prepare('SELECT * FROM scheduled_jobs WHERE workspace_id = ? AND id = ?').bind(ws.id,item.id).first();if(!row||row.revision!==item.revision)throw new PublishError(409,changed);selected.push({row,item});}
  const allowed={pause:['scheduled'],resume:['paused'],cancel:['scheduled','paused','failed'],move:['scheduled','paused'],retry:['failed']}[action];
  for(const {row,item} of selected){
   if(!allowed.includes(row.status))throw new PublishError(409,'A selected job cannot be changed while it is sending or after it was published.');
   if(['resume','retry'].includes(action)&&Date.parse(row.scheduled_at)<Date.now()+60000)throw new PublishError(400,'Move this job to a future time before resuming it.');
   if(action==='move'&&(!Number.isFinite(Date.parse(item.scheduledAt))||Date.parse(item.scheduledAt)<Date.now()+60000))throw new PublishError(400,'Choose future times for all selected jobs.');
   if(['resume','retry'].includes(action)){await availablePage(env,ws,row.account_id);const content=await reviewedDraft(env,ws,row.post_id);if(content.row.version!==row.post_version)throw new PublishError(409,'A queued draft changed. Cancel its job and review the new draft before scheduling it again.');if(content.errors.length)throw new PublishError(400,content.errors.join(' '));const sent=await env.DB.prepare('SELECT status FROM publishing WHERE workspace_id = ? AND post_id = ? AND account_id = ?').bind(ws.id,row.post_id,row.account_id).first();if(sent&&sent.status!=='failed')throw new PublishError(409,'Check this post on Facebook before trying again.');}
  }
  const changes=JSON.stringify(data.jobs.map(j=>({...j,scheduledAt:j.scheduledAt?new Date(j.scheduledAt).toISOString():null})));
  const status=action==='pause'?'paused':action==='cancel'?'cancelled':action==='move'?null:'scheduled';
  const result=await env.DB.prepare(`UPDATE scheduled_jobs SET status = coalesce(?, status), scheduled_at = CASE WHEN ? = 'move' THEN (SELECT json_extract(x.value,'$.scheduledAt') FROM json_each(?) x WHERE json_extract(x.value,'$.id') = scheduled_jobs.id) ELSE scheduled_at END, revision = revision + 1, error = NULL, updated_at = ? WHERE workspace_id = ? AND id IN (SELECT json_extract(value,'$.id') FROM json_each(?)) AND NOT EXISTS (SELECT 1 FROM json_each(?) x LEFT JOIN scheduled_jobs j ON j.workspace_id = ? AND j.id = json_extract(x.value,'$.id') AND j.revision = json_extract(x.value,'$.revision') WHERE j.id IS NULL)`).bind(status,action,changes,now,ws.id,changes,changes,ws.id).run();
  if(result.meta.changes!==selected.length)throw new PublishError(409,changed);return json({updated:result.meta.changes});
 }catch(error){if(error instanceof PublishError)return json({error:error.message},error.status);console.error('Queue action failed',error?.name);return json({error:'The queue could not be updated. Refresh before trying again.'},500);}
}
export async function recoverScheduledJobs(env){
 const rows=await env.DB.prepare("SELECT * FROM scheduled_jobs WHERE status = 'running'").bind().all();
 for(const row of rows.results){const sent=await env.DB.prepare('SELECT status FROM publishing WHERE workspace_id = ? AND post_id = ? AND account_id = ?').bind(row.workspace_id,row.post_id,row.account_id).first();const posted=sent?.status==='posted';const error=posted?null:'The server restarted during this job. Check the Page before retrying.';await env.DB.prepare('UPDATE scheduled_jobs SET status = ?, error = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND status = ?').bind(posted?'posted':'failed',error,new Date().toISOString(),row.id,'running').run();}
}
export async function runScheduledJobs(env,{fetcher=fetch,now=Date.now()}={}){
 const due=await env.DB.prepare("SELECT * FROM scheduled_jobs WHERE status = 'scheduled' AND scheduled_at <= ? ORDER BY scheduled_at LIMIT 10").bind(new Date(now).toISOString()).all();let count=0;
 for(const job of due.results){
  if(env.schedulerState)env.schedulerState.lastTick=Date.now();
  const claim=await env.DB.prepare("UPDATE scheduled_jobs SET status = 'running', revision = revision + 1, updated_at = ? WHERE id = ? AND status = 'scheduled' AND revision = ?").bind(new Date().toISOString(),job.id,job.revision).run();if(!claim.meta.changes)continue;
  let result,error;
  if(now-Date.parse(job.scheduled_at)>15*60000)error='This job missed its time while the server was offline. Move it to a future time and review it.';
  else try{const response=await publishingAPI(new Request('https://scheduler.internal/api/publishing/'+job.post_id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:job.post_version,accountId:job.account_id,confirm:true})}),env,{id:job.workspace_id},{fetcher});result=await response.json();if(!response.ok)error=result.error||'Publishing failed.';}catch{error='Publishing was interrupted. Check the Page before trying again.';}
  const success=!error&&result?.status==='posted';
  await env.DB.batch([
   env.DB.prepare('UPDATE scheduled_jobs SET status = ?, error = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND status = ?').bind(success?'posted':'failed',error||null,new Date().toISOString(),job.id,'running'),
   ...(!success?[noticeStatement(env,job.workspace_id,'attention','A post needs attention',error,job.post_id)]:[])
  ]);count++;
 }
 return count;
}
