const enc=new TextEncoder(),dec=new TextDecoder();
export function base64url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function bytes(s){return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));}
async function key(value){if(!/^[0-9a-f]{64}$/i.test(value||''))throw Error('Social account storage is not configured.');return crypto.subtle.importKey('raw',Uint8Array.from(value.match(/../g),x=>parseInt(x,16)),'AES-GCM',false,['encrypt','decrypt']);}
export async function seal(value,secret,context){const iv=crypto.getRandomValues(new Uint8Array(12));const result=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(context)},await key(secret),enc.encode(JSON.stringify(value)));return base64url(iv)+'.'+base64url(new Uint8Array(result));}
export async function unseal(value,secret,context){const [iv,data]=value.split('.');return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv),additionalData:enc.encode(context)},await key(secret),bytes(data))));}
export async function digest(value){return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))));}
