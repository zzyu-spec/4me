// Test-only SDK/Firestore transport; no real accounts, emails or cloud writes.
const fs = require('node:fs');
const path = require('node:path');
exports.createFirebaseTestServer = () => {
  const records = new Map(), denied = [];
  const config = { apiKey: 'AIza' + 'A'.repeat(35), authDomain: 'harugyeol-test.firebaseapp.com', projectId: 'harugyeol-test', appId: '1:123456:web:abcdef' };
  let commits = 0;
  async function attach(context) {
    await context.route('**/firebase-config.json', route => route.fulfill({ contentType: 'application/json', json: config }));
    await context.route('**/firebase-vendor.js', route => route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'test-firebase-sdk.mjs'), 'utf8') }));
    await context.route('**/__firebase_test__/**', async route => {
      const req = route.request(), action = new URL(req.url()).pathname.split('/').at(-1), user = req.headers()['x-test-user'], data = req.postDataJSON();
      const paths = [data.path, ...(data.writes || []).map(x => x.path), ...(data.paths || []), data.prefix].filter(Boolean);
      if (!user || paths.some(p => !p.startsWith('users/' + user + '/'))) {
        denied.push({ user, paths }); return route.fulfill({ status: 403, json: { error: 'not owner' } });
      }
      if (action === 'read') return route.fulfill({ json: { data: records.get(data.path)?.data || null, version: records.get(data.path)?.version || 0 } });
      if (action === 'commit') {
        for (const [key, version] of Object.entries(data.versions)) if ((records.get(key)?.version || 0) !== version) return route.fulfill({ status: 409, json: { error: 'changed' } });
        for (const row of data.writes) records.set(row.path, { data: structuredClone(row.data), version: (records.get(row.path)?.version || 0) + 1 });
        commits++; return route.fulfill({ json: { ok: true } });
      }
      if (action === 'list') return route.fulfill({ json: { rows: [...records.entries()].filter(([key]) => key.startsWith(data.prefix)).map(([key, row]) => ({ path: key, data: row.data })) } });
      if (action === 'delete') { data.paths.forEach(key => records.delete(key)); return route.fulfill({ json: { ok: true } }); }
      return route.fulfill({ status: 400, json: { error: 'unknown' } });
    });
  }
  return { attach, records, denied, config, get commits() { return commits; } };
};
