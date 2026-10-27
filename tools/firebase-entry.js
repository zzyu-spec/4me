export { initializeApp, getApps } from 'firebase/app';
export { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
export { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer, runTransaction, collection, query, orderBy, limit, getDocsFromServer, writeBatch, onSnapshot } from 'firebase/firestore';
