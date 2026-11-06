import {getPlannerDatabase} from '../firebase-context.mjs';
export async function account() {
  const sdk=await import('../firebase-vendor.js');
  const response=await fetch('../firebase-config.json',{cache:'no-store'});
  if(!response.ok)throw Error('계정 설정을 불러오지 못했어요.');
  const config=await response.json(),name='harugyeol-'+config.projectId;
  const app=sdk.getApps().find(x=>x.name===name)||sdk.initializeApp(config,name),auth=sdk.getAuth(app);
  await sdk.setPersistence(auth,sdk.browserLocalPersistence);await auth.authStateReady();
  const db=getPlannerDatabase(sdk,app);
  return {sdk,auth,db};
}
export const friendly = e => /permission-denied/.test(e?.code||'')?'계정 저장 권한을 확인하지 못했어요. 로그인 계정을 확인하고 다시 동기화를 눌러 주세요. 기기 기록은 유지됩니다.':/network|unavailable|offline/.test((e?.code||'')+' '+(e?.message||''))?'인터넷 연결을 확인해 주세요. 기록은 이 기기에 보관돼요.':e?.message||'처리하지 못했어요. 기기 기록은 유지됩니다.';
