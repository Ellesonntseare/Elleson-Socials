import {formatFields} from './formats.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function localDate(value){if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}
export function extrasHTML(target,media,shared={}){
 const options=target.options||{};let html='';
 if(target.format==='Thread'){
  const parts=options.segments?.length?options.segments:[target.caption??shared.caption??''];
  html+=`<div class="thread-editor"><div class="field-label">Build your thread</div>${parts.map((part,i)=>`<div class="thread-part"><span class="thread-number">${i+1}</span><textarea rows="3" data-thread="${target.id}" data-index="${i}" aria-label="${target.id} thread post ${i+1}" placeholder="Write post ${i+1}">${esc(part)}</textarea>${parts.length>1?`<button type="button" class="icon-button" data-remove-thread="${target.id}" data-index="${i}" aria-label="Remove thread post ${i+1}">×</button>`:''}</div>`).join('')}<button type="button" class="button secondary" data-add-thread="${target.id}">＋ Add post to thread</button><p class="format-note">${parts.length} / 80 posts. Each post has its own character limit.</p></div>`;
 }
 const fields=formatFields(target.id,target.format);
 const renderField=f=>{
  const value=options[f.key]??(f.key==='title'?shared.title:f.key==='board'?shared.board:'')??'';
  const attributes=`data-option="${f.key}" data-channel="${target.id}" aria-label="${esc(f.label)} for ${target.id}"`;
  if(f.type==='checkbox')return `<label class="check"><input type="checkbox" ${attributes} ${value===true?'checked':''}>${f.label}</label>`;
  let input;if(f.type==='poll')input=Array.from({length:4},(_,i)=>`<input type="text" data-poll="${target.id}" data-choice="${i}" aria-label="Poll choice ${i+1} for ${target.id}" placeholder="Choice ${i+1}${i>1?' (optional)':''}" value="${esc(options.pollChoices?.[i]||'')}">`).join('');
  else if(f.type==='select')input=`<select ${attributes}>${f.choices.map(([v,label])=>`<option value="${esc(v)}" ${value===v?'selected':''}>${label}</option>`).join('')}</select>`;
  else if(f.type==='cover')input=`<select ${attributes}><option value="">Choose a cover image</option>${media.filter(m=>m.type.startsWith('image/')).map(m=>`<option value="${m.id}" ${value===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}</select>`;
  else if(f.type==='textarea')input=`<textarea rows="2" ${attributes}>${esc(value)}</textarea>`;
  else input=`<input type="${f.type}" ${attributes} value="${esc(f.type==='datetime-local'?localDate(value):value)}">`;
  return `<label class="${f.type==='textarea'?'wide':''}">${f.label}${input}</label>`;
 };
 const optionalKeys=new Set(['firstComment','location','tags','languages','aiGenerated','commercialContent','allowComments','allowDuet','allowStitch','terms']);
 const primary=fields.filter(f=>!optionalKeys.has(f.key)),optional=fields.filter(f=>optionalKeys.has(f.key));
 if(primary.length)html+='<div class="format-fields">'+primary.map(renderField).join('')+'</div>';
 if(optional.length)html+='<details class="advanced-options"><summary>More options</summary><div class="format-fields">'+optional.map(renderField).join('')+'</div></details>';
 return html;
}
export function previewHTML(target,network,post,assets,url,index=0){
 const options=target?.options||{},caption=target?.caption??post.caption??'',format=target?.format||'Post';
 const selected=assets[index]||assets[0],cover=post.library?.find(m=>m.id===options.coverId);
 const alt=post.mediaDetails?.[selected?.id]?.altText||selected?.name||'Post media';
 const visual=selected?(selected.type.startsWith('image/')?`<img src="${url(selected)}" alt="${esc(alt)}">`:selected.type.startsWith('video/')?`<video src="${url(selected)}" ${cover?`poster="${url(cover)}"`:''} controls preload="metadata"></video>`:`<div class="file-tile">▤<small>${esc(selected.name)}</small></div>`):'<span></span><i>✳</i>';
 const vertical=['Reel','Story','Short'].includes(format)||target?.id==='tiktok';
 const title=options.title||options.eventTitle||(['youtube','pinterest'].includes(target?.id)?post.title:'')||'';
 const thread=target?.format==='Thread'?(options.segments?.length?options.segments:[caption]):null;
 return `<div class="preview-profile"><div class="avatar small">${post.identity?.avatarURL&&/^\/(socials\/)?api\/social\/account\/[0-9a-f-]+\/picture$/i.test(post.identity.avatarURL)?'<img src="'+esc(post.identity.avatarURL)+'" alt="">':esc(network?.mark||'E')}</div><div><strong>${esc(post.identity?.name||'Preview')}</strong><small>${esc(network?.name||'Choose a channel')} · ${esc(format)}</small></div><span>•••</span></div>${thread?thread.map((part,i)=>`<div class="preview-thread-part"><span>${i+1}</span><p>${esc(part||'')}</p></div>`).join(''):`${title?`<h3 class="preview-title">${esc(title)}</h3>`:''}${assets.length||vertical?`<div id="preview-media" class="preview-media ${vertical?'vertical':''} ${target?.id==='youtube'&&format==='Video'?'landscape':''}">${visual}</div>`:''}${assets.length>1?`<div class="preview-pager"><button type="button" class="icon-button" data-preview-step="-1" aria-label="Previous preview image">‹</button><span>${index+1} / ${assets.length}</span><button type="button" class="icon-button" data-preview-step="1" aria-label="Next preview image">›</button></div>`:''}<p id="preview-caption">${esc(caption||(format==='Poll'?'':''))}</p>`}${options.url?`<div class="preview-link">↗ ${esc(options.url)}</div>`:''}${options.eventTitle?`<div class="preview-format">${esc(options.startsAt?new Date(options.startsAt).toLocaleString():'Choose dates')} ${options.endsAt?' → '+esc(new Date(options.endsAt).toLocaleString()):''}</div>`:''}${format==='Poll'?`<div class="preview-poll"><strong>${esc(options.pollQuestion||caption||'Your poll question')}</strong>${(options.pollChoices||[]).filter(s=>s.trim()).map(choice=>`<div>${esc(choice)}</div>`).join('')}<small>${options.pollDuration?esc(options.pollDuration)+' minutes':'Choose a voting duration'}</small></div>`:''}<div class="preview-actions">♡ &nbsp; ◯ &nbsp; ↗</div>${options.visibility?`<div class="preview-format">Visibility: ${esc(options.visibility)}</div>`:''}<div class="preview-format">Layout preview · Review each channel before posting</div>`;
}
