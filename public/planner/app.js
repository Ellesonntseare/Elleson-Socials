import {openPostPreview} from './post-preview.js';
import {openSchedulePosts} from './schedule-posts.js';
import {showDrafts} from './draft-list.js';
import {Autosave} from './autosave.js';
import {showAccounts} from './accounts.js';
import {platforms,otherIntegrations,SOURCES,validatePost} from './platforms.js';
import {all,get,put,remove,storageState,ready,mediaBlob,copyDeviceWorkspace,apiBase,signInURL,signOutURL} from './storage.js';
import {renderAdmin,recoverPost} from './admin.js';
import {setupNavigation} from './navigation.js';
import {extrasHTML,previewHTML} from './composer-extras.js';
import {openMediaEditor} from './media-editor.js';
import {publicationStatus,openManualPublishing,asNewDraft} from './manual-publishing.js';
import {activityHTML,planningCSV} from './reports.js';
setupNavigation();
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let posts=[],media=[],page='planner',month=new Date(),calendarMode='month',editing=null,targets=[],selectedMedia=[],urls=[];
let saving=false;
let mediaDetails={},previewChannel=null,previewIndex=0;
const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;
const icon=p=>`<span class="platform-icon" style="--color:${p.color}">${esc(p.mark)}</span>`;
const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const localDate=d=>`${dateKey(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const readable=d=>new Date(d).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),4500);}
const autosave=new Autosave(async()=>{
 const status=posts.find(p=>p.id===editing)?.status==='planned'?'planned':'draft';
 const value=collectPost(status);
 const saved=await put('posts',value);editing=saved?.id||value.id;
 const index=posts.findIndex(p=>p.id===editing);const row=saved||value;if(index<0)posts.push(row);else posts[index]=row;
 $('#draft-count').textContent=posts.filter(p=>p.status==='draft').length;
},message=>{$('#save-note').textContent=message==='Saved'?(storageState.mode==='cloud'?'Saved online':'Saved on this device'):message;});
function fail(error){console.error(error);const message=error.message||'Could not save this change. Please try again.';if($('#composer').open)showErrors([message]);else toast(message);}
async function refresh(){posts=await all('posts');media=await all('media');$('#draft-count').textContent=posts.filter(p=>p.status==='draft').length;render();}
function header(title,description,action=true){return `<div class="page-head"><div><h1>${title}</h1><p>${description}</p></div>${action?'<button class="button primary" data-action="create"><span>＋</span> New post</button>':''}</div>`;}
function render(){
 urls.forEach(URL.revokeObjectURL);urls=[];
 page=location.hash.slice(1)||'planner';if(!['planner','drafts','library','channels','roadmap','storage','history','insights','admin'].includes(page))page='planner';
 document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===page));
 $('#breadcrumb').textContent={planner:'Schedule',drafts:'Drafts',library:'Files',channels:'Accounts',roadmap:'Updates',storage:'Settings',history:'Posted manually',insights:'Overview',admin:'Admin'}[page];
 if(page==='planner')renderPlanner();if(page==='drafts')renderDrafts();if(page==='library')renderLibrary();if(page==='channels')renderChannels();if(page==='roadmap'){location.hash='storage';return;}if(page==='storage')renderStorage();if(page==='history')renderHistory();if(page==='insights')renderOverview();if(page==='admin')renderAdmin($('#view')).catch(fail);
 if(storageState.mode==='cloud')$('.local-label').innerHTML='<i></i> Online account';
}
async function renderOverview(){
 const view=$('#view');view.innerHTML=activityHTML(posts,platforms);
 if(storageState.mode==='cloud')try{const rows=await (await import('./storage.js')).api('activity');if(page!=='insights')return;view.insertAdjacentHTML('beforeend','<h2>Activity</h2><div class="post-list">'+rows.map(r=>'<article class="post-row"><div class="post-summary"><h3>'+esc(r.label)+'</h3><p>'+esc(new Date(r.createdAt).toLocaleString())+'</p></div></article>').join('')+'</div>');}catch(error){toast(error.message);}
}
function renderStorage(){
 const cloud=storageState.mode==='cloud';
 const accountAction=cloud?`<button class="button secondary" data-action="refresh-cloud">Refresh posts</button> <a class="text-button" href="${esc(signOutURL)}" target="_top">${apiBase.startsWith('/socials/')?'Connect account':'Sign out'}</a>`:'<a class="button primary" href="https://elleson-socials.poeticbeech16.chatgpt.site/" target="_blank" rel="noopener">Sign in online ↗</a>';
 $('#view').innerHTML=header('Settings','',false)+`<div class="quick-actions"><a class="button secondary" href="#insights">Overview</a>${cloud&&storageState.session.user.role==='admin'?'<a class="button secondary" href="#admin">Admin</a>':''}</div><div class="roadmap"><article><h2>Account</h2><p>${cloud?esc(storageState.session.user.email):'Saved on this device'}</p>${accountAction}</article><article><h2>Backups</h2><button class="button secondary" data-action="export-workspace">Download backup</button> <button class="button secondary" data-action="import-workspace">Import backup</button>${cloud?'<p><a href="#admin">Post history ↗</a></p>':''}</article>${cloud?'<article><h2>Posts on this device</h2><button class="button secondary" data-action="copy-device">Copy to online account</button></article>':''}</div>`;
}
function plannerTabs(active){return '<div class="planner-tabs"><a href="#planner" class="'+(active==='planner'?'active':'')+'">Calendar</a><a href="#drafts" class="'+(active==='drafts'?'active':'')+'">Drafts ('+posts.filter(p=>p.status==='draft').length+')</a><a href="#history" class="'+(active==='history'?'active':'')+'">Posted</a></div>';}
function renderHistory(){const items=posts.filter(p=>publicationStatus(p)==='manual');$('#view').innerHTML=header('Shared posts','')+plannerTabs('history')+(items.length?'<div class="post-list">'+items.map(postRow).join('')+'</div>':'<div class="empty"><div class="empty-symbol">✓</div><h2>No shared posts yet</h2></div>');}

function renderPlanner(){
 const planned=posts.filter(p=>p.status==='planned');
 $('#view').innerHTML=header('Schedule','')+plannerTabs('planner')+`<section class="stats" aria-label="Workspace totals">${[['Dated posts',planned.length,'','▦'],['Drafts',posts.filter(p=>p.status==='draft').length,'','▤'],['Files',media.length,'','▧'],['Shared posts',posts.filter(p=>p.status==='manual').length,'','↗']].map(([label,n,detail,symbol])=>`<div class="stat"><div class="stat-label">${label}<span class="stat-symbol">${symbol}</span></div><strong>${n}</strong><small>${detail}</small></div>`).join('')}</section><section class="calendar-panel"><div class="calendar-toolbar"><div class="calendar-controls"><h2>${month.toLocaleString(undefined,{month:'long',year:'numeric'})}</h2><button class="icon-button" data-action="previous" aria-label="Previous month">‹</button><button class="icon-button" data-action="next" aria-label="Next month">›</button><button class="today-button" data-action="today">Today</button></div><div class="calendar-controls"><div class="segmented"><button data-action="month" class="${calendarMode==='month'?'active':''}">Month</button><button data-action="list" class="${calendarMode==='list'?'active':''}">List</button></div></div></div>${calendarMode==='month'?calendar():planned.length?`<div class="post-list" style="padding:15px">${planned.sort((a,b)=>a.plannedAt.localeCompare(b.plannedAt)).map(postRow).join('')}</div>`:'<div class="empty"><div class="empty-symbol">▦</div><h2>No posts with dates</h2><button class="button primary" data-action="create">New post</button></div>'}<div class="legend"><div><span><i></i> Planned</span><span><i class="sand"></i> Draft</span></div><span>${esc(tz)} · ${storageState.mode==='cloud'?'Online':'This device'}</span></div></section>`;
}
function calendar(){
 const first=new Date(month.getFullYear(),month.getMonth(),1),start=new Date(first);start.setDate(1-(first.getDay()+6)%7);
 const weeks=Math.ceil(((first.getDay()+6)%7+new Date(month.getFullYear(),month.getMonth()+1,0).getDate())/7);
 const today=dateKey(new Date());let cells='';
 for(let i=0;i<weeks*7;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKey(d);const matches=posts.filter(p=>p.plannedAt&&p.status==='planned'&&dateKey(new Date(p.plannedAt))===key);cells+=`<div class="calendar-day ${d.getMonth()!==month.getMonth()?'outside':''} ${key===today?'today':''} ${matches.length?'has-posts':'no-posts'}"><span class="day-label">${d.getDate()}</span><button class="add-day" data-date="${key}" aria-label="New post for ${key}">+</button><button class="day-post-count" data-open-day="${key}" aria-label="${key}: ${matches.length} planned posts">${matches.length?matches.length+(matches.length===1?' post':' posts'):'No posts'}</button>${matches.slice(0,2).map(p=>`<button class="post-chip ${p.status==='draft'?'draft':''}" data-edit="${esc(p.id)}" title="${esc(p.caption)}">${p.mediaIds[0]&&media.find(m=>m.id===p.mediaIds[0])?.type.startsWith('image/')?'<img class="calendar-thumb" src="'+mediaURL(media.find(m=>m.id===p.mediaIds[0]))+'" alt="">':''}<span>${esc(p.title||p.caption||'Post')}</span></button>`).join('')}${matches.length>2?`<button class="text-button" data-open-day="${key}" style="font-size:9px">+${matches.length-2} more</button>`:''}</div>`;}
 return `<div class="calendar-weekdays">${['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d=>`<span>${d}</span>`).join('')}</div><div class="calendar-grid">${cells}</div>`;
}
function postRow(p){return `<article class="post-row"><div>${icon(platforms.find(n=>n.id===p.targets[0]?.id)||platforms[0])}</div><div class="post-summary"><h3>${esc(p.title||p.caption||'Untitled draft')}</h3><p>${p.targets.map(t=>esc(platforms.find(n=>n.id===t.id)?.name||'')).join(' · ')}${p.plannedAt?' &nbsp; / &nbsp; '+esc(readable(p.plannedAt)):''} &nbsp; <span class="tag">${publicationStatus(p)==='manual'?'Posted manually':p.status==='planned'?'Planned':'Draft'}</span></p></div><button class="button secondary" data-preview-post="${esc(p.id)}">Preview</button><button class="button secondary" data-edit="${esc(p.id)}">Edit</button>${p.targets.length?`<button class="button secondary" data-handoff="${p.id}">Share manually ↗</button>`:''}<button class="icon-button" data-duplicate="${esc(p.id)}" aria-label="Duplicate post">⧉</button><button class="icon-button" data-delete="${esc(p.id)}" aria-label="Delete post">×</button></article>`;}
function schedulePosts(items){if(!items.length){toast('No drafts to schedule.');return;}openSchedulePosts(items,media,{save:p=>put('posts',p),done:async count=>{await refresh();toast(`${count} dates saved.`);}});}
function draftCard(p){const image=media.find(m=>m.id===p.mediaIds[0]),platform=platforms.find(n=>n.id===p.targets[0]?.id);return `<article class="draft-card"><button class="draft-card-cover" data-preview-post="${p.id}" aria-label="Preview ${esc(p.title||'post')}">${image?mediaVisual(image):'<div class="text-post-cover">'+esc(p.caption.slice(0,180))+'</div>'}<span class="card-preview-label">Preview ↗</span></button><div class="draft-card-content"><div class="draft-card-meta">${platform?icon(platform):''}<span>${esc(platform?.name||'Post')}</span><span class="tag">Draft</span></div><h2>${esc(p.title||p.caption.slice(0,90)||'Untitled draft')}</h2><p>${esc(p.caption)}</p>${p.collection?'<span class="collection-label">'+esc(p.collection)+'</span>':''}<div class="draft-card-actions"><button class="button secondary" data-edit="${p.id}">Edit</button><button class="button primary" data-schedule-post="${p.id}">Schedule</button><button class="icon-button" data-duplicate="${p.id}" aria-label="Copy post">⧉</button></div></div></article>`;}
function renderDrafts(){showDrafts({view:$('#view'),posts,media,postRow,card:draftCard,schedule:schedulePosts,tabs:plannerTabs('drafts'),save:p=>put('posts',p),refresh,toast});}
function mediaURL(m){if(storageState.mode==='cloud'&&m.url===`${apiBase}media/${m.id}/file`)return m.url;const url=URL.createObjectURL(m.blob);urls.push(url);return url;}
function mediaVisual(m){return m.type.startsWith('image/')?`<img src="${mediaURL(m)}" alt="${esc(m.name)}" loading="lazy">`:m.type.startsWith('video/')?`<video src="${mediaURL(m)}" preload="metadata" controls></video>`:`<div class="file-tile">▤</div>`;}
function renderLibrary(){ $('#view').innerHTML=header('Files','',false)+`<div class="view-tools" style="margin-bottom:20px"><button class="button primary" data-action="upload">＋ Upload files</button><input class="search" id="media-search" aria-label="Search media" placeholder="Search files"><span class="source-note">${media.length} files · ${storageState.mode==='cloud'?'Online · 25 MB per file':'This device'}</span></div><input type="file" id="library-upload" multiple accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx" hidden><div class="library-grid" id="media-grid">${media.map(m=>`<article class="media-card" data-name="${esc(m.name.toLowerCase())}">${mediaVisual(m)}<div class="media-card-info"><strong>${esc(m.name)}</strong><small>${(m.size/1024/1024).toFixed(1)} MB${m.width?' · '+m.width+' × '+m.height:''}</small>${m.type.startsWith('image/')?`<button class="text-button" data-crop="${m.id}">Crop</button>`:m.type.startsWith('video/')?`<button class="text-button" data-thumbnail="${m.id}">Make cover</button>`:''}<button class="text-button" data-remove-media="${esc(m.id)}">Remove</button></div></article>`).join('')}</div>${!media.length?'<div class="empty"><div class="empty-symbol">▧</div><h2>No files yet</h2><p>Upload a photo, video or document.</p></div>':''}`;}
function renderChannels(){showAccounts($('#view'),platforms).catch(fail);}
function showErrors(errors){$('#form-errors').hidden=!errors.length;$('#form-errors').innerHTML=errors.map(e=>`<div>• ${esc(e)}</div>`).join('');if(errors.length)$('#form-errors').scrollIntoView({block:'nearest',behavior:'smooth'});}
function openComposer(id=null,date=null,channel=null){
 let post=posts.find(p=>p.id===id);const reusing=post?.targets.some(t=>t.options?.manualCompletedAt);if(reusing)post=asNewDraft(post);autosave.reset();editing=post?.id||crypto.randomUUID();targets=structuredClone(post?.targets||[]);selectedMedia=[...(post?.mediaIds||[])];mediaDetails=structuredClone(post?.mediaDetails||{});previewChannel=targets[0]?.id||null;previewIndex=0;if(channel)targets=[{id:channel,format:platforms.find(p=>p.id===channel).formats[0]}];
 $('#save-note').textContent=post?'Saved':'New draft';$('#collection').value=post?.collection||'';$('#composer-title').textContent=reusing?'Copy post':post?'Edit post':'New post';$('#caption').value=post?.caption||'';$('#post-title').value=post?.title||'';$('#post-board').value=post?.board||'';
 $('#planned-at').value=post?.plannedAt?localDate(new Date(post.plannedAt)):date?date+'T09:00':'';$('#timezone').textContent=tz;$('#library-picker').hidden=true;showErrors([]);drawTargets();drawMedia();updatePreview();$('#composer').showModal();
}
function drawTargets(){
 $('#channel-picker').innerHTML=platforms.map(p=>`<button type="button" data-toggle-channel="${p.id}" class="${targets.some(t=>t.id===p.id)?'selected':''}" title="${esc(p.name)}" aria-label="${esc(p.name)}" aria-pressed="${targets.some(t=>t.id===p.id)}">${icon(p)}</button>`).join('');
 $('#variants').innerHTML=targets.map(t=>{const p=platforms.find(p=>p.id===t.id);return `<section class="variant"><div class="variant-head">${icon(p)} ${p.name}<select data-format="${p.id}" aria-label="${p.name} post format">${p.formats.map(f=>`<option ${t.format===f?'selected':''}>${f}</option>`).join('')}</select></div>${t.format!=='Thread'?`<textarea rows="2" data-caption="${p.id}" aria-label="Caption for ${p.name}" placeholder="Use the shared caption, or write one just for ${p.name}">${esc(t.caption??'')}</textarea>`:''}${extrasHTML(t,media,{caption:$('#caption').value,title:$('#post-title').value,board:$('#post-board').value})}<small>${p.limit.toLocaleString()} characters per post</small></section>`;}).join('');
 $('.two-fields').hidden=true;
 if(!targets.some(t=>t.id===previewChannel))previewChannel=targets[0]?.id||null;
 updatePreview();
}
function drawMedia(){
 const list=selectedMedia.map(id=>media.find(m=>m.id===id)).filter(Boolean);
 $('#composer-media').innerHTML=list.map((m,i)=>`<div class="media-thumb">${mediaVisual(m)}<button type="button" class="detach" data-detach="${m.id}" aria-label="Remove ${esc(m.name)} from post">×</button><small>${esc(m.name)}</small><div class="media-order"><button type="button" data-move-media="${m.id}" data-step="-1" ${i===0?'disabled':''} aria-label="Move ${esc(m.name)} earlier">←</button><button type="button" data-move-media="${m.id}" data-step="1" ${i===list.length-1?'disabled':''} aria-label="Move ${esc(m.name)} later">→</button>${m.type.startsWith('image/')?`<button type="button" data-crop="${m.id}">Crop</button>`:m.type.startsWith('video/')?`<button type="button" data-thumbnail="${m.id}">Cover</button>`:''}</div>${m.type.startsWith('image/')?`<textarea class="media-alt" rows="2" data-alt="${m.id}" aria-label="Alt text for ${esc(m.name)}" placeholder="Describe this image…">${esc(mediaDetails[m.id]?.altText||'')}</textarea>`:''}</div>`).join('');
}
function updatePreview(){
 const text=$('#caption').value;$('#character-count').textContent=`${[...text].length.toLocaleString()} characters`;
 const container=$('#preview-tabs');if(container)container.innerHTML=targets.map(t=>{const p=platforms.find(p=>p.id===t.id);return `<button type="button" data-preview-channel="${p.id}" class="${previewChannel===p.id?'active':''}" aria-label="Preview ${p.name}">${icon(p)}</button>`;}).join('');
 const target=targets.find(t=>t.id===previewChannel)||targets[0],network=platforms.find(p=>p.id===target?.id);const assets=selectedMedia.map(id=>media.find(m=>m.id===id)).filter(Boolean);if(previewIndex>=assets.length)previewIndex=0;
 $('.preview-card').innerHTML=previewHTML(target,network,{caption:text,title:$('#post-title').value,mediaDetails,library:media},assets,mediaURL,previewIndex);
}

function collectPost(status){return {id:editing||crypto.randomUUID(),version:posts.find(p=>p.id===editing)?.version??0,collection:$('#collection').value,caption:$('#caption').value,title:$('#post-title').value,board:$('#post-board').value,targets:structuredClone(targets),mediaIds:[...selectedMedia],mediaDetails:Object.fromEntries(selectedMedia.filter(id=>mediaDetails[id]).map(id=>[id,mediaDetails[id]])),plannedAt:$('#planned-at').value?new Date($('#planned-at').value).toISOString():null,timezone:tz,status,updatedAt:new Date().toISOString()};}
async function savePost(status){
 if(saving)return;saving=true;$('#save-draft').disabled=true;$('#post-form button[type="submit"]').disabled=true;$('#close-composer').disabled=true;
 try{
 await autosave.flush();
 const post=collectPost(status);const attached=selectedMedia.map(id=>media.find(m=>m.id===id)).filter(Boolean);let errors=[];
 if(status==='planned'){errors=validatePost(post,attached);if(!post.plannedAt)errors.push('Choose a planned date and time.');else if(new Date(post.plannedAt)<=new Date())errors.push('Choose a future date and time.');}
 else if(!post.caption.trim()&&!post.title.trim()&&!attached.length&&!post.targets.some(t=>t.caption?.trim()||t.options?.title?.trim()||t.options?.segments?.some(s=>s.trim())||t.options?.pollQuestion?.trim())){errors.push('Add a caption, title or media to save a draft.');}
 if(errors.length){showErrors(errors);return;}await put('posts',post);$('#composer').close();await refresh();toast(status==='draft'?(storageState.mode==='cloud'?'Draft saved to your cloud workspace.':'Draft saved on this device.'):'Date saved.');
 }finally{saving=false;$('#save-draft').disabled=false;$('#post-form button[type="submit"]').disabled=false;$('#close-composer').disabled=false;}
}
async function fileMeta(file){
 const result={id:crypto.randomUUID(),name:file.name,type:file.type||guessType(file.name),size:file.size,blob:file,createdAt:new Date().toISOString()};
 if(result.type.startsWith('image/')||result.type.startsWith('video/')){
  const url=URL.createObjectURL(file);try{await new Promise(resolve=>{const el=document.createElement(result.type.startsWith('image/')?'img':'video');const timer=setTimeout(resolve,4000);el.onload=el.onloadedmetadata=()=>{result.width=el.naturalWidth||el.videoWidth;result.height=el.naturalHeight||el.videoHeight;if(el.duration&&isFinite(el.duration))result.duration=el.duration;clearTimeout(timer);resolve();};el.onerror=()=>{clearTimeout(timer);resolve();};el.src=url;});}finally{URL.revokeObjectURL(url);}
 }return result;
}
function guessType(name){return {pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[name.split('.').pop()?.toLowerCase()]||'application/octet-stream';}
async function upload(files,attach=false){
 for(const file of files){const ext=file.name.split('.').pop().toLowerCase();if(!(file.type.startsWith('image/')||file.type.startsWith('video/')||['pdf','ppt','pptx','doc','docx'].includes(ext))){toast(`Unsupported file: ${file.name}`);continue;}if(file.size>500*1024*1024){toast(`${file.name} exceeds this preview’s 500 MB upload limit.`);continue;}const item=await fileMeta(file);await put('media',item);if(attach)selectedMedia.push(item.id);}
 media=await all('media');if(attach){drawMedia();drawTargets();updatePreview();autosave.touch();}else render();toast(storageState.mode==='cloud'?'Media uploaded to your private cloud library.':'Media saved on this device.');
}
function download(data,name,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
async function exportWorkspace(){
 toast('Preparing backup…');const assets=[];for(const item of media){const file=await mediaBlob(item);const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});const {blob,url,...meta}=item;assets.push({...meta,data});}
 download(JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),posts,media:assets}),`elleson-socials-${dateKey(new Date())}.json`);toast('Backup downloaded.');
}
async function importWorkspace(file){
 if(!file)return;const backup=JSON.parse(await file.text());
 if(backup.schemaVersion!==1||!Array.isArray(backup.posts)||!Array.isArray(backup.media))throw Error('Invalid backup');
 const validId=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
 // Validate the complete backup before beginning a merge. Existing records are kept.
 const importedMedia=[];for(const m of backup.media){if(!validId(m.id)||typeof m.name!=='string'||typeof m.type!=='string'||!/^data:[^,]*;base64,/.test(m.data))throw Error('Invalid media');const blob=await (await fetch(m.data)).blob();const {data,url,...meta}=m;importedMedia.push({...meta,blob});}
 for(const p of backup.posts){if(!validId(p.id)||typeof p.caption!=='string'||!['draft','planned','manual'].includes(p.status)||!Array.isArray(p.targets)||!Array.isArray(p.mediaIds)||p.mediaIds.some(id=>!validId(id))||p.targets.some(t=>!platforms.some(n=>n.id===t?.id&&n.formats.includes(t.format)))||p.plannedAt&&!Number.isFinite(Date.parse(p.plannedAt)))throw Error('Invalid post');}
 for(const m of importedMedia)if(!media.some(x=>x.id===m.id))await put('media',m);
 for(const p of backup.posts)if(!posts.some(x=>x.id===p.id))await put('posts',{...p,version:0,title:p.title||'',board:p.board||'',timezone:p.timezone||tz,plannedAt:p.plannedAt||null});
 await refresh();toast('Backup imported. Existing posts and media were kept.');
}
document.addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return;try{
 const d=button.dataset;
 if(d.openDay){const items=posts.filter(p=>p.status==='planned'&&p.plannedAt&&dateKey(new Date(p.plannedAt))===d.openDay);const dialog=document.createElement('dialog');dialog.className='day-dialog';dialog.innerHTML='<div class="dialog-head"><h2>'+esc(new Date(d.openDay+'T12:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}))+'</h2><button class="icon-button" data-close-day aria-label="Close day">×</button></div><div class="day-posts">'+(items.length?items.map(postRow).join(''):'<div class="empty"><h2>No posts planned</h2><button class="button primary" data-date="'+d.openDay+'">New post</button></div>')+'</div>';dialog.querySelector('[data-close-day]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();dialog.addEventListener('click',e=>{if(e.target.closest('[data-edit],[data-preview-post],[data-date]'))dialog.close();});}
 if(d.recover){button.disabled=true;try{await recoverPost(d.recover,d.version);location.hash='drafts';await refresh();toast('Recovered as a new cloud draft.');}finally{button.disabled=false;}}
 if(d.previewPost){const post=posts.find(p=>p.id===d.previewPost);openPostPreview(post,platforms,media,mediaURL,{edit:openComposer,schedule:schedulePosts});}
 if(d.schedulePost)schedulePosts([posts.find(p=>p.id===d.schedulePost)]);
 if(d.handoff){const post=structuredClone(posts.find(p=>p.id===d.handoff));openManualPublishing(post,platforms,media,mediaURL,async value=>{const saved=await put('posts',value);await refresh();return saved;});}

 if(d.previewChannel){previewChannel=d.previewChannel;previewIndex=0;updatePreview();}
 if(d.previewStep&&selectedMedia.length){previewIndex=(previewIndex+Number(d.previewStep)+selectedMedia.length)%selectedMedia.length;updatePreview();}
 if(d.addThread){const t=targets.find(t=>t.id===d.addThread);t.options||={};t.options.segments||=[t.caption??$('#caption').value];if(t.options.segments.length<80)t.options.segments.push('');drawTargets();}
 if(d.removeThread){const t=targets.find(t=>t.id===d.removeThread);if(t.options?.segments?.length>1){t.options.segments.splice(Number(d.index),1);t.caption=t.options.segments[0];drawTargets();}}
 if(d.moveMedia){const i=selectedMedia.indexOf(d.moveMedia),next=i+Number(d.step);if(i>=0&&next>=0&&next<selectedMedia.length){[selectedMedia[i],selectedMedia[next]]=[selectedMedia[next],selectedMedia[i]];drawMedia();updatePreview();}}
 if(d.crop||d.thumbnail){const item=media.find(m=>m.id===(d.crop||d.thumbnail));await openMediaEditor(item,async(file,{cover})=>{const saved=await fileMeta(file);await put('media',saved);media=await all('media');if($('#composer').open){if(cover){const t=targets.find(t=>t.id===previewChannel);if(t){t.options||={};t.options.coverId=saved.id;}}else{selectedMedia=selectedMedia.map(id=>id===item.id?saved.id:id);if(mediaDetails[item.id]){mediaDetails[saved.id]=mediaDetails[item.id];delete mediaDetails[item.id];}}drawMedia();drawTargets();updatePreview();autosave.touch();}else render();toast(cover?'Cover image saved.':'Cropped copy saved. Your original is unchanged.');});}

 if(d.action==='create')openComposer();if(d.date)openComposer(null,d.date);if(d.composeChannel)openComposer(null,null,d.composeChannel);if(d.edit)openComposer(d.edit);
 if(d.action==='export-report')download(planningCSV(posts,platforms),'elleson-content-plan-'+dateKey(new Date())+'.csv','text/csv;charset=utf-8');
 if(d.action==='export-workspace')await exportWorkspace();if(d.action==='import-workspace')$('#import').click();if(d.action==='refresh-cloud'){await refresh();toast('Posts updated.');}
 if(d.action==='copy-device'){toast('Copying device content to the cloud…');const result=await copyDeviceWorkspace();await refresh();toast(`Copied ${result.posts} posts and ${result.files} files. Device originals were kept.`);}
 if(d.action==='previous'||d.action==='next'){month=new Date(month.getFullYear(),month.getMonth()+(d.action==='next'?1:-1),1);render();}
 if(d.action==='today'){month=new Date();render();}if(d.action==='month'||d.action==='list'){calendarMode=d.action;render();}if(d.day){calendarMode='list';render();}
 if(d.action==='upload')$('#library-upload').click();
 if($('#composer').open&&['toggleChannel','addThread','removeThread','moveMedia','detach','attach'].some(k=>d[k]))setTimeout(()=>autosave.touch(),0);
 if(d.toggleChannel){const existing=targets.find(t=>t.id===d.toggleChannel);targets=existing?targets.filter(t=>t.id!==d.toggleChannel):[...targets,{id:d.toggleChannel,format:platforms.find(p=>p.id===d.toggleChannel).formats[0]}];drawTargets();}
 if(d.detach){delete mediaDetails[d.detach];selectedMedia=selectedMedia.filter(id=>id!==d.detach);drawMedia();updatePreview();}
 if(d.attach){if(!selectedMedia.includes(d.attach))selectedMedia.push(d.attach);drawMedia();updatePreview();}
 if(d.duplicate){const p=asNewDraft(posts.find(p=>p.id===d.duplicate));await put('posts',p);await refresh();toast('Copied to drafts.');}
 if(d.delete&&confirm('Delete this post?')){await remove('posts',d.delete);await refresh();toast(storageState.mode==='cloud'?'Post deleted. Saved versions are available in Admin.':'Post deleted.');}
 if(d.removeMedia){if(posts.some(p=>p.mediaIds.includes(d.removeMedia))){toast('This file is attached to a post. Remove it from those posts first.');return;}if(confirm('Remove this file?')){await remove('media',d.removeMedia);await refresh();}}
 }catch(error){fail(error);}});
