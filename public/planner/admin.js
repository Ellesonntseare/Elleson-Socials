import {api,storageState} from './storage.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function renderAdmin(view){
 if(storageState.mode!=='cloud'||storageState.session?.user.role!=='admin'){
  view.innerHTML='<h1>Administrator workspace</h1><p>Open your cloud workspace and sign in with the owner account to use recovery.</p><a class="button primary" href="https://elleson-socials.poeticbeech16.chatgpt.site/login" target="_top">Sign in to cloud workspace ↗</a>';return;
 }
 view.innerHTML=`<div class="page-head"><h1>Admin</h1><a class="button secondary" href="#storage">Settings</a></div><div class="roadmap"><article><h2>Administrator</h2><p>${esc(storageState.session.user.email)}</p><a class="text-button" href="/login" target="_top">Sign-in details ↗</a></article><article><h2>Backups</h2><button class="button primary" data-action="export-workspace">Download backup</button></article><article><h2>South Africa by Province</h2><p>65 posts</p><a class="button secondary" href="#drafts">Open drafts</a></article></div><h2 style="margin-top:32px">Post history</h2><p>Restore an earlier version as a new draft.</p><div id="recovery-versions" role="status">Loading…</div>`;
 const target=view.querySelector('#recovery-versions');
 try{
  const rows=await api('admin/history');if(!target.isConnected)return;
  target.innerHTML=rows.length?'<div class="post-list">'+rows.map(r=>`<article class="post-row"><div class="post-summary"><h3>${esc(r.title||r.caption.slice(0,120)||'Saved post')}</h3><p>Version ${r.version} · ${esc(new Date(r.savedAt).toLocaleString())} · ${r.deleted?'Deleted':'Saved'}</p></div><button class="button secondary" data-recover="${esc(r.postId)}" data-version="${r.version}">Recover as draft</button></article>`).join('')+'</div>':'<p>Saved versions will appear here when you create or change a post.</p>';
 }catch(error){if(target.isConnected)target.textContent=error.message;}
}
export async function recoverPost(id,version){return api(`admin/recover/${id}/${version}`,{method:'POST'});}
