import {previewHTML} from './composer-extras.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function openPostPreview(post,platforms,media,url,{edit,schedule}={}){
 const d=document.createElement('dialog');d.className='post-preview-dialog';let current=post.targets[0]?.id,index=0;
 function render(){
  const target=post.targets.find(t=>t.id===current),network=platforms.find(p=>p.id===current),assets=post.mediaIds.map(id=>media.find(m=>m.id===id)).filter(Boolean);
  d.innerHTML=`<div class="dialog-head"><div><span class="eyebrow">PREVIEW</span><h2>${esc(post.title||'Your post')}</h2></div><button class="icon-button" data-close aria-label="Close preview">×</button></div><div class="post-preview-body"><div class="preview-tabs">${post.targets.map(t=>`<button class="button ${t.id===current?'primary':'secondary'}" data-network="${t.id}">${esc(platforms.find(p=>p.id===t.id)?.name)}</button>`).join('')}</div><div class="preview-card">${previewHTML(target,network,{...post,library:media},assets,url,index)}</div></div><div class="dialog-footer"><span>${post.plannedAt?esc(new Date(post.plannedAt).toLocaleString()):'Draft'}</span><div><button class="button secondary" data-edit-preview>Edit</button><button class="button primary" data-schedule-preview>Schedule</button></div></div>`;
  d.querySelector('[data-close]').onclick=()=>d.close();d.querySelector('[data-edit-preview]').onclick=()=>{d.close();edit?.(post.id);};d.querySelector('[data-schedule-preview]').onclick=()=>{d.close();schedule?.([post]);};
  d.querySelectorAll('[data-network]').forEach(b=>b.onclick=()=>{current=b.dataset.network;index=0;render();});
  d.querySelectorAll('[data-preview-step]').forEach(b=>b.onclick=()=>{index=(index+Number(b.dataset.previewStep)+assets.length)%assets.length;render();});
 }
 d.addEventListener('close',()=>d.remove());document.body.append(d);render();d.showModal();
}
