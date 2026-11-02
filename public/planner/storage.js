import * as device from './device-storage.js';
export const storageState={mode:location.pathname.startsWith('/planner/')&&!new URLSearchParams(location.search).has('device')?'cloud':'device',session:null};
const versions=new Map();let initialization;
export async function api(path,options={}){
 const response=await fetch('/api/'+path,{credentials:'same-origin',...options});
 if(!response.ok){let message='Cloud request failed. Please try again.';try{message=(await response.json()).error||message;}catch{}const error=new Error(message);error.status=response.status;throw error;}
 return response.status===204?null:response.json();
}
export function ready(){return initialization ||= (storageState.mode==='cloud'?api('session').then(session=>{storageState.session=session;return session;}):Promise.resolve(null));}
export async function all(store){
 await ready();if(storageState.mode==='device')return device.all(store);
 const rows=await api(store);if(store==='posts')for(const p of rows)versions.set(p.id,p.version);return rows;
}
export async function get(store,id){return (await all(store)).find(value=>value.id===id);}
export async function put(store,value){
 await ready();if(storageState.mode==='device')return device.put(store,value);
 if(store==='posts'){
  const saved=await api('posts/'+value.id,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(value.version??versions.get(value.id)??0)},body:JSON.stringify(value)});versions.set(saved.id,saved.version);return saved;
 }
 if(!value.blob)throw new Error('Choose a file to upload.');
 return api('media/'+value.id,{method:'PUT',headers:{'Content-Type':value.type,'X-Media-Name':encodeURIComponent(value.name)},body:value.blob});
}
export async function remove(store,id){
 await ready();if(storageState.mode==='device')return device.remove(store,id);
 return api(store+'/'+id,{method:'DELETE',headers:store==='posts'?{'If-Match':String(versions.get(id)??0)}:{}});
}
export async function mediaBlob(item){
 if(item.blob)return item.blob;const response=await fetch(item.url,{credentials:'same-origin'});if(!response.ok)throw new Error('Could not download this media file.');return response.blob();
}
export async function copyDeviceWorkspace(){
 if(storageState.mode!=='cloud')throw new Error('Open your cloud workspace first.');
 const [localPosts,localMedia,cloudPosts,cloudMedia]=await Promise.all([device.all('posts'),device.all('media'),all('posts'),all('media')]);
 const presentMedia=new Set(cloudMedia.map(m=>m.id));let files=0,postCount=0;
 for(const m of localMedia){if(presentMedia.has(m.id))continue;await put('media',m);files++;}
 const presentPosts=new Set(cloudPosts.map(p=>p.id));
 for(const p of localPosts){if(presentPosts.has(p.id))continue;await put('posts',{...p,version:0});postCount++;}
 return {posts:postCount,files};
}
