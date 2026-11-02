let dbPromise;
export function database(){
 return dbPromise ||= new Promise((resolve,reject)=>{
  const req=indexedDB.open('elleson-socials',1);
  req.onupgradeneeded=()=>{req.result.createObjectStore('posts',{keyPath:'id'});req.result.createObjectStore('media',{keyPath:'id'});};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
export async function run(store,mode,action){
 const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,mode);const req=action(tx.objectStore(store));
  tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
}
export const all=store=>run(store,'readonly',s=>s.getAll());
export const get=(store,id)=>run(store,'readonly',s=>s.get(id));
export const put=(store,value)=>run(store,'readwrite',s=>s.put(value));
export const remove=(store,id)=>run(store,'readwrite',s=>s.delete(id));
