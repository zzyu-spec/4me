// Browser test server only. Never imported by the production app.
const users={
 'qa@example.com':{uid:'qa-user',email:'qa@example.com',emailVerified:true},
 'alice@example.com':{uid:'alice',email:'alice@example.com',emailVerified:true},
 'bob@example.com':{uid:'bob',email:'bob@example.com',emailVerified:true}
};
const authListeners=new Set(),snapshots=new Set();
const readDocs=()=>JSON.parse(localStorage.getItem('test-firebase-docs')||'{}');
const readUser=()=>JSON.parse(localStorage.getItem('test-firebase-user')||'null');
const auth={currentUser:readUser(),authStateReady:async()=>{},onAuthStateChanged(fn){authListeners.add(fn);queueMicrotask(()=>fn(auth.currentUser));return()=>authListeners.delete(fn)}};
function emitAuth(user){auth.currentUser=user;localStorage.setItem('test-firebase-user',JSON.stringify(user));authListeners.forEach(fn=>queueMicrotask(()=>fn(user)))}
function authorize(ref){if(window.testDenyCloud)throw Object.assign(Error('permission denied'),{code:'permission-denied'});if(!auth.currentUser?.emailVerified||ref.path.split('/')[1]!==auth.currentUser.uid)throw Object.assign(Error('owner only'),{code:'permission-denied'})}
const snapshot=ref=>{authorize(ref);const value=readDocs()[ref.path];return {exists:()=>value!==undefined,data:()=>structuredClone(value),metadata:{hasPendingWrites:false,fromCache:false}}};
function commit(writes){const docs=readDocs();for(const [ref,value]of writes){authorize(ref);docs[ref.path]=structuredClone(value)}localStorage.setItem('test-firebase-docs',JSON.stringify(docs));snapshots.forEach(listener=>{if(writes.some(([ref])=>ref.path===listener.ref.path))queueMicrotask(()=>{try{listener.fn(snapshot(listener.ref))}catch(e){listener.error?.(e)}})})}
const apps=[];
export const getApps=()=>apps;
export const initializeApp=(config,name)=>{const app={name,options:config};apps.push(app);return app};
export const getAuth=()=>auth;
export const setPersistence=async()=>{};
export const browserLocalPersistence={};
export const initializeFirestore=(app,settings,databaseId)=>{if(databaseId!=='arnit')throw Error('Expected named arnit database');window.testFirestoreDatabase=databaseId;return {databaseId}};
export const persistentLocalCache=()=>({});
export const persistentMultipleTabManager=()=>({});
export const doc=(db,...parts)=>({path:parts.join('/')});
export const getDocFromServer=async ref=>{if(window.testImageReadDelay&&ref.path.includes('/arnitAssets/')){window.testImageReadCount=(window.testImageReadCount||0)+1;await new Promise(r=>setTimeout(r,window.testImageReadDelay))}return snapshot(ref)};
export const writeBatch=()=>{const writes=[];return {set:(ref,value)=>writes.push([ref,value]),commit:async()=>commit(writes)}};
export const runTransaction=async(db,fn)=>{const writes=[],result=await fn({get:async ref=>snapshot(ref),set:(ref,value)=>writes.push([ref,value])});commit(writes);return result};
export const onSnapshot=(ref,options,fn,error)=>{const listener={ref,fn,error};snapshots.add(listener);queueMicrotask(()=>{try{fn(snapshot(ref))}catch(e){error?.(e)}});return()=>snapshots.delete(listener)};
export const signInWithEmailAndPassword=async(auth,email,password)=>{if(password!=='test-password'||!users[email])throw Object.assign(Error('invalid credential'),{code:'auth/invalid-credential'});emitAuth(users[email]);return {user:users[email]}};
export const createUserWithEmailAndPassword=async(auth,email,password)=>{if(users[email])throw Object.assign(Error('already registered'),{code:'auth/email-already-in-use'});const user={uid:'new-'+email.split('@')[0],email,emailVerified:false};users[email]=user;emitAuth(user);return {user}};
export const sendEmailVerification=async()=>{window.testVerificationSent=true};
export const signOut=async()=>emitAuth(null);
