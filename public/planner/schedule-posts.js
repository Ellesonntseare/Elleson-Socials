import {validatePost} from './platforms.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function datedPosts(posts,start,days,timezone){
 if(!Number.isInteger(days)||days<0||days>365)throw Error('Choose 0 to 365 days between posts.');
 const first=new Date(start);if(!Number.isFinite(first.getTime())||first<=new Date())throw Error('Choose a future date and time.');
 return [...posts].sort((a,b)=>(a.title||a.caption).localeCompare(b.title||b.caption,undefined,{numeric:true})).map((p,i)=>{const date=new Date(first);date.setDate(date.getDate()+i*days);return {...p,status:'planned',plannedAt:date.toISOString(),timezone};});
}
export function openSchedulePosts(posts,media,{save,done}={}){
 if(!posts.length)throw Error('Choose at least one draft.');
 const d=document.createElement('dialog');d.className='schedule-dialog';let busy=false;
 const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
 d.innerHTML=`<div class="dialog-head"><div><span class="eyebrow">PLAN YOUR POSTS</span><h2>Schedule ${posts.length===1?'post':posts.length+' posts'}</h2></div><button class="icon-button" data-close aria-label="Close scheduling">×</button></div><form class="schedule-form"><div class="schedule-inputs"><label>First date<input type="date" name="date" required></label><label>Time<input type="time" name="time" value="09:00" required></label><label>Days between posts<select name="days"><option value="1">1 day</option><option value="0">Same time for all</option><option value="2">2 days</option><option value="3">3 days</option><option value="7">1 week</option></select></label></div><small>${esc(timezone)}</small><div class="schedule-summary" role="status">Choose a date to see your plan.</div><p class="schedule-disclosure">Saves dates in your calendar. Automatic Facebook publishing needs a connected Page.</p><p role="alert"></p><div class="dialog-footer"><button class="button secondary" type="button" data-cancel>Cancel</button><button class="button primary" type="submit">Save ${posts.length===1?'date':'all dates'}</button></div></form>`;
 const form=d.querySelector('form');
 const getUpdates=()=>{const data=new FormData(form);return datedPosts(posts,String(data.get('date'))+'T'+String(data.get('time')),Number(data.get('days')),timezone);};
 form.oninput=()=>{try{const updates=getUpdates();form.querySelector('[role=status]').innerHTML=updates.map(p=>`<div><strong>${esc(p.title||p.caption.slice(0,65))}</strong><span>${esc(new Date(p.plannedAt).toLocaleString())}</span></div>`).join('');}catch(error){form.querySelector('[role=status]').textContent=error.message;}};
 const close=()=>{if(!busy)d.close();};d.querySelector('[data-close]').onclick=close;d.querySelector('[data-cancel]').onclick=close;
 form.onsubmit=async e=>{e.preventDefault();if(busy)return;let saved=0;try{const updates=getUpdates();for(const p of updates){const errors=validatePost(p,p.mediaIds.map(id=>media.find(m=>m.id===id)).filter(Boolean));if(errors.length)throw Error((p.title||'Post')+': '+errors[0]);}busy=true;form.querySelector('[type=submit]').disabled=true;
  for(const p of updates){await save(p);saved++;form.querySelector('[role=status]').textContent=`Saving ${saved} of ${updates.length}…`;}
  busy=false;d.close();await done?.(saved);
 }catch(error){form.querySelector('[role=alert]').textContent=(saved?`${saved} dates saved. `:'')+error.message;busy=false;form.querySelector('[type=submit]').disabled=false;}};
 d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
}
