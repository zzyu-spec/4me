let current={uid:'test-a',email:'qa@example.com',emailVerified:true},listeners=[],apps=[];
const auth={get currentUser(){return current},authStateReady:async()=>{},onAuthStateChanged(fn){listeners.push(fn);setTimeout(()=>fn(current),0);return()=>{}}};
export const getApps=()=>apps;export const initializeApp=(o,name)=>{const app={name};apps.push(app);return app};export const getAuth=()=>auth;export const setPersistence=async()=>{};export const browserLocalPersistence={};export const initializeFirestore=(app,options,id='(default)')=>({id});export const persistentLocalCache=()=>({});export const persistentMultipleTabManager=()=>({});
export const collection=(db,...path)=>({database:db.id,path:path.join('/')});export const doc=(db,...path)=>({database:db.id,path:path.join('/')});
function check(ref){if(!current?.emailVerified||ref.path.split('/')[1]!==current.uid){const e=Error('permission-denied');e.code='permission-denied';throw e}}
async function unwrap(promise){const v=await promise;if(v?.mockError){const e=Error(v.mockError);e.code=v.mockError;throw e}return v}
const snap=(ref,value)=>({id:ref.path.split('/').pop(),exists:()=>value!==null&&value!==undefined,data:()=>value});
export const getDocFromServer=async ref=>{check(ref);return snap(ref,await unwrap(window.mockDbRead(ref,current)))};
export const getDocsFromServer=async ref=>{check(ref);return {docs:(await unwrap(window.mockDbList(ref,current))).map(([path,value])=>snap({path},value))}};
export function writeBatch(db){let writes=[];return{set:(ref,value)=>{check(ref);if(ref.database!==db.id)throw Error('mixed database batch');writes.push([ref,value])},commit:async()=>{for(const[r]of writes)check(r);return unwrap(window.mockDbWrite(writes,current))}}}
export async function runTransaction(db,fn){let writes=[];const result=await fn({get:getDocFromServer,set:(ref,value)=>{check(ref);if(ref.database!==db.id)throw Error('mixed database transaction');writes.push([ref,value])}});for(const[r]of writes)check(r);await unwrap(window.mockDbWrite(writes,current));return result}
export const onSnapshot=(ref,opts,fn,error)=>{check(ref);setTimeout(()=>fn({metadata:{hasPendingWrites:false}}),0);return()=>{}};
export const signOut=async()=>{current=null;for(const fn of listeners)await fn(current)};
export const signInWithEmailAndPassword=async(auth,email,password)=>{current={uid:email==='b@example.com'?'test-b':'test-a',email,emailVerified:email!=='unverified@example.com'};for(const fn of listeners)await fn(current)};
export const createUserWithEmailAndPassword=async(auth,email,password)=>({user:{uid:'new',email,emailVerified:false}});export const sendEmailVerification=async()=>{};
