const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function activitySummary(posts,platforms){
 return platforms.map(platform=>{
  const targets=posts.flatMap(post=>post.targets.filter(t=>t.id===platform.id).map(target=>({post,target})));
  return {name:platform.name,drafts:targets.filter(x=>x.post.status==='draft'&&!x.target.options?.manualCompletedAt).length,planned:targets.filter(x=>x.post.status==='planned'&&!x.target.options?.manualCompletedAt).length,manual:targets.filter(x=>x.target.options?.manualCompletedAt).length,total:targets.length};
 });
}
function cell(value){let text=String(value??'');if(/^\s*[=+\-@]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function planningCSV(posts,platforms){
 const rows=[['Post ID','Platform','Format','Status','Caption','Planned at (UTC)','Timezone','Manually completed at']];
 for(const post of posts)for(const target of post.targets){rows.push([post.id,platforms.find(p=>p.id===target.id)?.name||target.id,target.format,target.options?.manualCompletedAt?'Posted manually':post.status,target.caption??post.caption,post.plannedAt||'',post.timezone||'',target.options?.manualCompletedAt||'']);}
 return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
export function activityHTML(posts,platforms){
 const rows=activitySummary(posts,platforms),total=rows.reduce((n,r)=>n+r.total,0),manual=rows.reduce((n,r)=>n+r.manual,0);
 return `<div class="page-head"><div><h1>Activity & reports</h1><p>A clear view of the content in your workspace.</p></div><button class="button primary" data-action="export-report">↓ Export plan</button></div><div class="stats"><div class="stat"><div class="stat-label">Saved posts</div><strong>${posts.length}</strong><small>Unique content items</small></div><div class="stat"><div class="stat-label">Channel versions</div><strong>${total}</strong><small>Across all selected channels</small></div><div class="stat"><div class="stat-label">Posted manually</div><strong>${manual}</strong><small>Confirmed by you</small></div><div class="stat"><div class="stat-label">Connected accounts</div><strong>0</strong><small>Account analytics are not connected</small></div></div><section class="calendar-panel"><div class="calendar-toolbar"><h2>Content by channel</h2></div><div class="report-table-wrap"><table class="report-table"><thead><tr><th>Channel</th><th>Drafts</th><th>Planned</th><th>Posted manually</th><th>Total</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.name)}</td><td>${r.drafts}</td><td>${r.planned}</td><td>${r.manual}</td><td>${r.total}</td></tr>`).join('')}</tbody></table></div></section><div class="notice">These figures describe your saved content and manual confirmations. Reach, engagement, follower growth and best posting times will appear after social-account analytics are connected.</div><a class="button secondary" href="#planner">Back to planner</a>`;
}
