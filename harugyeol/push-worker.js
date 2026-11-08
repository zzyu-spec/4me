/* Loaded only inside the existing /4me/ Service Worker. */
'use strict';
importScripts('./push-storage.js','./functions/reminder-model.js');
function pushRoute(value){if(!value||!['home','calendar','todos','routines'].includes(value.view)||!/^\d{4}-\d{2}-\d{2}$/.test(value.date||'')||!Number.isFinite(Date.parse(value.date+'T12:00:00Z'))||new Date(value.date+'T12:00:00Z').toISOString().slice(0,10)!==value.date)return null;return {view:value.view,date:value.date,id:String(value.id||'').slice(0,200)}}
self.addEventListener('push',event=>{event.waitUntil((async()=>{
 let message;try{message=event.data?.json()}catch{return}if(message?.version!==1||typeof message.tag!=='string'||message.tag.length>500||typeof message.title!=='string')return;
 const binding=await harugyeolPushStore.binding();if(!binding?.enabled||binding.expiresAt<=Date.now()||message.uid!==binding.uid||message.deviceId!==binding.id)return;
 const route=pushRoute(message.route);if(!route)return;
 const key=binding.uid+':'+binding.id+':'+message.tag;if(!await harugyeolPushStore.claim(key))return;
 try{const display=HarugyeolReminderModel.notificationText(message);await self.registration.showNotification(display.title,{body:display.body,tag:message.tag,icon:new URL('icon-192.png',self.registration.scope).href,badge:new URL('icon-192.png',self.registration.scope).href,data:{route,uid:binding.uid,deviceId:binding.id},renotify:false})}catch(error){await harugyeolPushStore.release(key);throw error}
 await harugyeolPushStore.mark(key);
})())});
self.addEventListener('pushsubscriptionchange',event=>{event.waitUntil((async()=>{const binding=await harugyeolPushStore.binding();if(binding)await harugyeolPushStore.setBinding({...binding,enabled:false});for(const c of await self.clients.matchAll({type:'window'}))c.postMessage({type:'harugyeol-push-expired'})})())});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const data=event.notification.data||{},binding=await harugyeolPushStore.binding();
 if(data.uid&&(!binding?.enabled||binding.uid!==data.uid||binding.id!==data.deviceId))return;
 const route=pushRoute(data.route),scope=new URL(self.registration.scope),url=new URL('index.html',scope);
 if(route){url.searchParams.set('pushView',route.view);url.searchParams.set('pushDate',route.date);url.searchParams.set('pushId',route.id)}
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true}),existing=windows.find(c=>{const u=new URL(c.url);return u.origin===scope.origin&&u.pathname.startsWith(scope.pathname)});
 if(existing){if(route)existing.postMessage({type:'harugyeol-push-open',route});return existing.focus()}
 return self.clients.openWindow(url.href);
})())});
