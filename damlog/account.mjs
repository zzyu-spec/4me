// Authentication shares the existing project and app name. Firestore is Damlog-only.
export const DATABASE_ID='damlog';
const databases=new WeakMap();
export async function account(){
 const sdk=await import('../firebase-vendor.js');
 const response=await fetch(new URL('../firebase-config.json',import.meta.url),{cache:'no-store'});
 if(!response.ok)throw Error('담록 계정 설정을 불러오지 못했습니다.');
 const config=await response.json(),name='harugyeol-'+config.projectId;
 const app=sdk.getApps().find(a=>a.name===name)||sdk.initializeApp(config,name);
 const auth=sdk.getAuth(app);
 await sdk.setPersistence(auth,sdk.browserLocalPersistence);await auth.authStateReady();
 if(!databases.has(app))databases.set(app,sdk.initializeFirestore(app,{localCache:sdk.persistentLocalCache({tabManager:sdk.persistentMultipleTabManager()})},DATABASE_ID));
 return {sdk,app,auth,db:databases.get(app)};
}
// Only the explicit, read-only migration tool requests the old database.
export async function legacyDatabase(sdk,app){
 const {getPlannerDatabase}=await import('../firebase-context.mjs');
 return getPlannerDatabase(sdk,app);
}
export const friendly=e=>/permission-denied/.test(e?.code||'')?'damlog 데이터베이스의 담록 전용 규칙을 확인해 주세요. 기기 자료는 유지됩니다.':/not-found/.test(e?.code||'')?'damlog 데이터베이스가 있는지 확인해 주세요. 기기 자료는 유지됩니다.':/auth\//.test(e?.code||'')?'이메일·비밀번호와 이메일 인증을 확인해 주세요.':/network|unavailable|offline/.test((e?.code||'')+' '+(e?.message||''))?'연결을 확인해 주세요. 기기 자료는 유지됩니다.':e?.message||'처리하지 못했습니다. 기기 자료는 유지됩니다.';
