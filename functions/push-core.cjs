'use strict';
const crypto=require('node:crypto');
const {validZone}=require('./reminder-model.js');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function validateSubscription(value){
 if(!value||typeof value.endpoint!=='string'||value.endpoint.length>4096)throw Error('Invalid push endpoint');
 const u=new URL(value.endpoint),allowed=u.hostname==='fcm.googleapis.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.notify.windows.com')||u.hostname.endsWith('.wns.windows.com');
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!allowed)throw Error('Unsupported push service');
 const keys=value.keys||{},decode=(s,n)=>{if(typeof s!=='string'||!/^[A-Za-z0-9_-]+={0,2}$/.test(s))throw Error('Invalid push key');const b=Buffer.from(s,'base64url');if(b.length!==n)throw Error('Invalid push key length');return b};
 const point=decode(keys.p256dh,65);if(point[0]!==4)throw Error('Invalid P-256 point');crypto.ECDH.convertKey(point,'prime256v1');decode(keys.auth,16);
 return {endpoint:u.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
function registrationInput(body){if(!validZone(body?.timezone))throw Error('IANA time zone required');return {subscription:validateSubscription(body.subscription),timezone:body.timezone,label:String(body.label||'이 기기').replace(/[\x00-\x1f]/g,'').slice(0,60)}}
function claimDecision(previous,now){if(previous?.status==='sent'||previous?.status==='expired'||previous?.attempts>=3||previous?.leaseUntil>now||previous?.nextAttemptAt>now)return null;return {status:'sending',attempts:(previous?.attempts||0)+1,leaseUntil:now+90000,nextAttemptAt:0}}
function sendOutcome(error,attempt,now){if(!error)return {status:'sent',sentAt:now,leaseUntil:0,nextAttemptAt:0};const code=Number(error.statusCode)||0;if([404,410].includes(code))return {status:'expired',leaseUntil:0,nextAttemptAt:0,code};const retry=(!code||code===408||code===429||code>=500)&&attempt<3;return {status:retry?'retry':'failed',leaseUntil:0,nextAttemptAt:retry?now+Math.min(240000,60000*2**(attempt-1)):0,attempts:retry?attempt:3,code}}
async function deliver({device,message,now,store,send}){
 const id=hash(device.id+'|'+message.tag),claim=await store.claim(id,device,message,now);if(!claim)return {skipped:true};
 let error=null;try{await send(device.subscription,JSON.stringify({version:1,uid:device.uid,deviceId:device.id,tag:message.tag,title:message.title,body:message.body,route:message.route}),{TTL:600,urgency:'high',topic:hash(message.tag).slice(0,32),timeout:15000})}catch(e){error=e}
 const outcome=sendOutcome(error,claim.attempts,now);await store.finish(id,outcome);if(outcome.status==='expired')await store.disable(device.id,'expired');
 return outcome;
}
module.exports={hash,validateSubscription,registrationInput,claimDecision,sendOutcome,deliver};
