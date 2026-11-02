// Notifications only: never cache private pages, API results, or media.
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let data;try{data=event.data?.json();}catch{}if(!data)return;
 const postId=/^[0-9a-f-]{36}$/i.test(data.postId||'')?data.postId:null;
 const url=new URL('./',self.registration.scope);url.hash='queue'+(postId?'?post='+postId:'');
 event.waitUntil(self.registration.showNotification(String(data.title||'Elleson Socials').slice(0,120),{body:String(data.body||'Open your posting results.').slice(0,500),tag:'socials-'+String(data.id||'result'),icon:new URL('icon.svg',self.registration.scope).href,data:{url:url.href}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const target=new URL(event.notification.data?.url||self.registration.scope);if(target.origin!==self.location.origin||!target.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const existing=windows.find(c=>new URL(c.url).origin===target.origin&&new URL(c.url).pathname.startsWith(new URL(self.registration.scope).pathname));if(existing){await existing.navigate(target.href);return existing.focus();}return self.clients.openWindow(target.href);})());
});
