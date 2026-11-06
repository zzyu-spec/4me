// Firebase options contain stateful cache managers. Recreating them after Firestore
// starts is not idempotent, so all planner/ledger entry points share this instance.
const databases = new WeakMap();
export function getPlannerDatabase(sdk, app) {
  if (databases.has(app)) return databases.get(app);
  const database = sdk.initializeFirestore(app, {
    localCache: sdk.persistentLocalCache({tabManager: sdk.persistentMultipleTabManager()})
  });
  databases.set(app, database);
  return database;
}
