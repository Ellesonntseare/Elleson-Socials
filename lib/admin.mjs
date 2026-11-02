import {provincePack} from './province-pack.mjs';

// Email is used only once to bind the verified Site owner to a stable Site user ID.
// Subsequent requests authorize against the persisted ID, even if email changes.
export async function adminIdentity(db,id,email,bootstrapEmail){
 if(bootstrapEmail&&email.toLowerCase()===bootstrapEmail.toLowerCase())
  await db.prepare('INSERT INTO app_admins (slot, user_id, seeded, created_at) VALUES (?, ?, 0, ?) ON CONFLICT(slot) DO NOTHING').bind('owner',id,new Date().toISOString()).run();
 const row=await db.prepare('SELECT user_id, seeded FROM app_admins WHERE slot = ?').bind('owner').first();
 return row?.user_id===id?row:null;
}
export async function seedProvincePack(db,ws){
 const now=new Date().toISOString();
 for(let start=0;start<provincePack.length;start+=10){
  const statements=[];
  for(const p of provincePack.slice(start,start+10)){
   const data={id:p.id,title:p.title,caption:p.caption,board:'',targets:[{id:'facebook',format:'Image',options:{}}],mediaIds:[p.mediaId],assetIds:[p.mediaId],mediaDetails:{},status:'draft',plannedAt:null,timezone:'Africa/Johannesburg',updatedAt:now};
   statements.push(db.prepare('INSERT INTO media (workspace_id, id, name, type, size, object_key, metadata, created_at, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0) ON CONFLICT(workspace_id, id) DO NOTHING').bind(ws.id,p.mediaId,`${String(p.number).padStart(2,'0')} - ${p.title}.png`,'image/png',p.size,p.path,JSON.stringify({width:p.width,height:p.height,collection:'South Africa by Province',postNumber:p.number,sourceURL:p.sourceURL,reportingPeriod:p.reportingPeriod}),now));
   statements.push(db.prepare('INSERT INTO posts (workspace_id, id, document, version, deleted, updated_at) VALUES (?, ?, ?, 1, 0, ?) ON CONFLICT(workspace_id, id) DO NOTHING').bind(ws.id,p.id,JSON.stringify(data),now));
  }
  await db.batch(statements);
 }
 await db.prepare('UPDATE app_admins SET seeded = 1 WHERE slot = ?').bind('owner').run();
}
export function bundledMediaPath(item){
 return provincePack.some(p=>p.mediaId===item.id&&p.path===item.object_key)?item.object_key:null;
}
