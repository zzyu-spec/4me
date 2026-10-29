const C='harugyeol-v140';
const A=['./','index.html','cloud.js','firebase-vendor.js','firebase-config.json','manifest.json','icon-192.png','icon-512.png',...['rose','sage','lavender','sky','butter','mono'].flatMap(theme=>[`manifest-${theme}.json`,`icons/${theme}-192.png`,`icons/${theme}-512.png`])];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(A.map(path=>new Request(path,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('harugyeol-')&&k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const request=e.request,url=new URL(request.url),paths=A.map(path=>new URL(path,self.registration.scope).pathname);
  // Never cache Firebase authentication, database traffic or another origin's responses.
  if(request.method!=='GET'||url.origin!==self.location.origin||request.headers.has('authorization'))return;
  if(request.mode!=='navigate'&&!paths.includes(url.pathname))return;
  e.respondWith(fetch(request,{cache:'no-cache'}).then(response=>{if(response.ok&&paths.includes(url.pathname)){const copy=response.clone();e.waitUntil(caches.open(C).then(cache=>cache.put(request,copy)))}return response}).catch(async()=>{const hit=await caches.match(request);if(hit)return hit;if(request.mode==='navigate')return (await caches.match(new URL('index.html',self.registration.scope)))||Response.error();return Response.error()}));
});

self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const scope=new URL(self.registration.scope);const existing=windows.find(client=>client.url.startsWith(scope.href));if(existing)return existing.focus();return self.clients.openWindow(scope.href)})())});
