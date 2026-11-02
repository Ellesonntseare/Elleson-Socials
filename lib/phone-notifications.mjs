import {seal,unseal,digest} from './token-vault.mjs';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export function validSubscription(data){
 try{const url=new URL(data?.endpoint);if(url.protocol!=='https:'||url.port&&url.port!=='443'||url.username||url.password||url.hash||url.href.length>2048)return false;
 if(!['fcm.googleapis.com','web.push.apple.com'].includes(url.hostname)&&!/(^|\.)push\.services\.mozilla\.com$/.test(url.hostname)&&!/(^|\.)notify\.windows\.com$/.test(url.hostname))return false;
 return typeof data.keys?.p256dh==='string'&&/^[\w-]{87}$/.test(data.keys.p256dh)&&typeof data.keys?.auth==='string'&&/^[\w-]{22}$/.test(data.keys.auth);
 }catch{return false;}
}
export async function phoneNotificationsAPI(request,env,ws){
 const path=new URL(request.url).pathname.split('/').filter(Boolean).slice(2);
 if(request.method==='GET')return json({available:!!env.pushSender&&!!env.PUSH_PUBLIC_KEY,publicKey:env.PUSH_PUBLIC_KEY||null});
 if(!env.pushSender||!env.PUSH_PUBLIC_KEY)return json({error:'Phone notifications are unavailable on this server.'},503);
 const reader=request.body?.getReader();let size=0,text='';if(!reader)return json({error:'Choose this device first.'},400);try{const decoder=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return json({error:'Notification settings are too large.'},413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}
 let data;try{data=JSON.parse(text);}catch{return json({error:'Invalid notification settings.'},400);}
 if(!validSubscription(data))return json({error:'This browser did not supply a supported notification address.'},400);
 const id=await digest(data.endpoint),now=new Date().toISOString();
 if(request.method==='POST'&&path[0]==='status'){const owned=await env.DB.prepare('SELECT id FROM push_subscriptions WHERE workspace_id = ? AND id = ?').bind(ws.id,id).first();return json({enabled:!!owned});}
 if(request.method==='DELETE'){await env.DB.prepare('DELETE FROM push_subscriptions WHERE workspace_id = ? AND id = ?').bind(ws.id,id).run();return json({enabled:false});}
 if(request.method==='POST'&&path[0]==='test'){
  const owned=await env.DB.prepare('SELECT id FROM push_subscriptions WHERE workspace_id = ? AND id = ?').bind(ws.id,id).first();if(!owned)return json({error:'Enable phone notifications on this device first.'},404);
  await env.DB.prepare('INSERT INTO notices (id, workspace_id, kind, title, message, entity_id, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)').bind(crypto.randomUUID(),ws.id,'push-test','Phone notifications are ready','Tap to open your posting results.',id,now).run();return json({queued:true});
 }
 if(request.method!=='POST'||path.length)return json({error:'Unsupported notification action.'},405);
 const encrypted=await seal({endpoint:data.endpoint,keys:data.keys},env.SOCIAL_TOKEN_KEY,'push:'+ws.id+':'+id);
 // One browser subscription belongs to one signed-in account at a time.
 const previous=await env.DB.prepare('SELECT workspace_id FROM push_subscriptions WHERE id = ?').bind(id).first();
 if(!previous){const count=await env.DB.prepare('SELECT count(*) AS total FROM push_subscriptions WHERE workspace_id = ?').bind(ws.id).first();if(count.total>=20)return json({error:'Turn off notifications on an older device before adding another.'},409);}
 if(previous&&previous.workspace_id!==ws.id)await env.DB.prepare('DELETE FROM push_deliveries WHERE subscription_id = ?').bind(id).run();
 await env.DB.prepare('INSERT INTO push_subscriptions (id, workspace_id, subscription, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET workspace_id = excluded.workspace_id, subscription = excluded.subscription, created_at = CASE WHEN push_subscriptions.workspace_id = excluded.workspace_id THEN push_subscriptions.created_at ELSE excluded.created_at END, updated_at = excluded.updated_at').bind(id,ws.id,encrypted,now,now).run();return json({enabled:true});
}
export async function deliverPhoneNotifications(env,{now=Date.now()}={}){
 if(!env.pushSender)return 0;const timestamp=new Date(now).toISOString(),oldest=new Date(now-24*3600000).toISOString();
 // Only recent results created after opt-in; old account history is never replayed.
 const pending=await env.DB.prepare("SELECT s.id AS subscription_id, s.workspace_id, s.subscription, n.id AS notice_id, n.kind, n.title, n.message, n.entity_id, d.attempts FROM push_subscriptions s JOIN notices n ON n.workspace_id = s.workspace_id AND n.created_at >= s.created_at AND n.created_at >= ? LEFT JOIN push_deliveries d ON d.subscription_id = s.id AND d.notice_id = n.id WHERE n.kind IN ('published','attention','push-test') AND (d.notice_id IS NULL OR d.status = 'retry' AND d.next_attempt <= ?) ORDER BY n.created_at LIMIT 10").bind(oldest,timestamp).all();let count=0;
 for(const row of pending.results){
  const claim=await env.DB.prepare("INSERT INTO push_deliveries (subscription_id, notice_id, status, attempts, next_attempt, updated_at) VALUES (?, ?, 'sending', 1, ?, ?) ON CONFLICT(subscription_id, notice_id) DO UPDATE SET status = 'sending', attempts = push_deliveries.attempts + 1, updated_at = excluded.updated_at WHERE push_deliveries.status = 'retry' AND push_deliveries.next_attempt <= excluded.updated_at").bind(row.subscription_id,row.notice_id,timestamp,timestamp).run();if(!claim.meta.changes)continue;
  try{const subscription=await unseal(row.subscription,env.SOCIAL_TOKEN_KEY,'push:'+row.workspace_id+':'+row.subscription_id);if(!validSubscription(subscription))throw Error('Invalid subscription');
   const owner=await env.DB.prepare('SELECT workspace_id FROM push_subscriptions WHERE id = ?').bind(row.subscription_id).first();if(owner?.workspace_id!==row.workspace_id)continue;
   await env.pushSender(subscription,JSON.stringify({id:row.notice_id,title:row.title,body:row.message,postId:row.entity_id||null}));
   await env.DB.prepare("UPDATE push_deliveries SET status = 'accepted', updated_at = ? WHERE subscription_id = ? AND notice_id = ?").bind(timestamp,row.subscription_id,row.notice_id).run();
  }catch(error){if([404,410].includes(error.statusCode))await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(row.subscription_id).run();
   const attempts=(row.attempts||0)+1;await env.DB.prepare('UPDATE push_deliveries SET status = ?, next_attempt = ?, updated_at = ? WHERE subscription_id = ? AND notice_id = ?').bind(attempts>=3?'failed':'retry',new Date(now+attempts*60000).toISOString(),timestamp,row.subscription_id,row.notice_id).run();
  }count++;
 }return count;
}
