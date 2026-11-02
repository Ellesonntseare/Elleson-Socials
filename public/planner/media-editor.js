import {mediaBlob} from './storage.js';
export async function openMediaEditor(item,onSave){
 const blob=await mediaBlob(item),url=URL.createObjectURL(blob),videoMode=item.type.startsWith('video/');
 const dialog=document.createElement('dialog');dialog.className='crop-dialog';
 dialog.innerHTML=`<div class="dialog-head" style="padding:0 0 16px"><div><div class="eyebrow">PREPARE YOUR MEDIA</div><h2>${videoMode?'Choose a video cover':'Crop your image'}</h2></div><button class="icon-button" type="button" data-close aria-label="Close media editor">×</button></div><p class="format-note">${videoMode?'Play or seek to a frame, then save it as a cover image.':'Choose a shape and adjust the crop. A new JPEG will be saved; your original stays in the library.'}</p>${videoMode?'<video class="crop-video" controls style="width:100%;max-height:45vh" preload="metadata"></video>':'<div class="crop-toolbar"><button data-ratio="original">Original</button><button data-ratio="1">Square 1:1</button><button data-ratio="0.8">Portrait 4:5</button><button data-ratio="0.5625">Reel / Story 9:16</button><button data-ratio="1.7777778">Landscape 16:9</button><button data-ratio="0.6666667">Pin 2:3</button></div><canvas class="crop-preview"></canvas><label class="crop-slider">Left / right <input type="range" min="0" max="100" value="50" data-x aria-label="Horizontal crop position"></label><label class="crop-slider">Up / down <input type="range" min="0" max="100" value="50" data-y aria-label="Vertical crop position"></label><label class="crop-slider">Zoom <input type="range" min="1" max="3" step="0.05" value="1" data-zoom aria-label="Crop zoom"></label>'}<p class="format-note" data-status role="status">Loading media…</p><div class="crop-footer"><button type="button" class="button secondary" data-close>Cancel</button><button type="button" class="button primary" data-save disabled>${videoMode?'Save this frame':'Save cropped copy'}</button></div>`;
 document.body.append(dialog);dialog.showModal();let bitmap=null,ratio=1,busy=false;
 const status=dialog.querySelector('[data-status]'),save=dialog.querySelector('[data-save]');
 const canvas=dialog.querySelector('canvas')||document.createElement('canvas');
 const video=dialog.querySelector('video');
 const close=()=>{if(!busy)dialog.close();};dialog.querySelectorAll('[data-close]').forEach(button=>button.onclick=close);
 dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 dialog.addEventListener('close',()=>{URL.revokeObjectURL(url);bitmap?.close?.();video?.pause();dialog.remove();});
 function paint(){
  if(!bitmap)return;const zoom=Number(dialog.querySelector('[data-zoom]').value);let cw,ch;
  if(bitmap.width/bitmap.height>ratio){ch=bitmap.height/zoom;cw=ch*ratio;}else{cw=bitmap.width/zoom;ch=cw/ratio;}
  const sx=(bitmap.width-cw)*Number(dialog.querySelector('[data-x]').value)/100,sy=(bitmap.height-ch)*Number(dialog.querySelector('[data-y]').value)/100;
  const scale=Math.min(1,1920/Math.max(cw,ch));canvas.width=Math.max(1,Math.round(cw*scale));canvas.height=Math.max(1,Math.round(ch*scale));canvas.getContext('2d').drawImage(bitmap,sx,sy,cw,ch,0,0,canvas.width,canvas.height);status.textContent=`${canvas.width} × ${canvas.height} pixels · JPEG copy`;
 }
 dialog.querySelectorAll('[data-ratio]').forEach(button=>button.onclick=()=>{ratio=button.dataset.ratio==='original'?bitmap.width/bitmap.height:Number(button.dataset.ratio);paint();});
 dialog.querySelectorAll('input[type=range]').forEach(input=>input.oninput=paint);
 try{
  if(videoMode){video.src=url;video.onloadedmetadata=()=>{status.textContent='Play or seek to the frame you want to use.';};video.onloadeddata=video.onseeked=()=>{save.disabled=video.readyState<2;status.textContent='Ready. Choose Save this frame to make your cover.';};video.onerror=()=>{status.textContent='This browser could not open the video. Try an MP4 video.';};}
  else{bitmap=await createImageBitmap(blob);if(!dialog.isConnected){bitmap.close();return;}ratio=bitmap.width/bitmap.height;paint();save.disabled=false;}
 }catch(error){status.textContent='This image could not be opened for editing. Try a JPEG, PNG or WebP image.';}
 save.onclick=async()=>{
  if(busy)return;busy=true;save.disabled=true;status.textContent='Saving your new image…';
  try{
   if(videoMode){video.pause();canvas.width=video.videoWidth;canvas.height=video.videoHeight;canvas.getContext('2d').drawImage(video,0,0);}
   const output=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));if(!output)throw Error('Could not create the image.');
   const name=item.name.replace(/\.[^.]+$/,'')+(videoMode?'-cover':'-cropped')+'.jpg';
   await onSave(new File([output],name,{type:'image/jpeg'}),{cover:videoMode});busy=false;dialog.close();
  }catch(error){status.textContent=error.message||'Could not save the image. Please try again.';busy=false;save.disabled=false;}
 };
}
