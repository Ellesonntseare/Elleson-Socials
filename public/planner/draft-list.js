import {validatePost} from './platforms.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let search='',collection='',selected=new Set();
export function showDrafts({view,posts,media,postRow,tabs,save,refresh,toast,card,schedule}){
 const drafts=posts.filter(p=>p.status==='draft'),groups=[...new Set(drafts.map(p=>p.collection).filter(Boolean))].sort();
 selected=new Set([...selected].filter(id=>drafts.some(p=>p.id===id)));
 view.innerHTML=`<div class="page-head"><h1>Drafts</h1><div class="page-head-actions"><button class="button secondary" data-schedule-all>Schedule all</button><button class="button primary" data-action="create">＋ New post</button></div></div>${tabs}<div class="draft-filters"><input class="search" type="search" aria-label="Search drafts" placeholder="Search posts" value="${esc(search)}"><select aria-label="Filter by collection"><option value="">All collections</option>${groups.map(g=>`<option value="${esc(g)}" ${collection===g?'selected':''}>${esc(g)}</option>`).join('')}</select><button class="button secondary" data-select-all>Select all</button></div><details class="bulk-panel"><summary><span data-selection-count>${selected.size}</span> selected</summary><div class="bulk-forms"><form data-group-form><label>Collection<input name="collection" maxlength="80" required></label><button class="button secondary" type="submit">Move selected</button></form><form data-dates-form><label>First date<input type="date" name="date" required></label><label>Time<input type="time" name="time" value="09:00" required></label><label>Days between posts<input type="number" min="1" max="365" name="days" value="1" required></label><button class="button primary" type="submit">Save dates</button></form></div></details><p class="draft-message" role="status"></p><div class="draft-card-grid" data-draft-list></div>`;
 const filter=()=>drafts.filter(p=>(!collection||p.collection===collection)&&(!search||(p.title+' '+p.caption+' '+(p.collection||'')).toLowerCase().includes(search.toLowerCase()))).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')||(a.title||'').localeCompare(b.title||'',undefined,{numeric:true}));
 const list=view.querySelector('[data-draft-list]');
 function draw(){
  const rows=filter();view.querySelector('[data-selection-count]').textContent=selected.size;
  list.innerHTML=rows.length?rows.map(p=>`<div class="draft-card-wrap"><label class="card-select"><input type="checkbox" data-select-draft="${p.id}" aria-label="Select ${esc(p.title||p.caption.slice(0,60))}" ${selected.has(p.id)?'checked':''}><span class="sr-only">Select post</span></label>${card?card(p):postRow(p)}</div>`).join(''):'<div class="empty"><h2>No drafts found</h2></div>';
  list.querySelectorAll('[data-select-draft]').forEach(c=>c.onchange=()=>{if(c.checked)selected.add(c.dataset.selectDraft);else selected.delete(c.dataset.selectDraft);view.querySelector('[data-selection-count]').textContent=selected.size;});
 }
 view.querySelector('[type=search]').oninput=e=>{search=e.target.value;draw();};
 view.querySelector('select').onchange=e=>{collection=e.target.value;draw();};
 view.querySelector('[data-schedule-all]').onclick=()=>schedule?.(filter());
 view.querySelector('[data-select-all]').onclick=()=>{const rows=filter(),clear=rows.every(p=>selected.has(p.id));for(const p of rows)if(clear)selected.delete(p.id);else selected.add(p.id);draw();};
 async function bulk(form,transform){
  const message=view.querySelector('.draft-message'),buttons=[...view.querySelectorAll('.bulk-panel button')];let count=0;
  try{
   const chosen=drafts.filter(p=>selected.has(p.id)).sort((a,b)=>(a.title||a.caption).localeCompare(b.title||b.caption,undefined,{numeric:true}));if(!chosen.length)throw Error('Select at least one post.');
   const updates=chosen.map(transform);for(const p of updates)if(p.status==='planned'){
    const errors=validatePost(p,p.mediaIds.map(id=>media.find(m=>m.id===id)).filter(Boolean));if(errors.length)throw Error((p.title||'Post')+': '+errors[0]);if(new Date(p.plannedAt)<=new Date())throw Error('Choose a future date.');
   }
   buttons.forEach(b=>b.disabled=true);
   for(const update of updates){const saved=await save(update);Object.assign(drafts.find(p=>p.id===update.id),saved||update);count++;message.textContent=`Saving ${count} of ${updates.length}…`;}
   selected.clear();await refresh();toast(`${count} posts saved.`);
  }catch(error){message.textContent=(count?`${count} posts saved. `:'')+error.message;}finally{buttons.forEach(b=>b.disabled=false);}
 }
 view.querySelector('[data-group-form]').onsubmit=e=>{e.preventDefault();const data=new FormData(e.currentTarget);bulk(e.currentTarget,p=>({...p,collection:String(data.get('collection')).trim()}));};
 view.querySelector('[data-dates-form]').onsubmit=e=>{e.preventDefault();const data=new FormData(e.currentTarget),start=new Date(data.get('date')+'T'+data.get('time')),days=Number(data.get('days'));bulk(e.currentTarget,(p,index)=>{const date=new Date(start);date.setDate(date.getDate()+index*days);return {...p,status:'planned',plannedAt:date.toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};});};
 draw();
}
