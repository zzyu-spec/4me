'use strict';
const {onRequest}=require('firebase-functions/v2/https');
const {onSchedule}=require('firebase-functions/v2/scheduler');
const {defineSecret,defineString}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore,FieldPath}=require('firebase-admin/firestore');
const webPush=require('web-push');
const {hash,registrationInput,claimDecision,deliver}=require('./push-core.cjs');
const {dueWindow,decodeSnapshot}=require('./reminder-model.js');
initializeApp();const db=getFirestore();
const privateKey=defineSecret('WEB_PUSH_PRIVATE_KEY');
const publicKey=defineString('WEB_PUSH_PUBLIC_KEY');
const subject=defineString('WEB_PUSH_SUBJECT');
const runtimeServiceAccount=defineString('PUSH_RUNTIME_SERVICE_ACCOUNT');
const allowedOrigin='https://zzyu-spec.github.io';
const options={serviceAccount:runtimeServiceAccount,region:'asia-northeast3',minInstances:0,maxInstances:1,memory:'256MiB',secrets:[privateKey]};
function sender(){webPush.setVapidDetails(subject.value(),publicKey.value(),privateKey.value());return webPush.sendNotification.bind(webPush)}
const devices=db.collection('pushDevices');
async function limitAPI(uid,path){const ref=db.collection('pushRateLimits').doc(hash(uid));await db.runTransaction(async tx=>{const old=(await tx.get(ref)).data()||{},minute=Math.floor(Date.now()/60000),same=old.minute===minute,count=same?(old.count||0):0,tests=same?(old.tests||0):0;if(count>=30||path==='/test'&&tests>=2)throw Object.assign(Error('잠시 후 다시 시도해 주세요.'),{status:429});tx.set(ref,{minute,count:count+1,tests:tests+(path==='/test'?1:0),expiresAt:Date.now()+86400000})})}
exports.pushApi=onRequest({...options,timeoutSeconds:60},async(req,res)=>{
 res.set('Cache-Control','no-store');res.set('Vary','Origin');
 if(req.get('Origin')&&req.get('Origin')!==allowedOrigin)return res.status(403).json({error:'허용되지 않은 사이트입니다.'});
 res.set('Access-Control-Allow-Origin',allowedOrigin);res.set('Access-Control-Allow-Headers','Authorization, Content-Type');res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
 if(req.method==='OPTIONS')return res.status(204).send('');
 const path=req.path.replace(/\/$/,'')||'/';
 if(req.method==='GET'&&path==='/health')return res.json({version:1,publicKey:publicKey.value()});
 if(req.method!=='POST')return res.status(405).json({error:'POST required'});
 if(Number(req.get('Content-Length')||0)>12000)return res.status(413).json({error:'요청이 너무 큽니다.'});
 try{
  const token=(req.get('Authorization')||'').match(/^Bearer ([^\s]+)$/)?.[1];if(!token)throw Object.assign(Error('로그인이 필요합니다.'),{status:401});
  const user=await getAuth().verifyIdToken(token,true);if(user.email_verified!==true)throw Object.assign(Error('이메일 확인이 필요합니다.'),{status:403});
  await limitAPI(user.uid,path);
  const body=req.body;if(!body||typeof body!=='object'||Array.isArray(body)||Buffer.byteLength(JSON.stringify(body))>12000)throw Object.assign(Error('잘못된 요청입니다.'),{status:400});
  if(path==='/register'){
   let input;try{input=registrationInput(body)}catch{throw Object.assign(Error('구독 정보 또는 시간대를 확인해 주세요.'),{status:400})}
   const id=hash(input.subscription.endpoint),ref=devices.doc(id),now=Date.now(),owned=await devices.where('uid','==',user.uid).get();
   if(owned.docs.filter(d=>d.data().enabled&&d.id!==id).length>=10)throw Object.assign(Error('계정당 최대 10대까지 등록할 수 있습니다. 이전 기기를 해제해 주세요.'),{status:409});
   await db.runTransaction(async tx=>{const existing=(await tx.get(ref)).data();if(existing?.enabled&&existing.uid!==user.uid)throw Object.assign(Error('이 기기의 이전 계정 알림을 먼저 해제해 주세요.'),{status:409});tx.set(ref,{...input,uid:user.uid,enabled:true,authTime:Number(user.auth_time)*1000,createdAt:existing?.uid===user.uid?existing.createdAt:now,updatedAt:now,expiresAt:now+30*86400000,activatedAt:existing?.enabled&&existing.uid===user.uid?existing.activatedAt||now:now})});
   return res.json({id,expiresAt:now+30*86400000});
  }
  if(path==='/devices'){const found=await devices.where('uid','==',user.uid).get();return res.json({devices:found.docs.map(d=>({id:d.id,label:d.data().label,enabled:d.data().enabled,timezone:d.data().timezone,expiresAt:d.data().expiresAt}))})}
  if(!/^[a-f0-9]{64}$/.test(body.id||''))throw Object.assign(Error('기기 정보가 필요합니다.'),{status:400});
  const ref=devices.doc(body.id),doc=await ref.get(),device=doc.data();if(!device||device.uid!==user.uid)throw Object.assign(Error('기기를 찾을 수 없습니다.'),{status:404});
  if(path==='/disable'){await ref.update({enabled:false,reason:'user',updatedAt:Date.now()});return res.json({disabled:true})}
  if(path==='/status')return res.json({enabled:device.enabled===true&&device.expiresAt>Date.now(),expiresAt:device.expiresAt,timezone:device.timezone});
  if(path==='/test'){
   if(!device.enabled||device.expiresAt<=Date.now())throw Object.assign(Error('기기 알림을 다시 연결해 주세요.'),{status:409});
   const send=sender();try{await send(device.subscription,JSON.stringify({version:1,uid:user.uid,deviceId:doc.id,tag:'test:'+Date.now(),title:'하루결 테스트 알림',body:'서버에서 보낸 테스트 알림입니다.',route:{view:'home',date:new Intl.DateTimeFormat('en-CA',{timeZone:device.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),id:''}}),{TTL:120,urgency:'high',timeout:15000})}catch(error){if([404,410].includes(error.statusCode))await ref.update({enabled:false,reason:'expired'});throw Object.assign(Error('푸시 서비스에 전달하지 못했습니다. 기기를 다시 연결해 주세요.'),{status:502})}
   return res.json({accepted:true}); // Transport acceptance is not phone delivery confirmation.
  }
  return res.status(404).json({error:'Unknown action'});
 }catch(error){const auth=String(error.code||'').startsWith('auth/');res.status(error.status||(auth?401:500)).json({error:error.status?error.message:auth?'로그인을 다시 확인해 주세요.':'서버 요청에 실패했습니다. 로컬 기록은 유지됩니다.'})}
});
const store={
 async claim(id,device,message,now){const ref=db.collection('pushDeliveries').doc(id);return db.runTransaction(async tx=>{const [found,current,planner]=await Promise.all([tx.get(ref),tx.get(devices.doc(device.id)),tx.get(db.doc('users/'+device.uid+'/planner/current'))]);if(planner.data()?.revision!==device.snapshotRevision)return null;const d=current.data();if(!d?.enabled||d.uid!==device.uid||d.expiresAt<=now)return null;const next=claimDecision(found.data(),now);if(!next)return null;tx.set(ref,{...next,uid:device.uid,deviceId:device.id,scheduledAt:message.scheduledAt,expiresAt:now+86400000});return next})},
 async finish(id,outcome){await db.collection('pushDeliveries').doc(id).update(outcome)},
 async disable(id,reason){await devices.doc(id).update({enabled:false,reason,updatedAt:Date.now()})}
};
exports.sendScheduledPush=onSchedule({...options,schedule:'every 1 minutes',timeZone:'UTC',timeoutSeconds:120,retryCount:0},async()=>{
 const start=Date.now(),control=db.collection('pushControl').doc('scheduler');
 const lease=await db.runTransaction(async tx=>{const old=(await tx.get(control)).data()||{};if(old.leaseUntil>start)return null;const token=hash(start+':'+Math.random());tx.set(control,{...old,leaseUntil:start+150000,token});return {cursor:old.cursor||null,token}});if(!lease)return;
 const send=sender(),users=new Map();let cursor=lease.cursor;
 try{
  do{
   let q=devices.where('enabled','==',true).orderBy(FieldPath.documentId()).limit(25);if(cursor)q=q.startAfter(cursor);
   const page=await q.get();if(page.empty){cursor=null;break}
   for(const doc of page.docs){
    const device={...doc.data(),id:doc.id};cursor=doc.id;
    try{
     if(device.expiresAt<=start){await store.disable(doc.id,'lease-expired');continue}
     if(!users.has(device.uid))users.set(device.uid,(async()=>{const user=await getAuth().getUser(device.uid);if(user.disabled||!user.emailVerified)return null;const snapshot=await db.doc('users/'+device.uid+'/planner/current').get();return {user,revision:snapshot.data()?.revision,snapshot:snapshot.exists?decodeSnapshot(snapshot.data().snapshot):null}})());
     const data=await users.get(device.uid);if(!data||Date.parse(data.user.tokensValidAfterTime||'1970-01-01')>device.authTime){await store.disable(doc.id,'auth-revoked');continue}
     if(!data.snapshot)continue;device.snapshotRevision=data.revision;
     for(const message of dueWindow(data.snapshot,start,device.timezone)){
      if(message.scheduledAt<(device.activatedAt||0)-60000)continue;
      const outcome=await deliver({device,message,now:start,store,send});
      if(outcome.status&&outcome.status!=='sent')console.warn('push-send',{device:doc.id.slice(0,12),status:outcome.status,code:outcome.code||0});
     }
    }catch(error){if(error.code==='auth/user-not-found')await store.disable(doc.id,'account-deleted');else console.error('push-device-failed',{device:doc.id.slice(0,12),code:String(error.code||error.name||'unknown').slice(0,80)})}
    if(Date.now()-start>50000)break;
   }
   if(Date.now()-start>50000)break;
   if(page.size<25){cursor=null;break}
  }while(true);
  // Bounded cleanup; subscriptions contain endpoints/keys, removed after lease expiry.
  for(const name of ['pushDeliveries','pushRateLimits','pushDevices']){const expired=await db.collection(name).where('expiresAt','<',start).limit(100).get();if(!expired.empty){const batch=db.batch();expired.docs.forEach(d=>batch.delete(d.ref));await batch.commit()}}
 }finally{await db.runTransaction(async tx=>{const ref=await tx.get(control);if(ref.data()?.token===lease.token)tx.update(control,{cursor,leaseUntil:0})})}
});