document.addEventListener('input',event=>{if(event.target.id==='caption')updatePreview();if(event.target.dataset.caption){const t=targets.find(t=>t.id===event.target.dataset.caption);const value=event.target.value;if(value.trim())t.caption=value;else delete t.caption;updatePreview();}if(event.target.id==='media-search'){const query=event.target.value.toLowerCase();document.querySelectorAll('.media-card').forEach(el=>el.hidden=!el.dataset.name.includes(query));}});
document.addEventListener('input',event=>{
 const el=event.target;
 if(el.dataset.option){const t=targets.find(t=>t.id===el.dataset.channel);if(t){t.options||={};let value=el.type==='checkbox'?el.checked:el.value;if(el.type==='datetime-local'&&value)value=new Date(value).toISOString();t.options[el.dataset.option]=value;updatePreview();}}
 if(el.dataset.thread){const t=targets.find(t=>t.id===el.dataset.thread);t.options||={};t.options.segments||=[t.caption??$('#caption').value];t.options.segments[Number(el.dataset.index)]=el.value;t.caption=t.options.segments[0];updatePreview();}
 if(el.dataset.poll){const t=targets.find(t=>t.id===el.dataset.poll);t.options||={};t.options.pollChoices||=['','','',''];t.options.pollChoices[Number(el.dataset.choice)]=el.value;updatePreview();}
 if(el.dataset.alt){mediaDetails[el.dataset.alt]={altText:el.value};}
 if(el.closest('#post-form'))autosave.touch();
 if(el.id==='caption')for(const t of targets.filter(t=>t.format==='Thread'&&!t.options?.segments)){const first=document.querySelector('[data-thread="'+t.id+'"][data-index="0"]');if(first)first.value=el.value;}
});
document.addEventListener('change',event=>{const el=event.target;if(el.closest('#post-form'))autosave.touch();if(el.dataset.format){targets.find(t=>t.id===el.dataset.format).format=el.value;previewIndex=0;drawTargets();}if(el.id==='library-upload')upload([...el.files]).catch(fail);if(el.id==='post-upload'){upload([...el.files],true).catch(fail);el.value='';}});
$('#close-composer').onclick=async()=>{try{await autosave.flush();$('#composer').close();}catch(error){fail(error);}};$('#post-form').onsubmit=e=>{e.preventDefault();savePost('planned').catch(fail);};$('#save-draft').onclick=()=>savePost('draft').catch(fail);
$('#composer').addEventListener('cancel',event=>{event.preventDefault();if(!saving)$('#close-composer').click();});
$('#composer').addEventListener('close',()=>autosave.reset());
window.addEventListener('beforeunload',event=>{if(autosave.pending){event.preventDefault();event.returnValue='';}});
$('#choose-library').onclick=()=>{const picker=$('#library-picker');picker.hidden=!picker.hidden;picker.innerHTML=media.length?media.map(m=>`<button class="library-choice" type="button" data-attach="${m.id}">＋ ${esc(m.name)}</button>`).join(''):'<p class="source-note">Your library is empty. Upload a file above.</p>';};
$('#export').onclick=()=>exportWorkspace().catch(fail);$('#import').onchange=e=>{importWorkspace(e.target.files[0]).catch(()=>toast('This backup could not be imported. Choose an Elleson Socials workspace export.'));e.target.value='';};
window.addEventListener('hashchange',()=>{if(storageState.mode==='device'||storageState.session)render();});
async function start(){
 await ready();const cloud=storageState.mode==='cloud';
 const native=!!window.Capacitor?.isNativePlatform?.()||(location.hostname==='localhost'&&location.protocol==='https:');
 if(native&&!cloud){document.querySelector('nav').hidden=true;$('.sidebar-bottom').hidden=true;$('.profile').hidden=true;$('.local-label').textContent='';$('#view').innerHTML='<div class="native-signin"><div class="brand-mark">e•</div><h1>Elleson Socials</h1><p>Sign in to save your posts online.</p><a class="button primary" href="https://elleson-socials.poeticbeech16.chatgpt.site/" target="_blank" rel="noopener">Sign in ↗</a><button class="text-button" id="old-device-backup">Download old device posts</button></div>';$('#old-device-backup').onclick=async()=>{try{posts=await all('posts');media=await all('media');await exportWorkspace();}catch(error){fail(error);}};return;}

 $('.local-label').innerHTML=cloud?'<i></i> Online account':'<i></i> Saved on this device';
 $('.build-badge').hidden=true;if(!cloud){const login=$('.storage-link');login.textContent='Sign in';login.href='https://elleson-socials.poeticbeech16.chatgpt.site/';login.target='_blank';login.rel='noopener';login.classList.add('sign-in-button');}
 $('.workspace>div:nth-child(2)').innerHTML=cloud?'Your posts<small>Online</small>':'Your posts<small>This device</small>';
 $('.profile>div:nth-child(2)').innerHTML=cloud?`${esc(storageState.session.user.email)}<small>${storageState.session.user.role==='admin'?'Administrator':'Signed in'} · Online account</small>`:'Elleson<small>On this device</small>';
 const actions=document.createElement('div');actions.className='cloud-actions';
 actions.innerHTML=cloud?`<button class="text-button" id="copy-device">↑ Copy device posts</button><a class="text-button" href="${esc(signOutURL)}" target="_top">Sign out</a>`:'<a class="text-button" href="https://elleson-socials.poeticbeech16.chatgpt.site/" target="_blank" rel="noopener">Sign in online ↗</a>';
 $('.sidebar-bottom').append(actions);
 if(cloud){$('#save-note').textContent='Saved online';$('#copy-device').onclick=async()=>{try{toast('Copying device content to the cloud…');const result=await copyDeviceWorkspace();await refresh();toast(`Copied ${result.posts} posts and ${result.files} files. Device originals were kept.`);}catch(error){fail(error);}};}
 await refresh();
 if(cloud)setInterval(()=>{if(!document.hidden&&!document.querySelector('dialog[open]')&&!document.activeElement?.matches('input,textarea,select'))refresh().catch(()=>{$('.local-label').textContent='Cloud unavailable · Reconnecting…';});},30000);
}
start().catch(error=>{
 $('#view').innerHTML=header('Your account',error.message,false)+`<div class="empty"><div class="empty-symbol">☁</div><h2>${error.status===401?'Sign in to continue':'Unable to connect'}</h2><p>Sign in or try again.</p><a class="button primary" href="${esc(signInURL)}" target="_top">Sign in</a> </div>`;
});
