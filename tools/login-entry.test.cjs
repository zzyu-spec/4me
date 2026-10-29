const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createFirebaseTestServer } = require('./test-firebase-server.cjs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  const server = createFirebaseTestServer(), errors = [];
  const base = process.env.HARUGYEOL_TEST_URL || 'http://127.0.0.1:8001';
  const contexts = [];
  async function client() {
    const context = await browser.newContext({ viewport: { width: 390, height: 850 }, serviceWorkers: 'allow', acceptDownloads: true });
    contexts.push(context); await server.attach(context);
    const p = await context.newPage(); p.on('pageerror', e => errors.push(e.message)); p.on('dialog', d => d.accept());
    await p.goto(base); await p.waitForSelector('#cloudLoginForm'); assert.equal(await p.locator('#cloudConfigForm,.cloud-connection-details,#cloudPanel a[href="firebase-setup.html"]').count(),0); return p;
  }
  async function login(p, email, password = 'test-password') {
    if (!await p.locator('#cloudLoginForm').count()) await p.evaluate(() => harugyeolCloud.open());
    await p.fill('#cloudEmail', email); await p.fill('#cloudPassword', password);
    await p.click('#cloudLoginForm button[value="login"]');
  }
  async function signedIn(p) { await p.waitForFunction(() => harugyeolCloud.isSignedIn()); }
  async function logout(p) { await p.evaluate(() => harugyeolCloud.open()); assert.equal(await p.locator('#cloudConfigForm,.cloud-connection-details,#cloudPanel a[href="firebase-setup.html"]').count(),0); await p.click('[data-cloud="logout"]'); await p.waitForSelector('#cloudLoginForm'); }
  const a = await client();
  assert(!await a.locator('#main').isVisible()); assert(!await a.locator('#nav').isVisible());
  await a.click('[data-cloud-back]');
  assert(await a.locator('#authGate').isVisible()); assert(!await a.locator('#main').isVisible());
  await a.click('[data-auth-open]');
  await login(a, 'alice@example.test', 'wrong-password');
  await a.waitForFunction(() => !document.querySelector('#cloudLoginForm button').disabled);
  assert(!await a.locator('#main').isVisible()); assert.equal(server.commits, 0);
  await login(a, 'pending@example.test');
  await a.waitForFunction(() => document.querySelector('#cloudStatus').textContent.includes('가입 확인'));
  assert(!await a.locator('#main').isVisible());
  // Existing local data is kept and connected only after a verified login.
  await a.evaluate(() => {
    const d=state.selectedDate;
    state.habitGroups=[{id:'alice-group',name:'아침 준비',emoji:'☀️',color:'#789681'}];state.routines=[{id:'alice-habit',title:'물 마시기',days:[],whenMode:'none',groupId:'alice-group'}];
    state.todos=[{id:'alice-local',title:'기존 기기 기록',date:d,status:'open',period:'daily'}];
    state.journals[d]={text:'개인 일기',photos:['data:image/png;base64,LOCAL_PHOTO']}; save();
    diaryDrafts[d]={text:'아직 작성 중인 일기'};storeDiaryDrafts();
  });
  await login(a, 'alice@example.test'); await signedIn(a);
  await a.waitForFunction(() => !document.querySelector('#cloudPanel'));
  assert(await a.locator('#main').isVisible());
  await a.waitForFunction(() => JSON.parse(localStorage.getItem('harugyeol-cloud-meta:harugyeol-test|alice')).revision >= 1);
  assert.equal(server.records.get('users/alice/planner/current').data.snapshot.todos[0].title,'기존 기기 기록');
  assert(!JSON.stringify(server.records.get('users/alice/planner/current').data).includes('LOCAL_PHOTO'));
  const date=await a.evaluate(()=>state.selectedDate);
  await a.reload(); await signedIn(a);
  assert(await a.locator('#main').isVisible()); assert.equal(await a.locator('#cloudLoginForm').count(),0);
  await a.click('[data-action="openSettings"]');await a.click('[data-settings-page="account"]');await a.click('[data-action="openCloudSettings"]');await a.click('[data-cloud-back]');assert.equal(await a.locator('#modal h2').textContent(),'계정 · 백업');assert(await a.evaluate(()=>harugyeolCloud.isSignedIn()));await a.locator('#modal').click({position:{x:2,y:2}});
  // Authenticated sessions retain offline access to their existing device records.
  await a.evaluate(()=>navigator.serviceWorker.ready);
  await a.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await contexts[0].setOffline(true); await a.reload(); await signedIn(a);
  assert.equal(await a.evaluate(()=>state.todos[0].title),'기존 기기 기록');
  await contexts[0].setOffline(false);
  // Backup controls live in settings and include device photos.
  assert.equal(await a.locator('.footer').count(),0);
  await a.click('[data-action="openSettings"]');await a.click('[data-settings-page="account"]');
  const downloadPromise=a.waitForEvent('download'); await a.click('[data-action="exportData"]');
  const backup=JSON.parse(fs.readFileSync(await (await downloadPromise).path(),'utf8'));
  assert.equal(backup.journals[date].photos[0],'data:image/png;base64,LOCAL_PHOTO');
  assert(!JSON.stringify(backup).includes('test-password'));
  await a.locator('#modal').click({position:{x:2,y:2}});
  await logout(a); assert(!await a.locator('#main').isVisible());
  assert.equal(await a.evaluate(()=>JSON.parse(localStorage.getItem('harugyeol-v1')).todos[0].title),'기존 기기 기록');
  // A different account never displays or uploads Alice's local records or drafts.
  await login(a,'bob@example.test'); await signedIn(a);
  await a.waitForFunction(()=>!document.querySelector('#cloudPanel'));
  assert.equal(await a.evaluate(()=>state.todos.length),0);
  assert.equal(await a.evaluate(()=>Object.keys(diaryDrafts).length),0);
  assert(!JSON.stringify(server.records.get('users/bob/planner/current').data).includes('기존 기기 기록'));
  await a.evaluate(()=>{state.todos.push({id:'bob-local',title:'밥의 기록',date:todayISO(),status:'open'});save()});
  await a.evaluate(()=>harugyeolCloud.sync());
  await logout(a); await login(a,'alice@example.test'); await signedIn(a);
  await a.waitForFunction(()=>!document.querySelector('#cloudPanel'));
  assert(await a.evaluate(()=>state.todos.some(t=>t.id==='alice-local')));
  assert(!await a.evaluate(()=>state.todos.some(t=>t.id==='bob-local')));
  assert.equal(await a.evaluate(d=>state.journals[d].photos[0],date),'data:image/png;base64,LOCAL_PHOTO');
  assert.equal(await a.evaluate(d=>diaryDrafts[d].text,date),'아직 작성 중인 일기');
  // A clean second device automatically receives the account's text snapshot.
  const second=await client(); await login(second,'alice@example.test'); await signedIn(second);
  await second.waitForFunction(()=>state.todos.some(t=>t.id==='alice-local'));
  assert.equal(await second.evaluate(d=>state.journals[d].photos.length,date),0);
  assert.equal(await second.evaluate(()=>state.habitGroups[0].name),'아침 준비');assert.equal(await second.evaluate(()=>state.routines[0].groupId),'alice-group');
  // Existing guest text and server text conflict instead of being overwritten.
  const conflict=await client();
  await conflict.evaluate(()=>{state.todos=[{id:'guest',title:'덮어쓰면 안 되는 기록',date:todayISO(),status:'open'}];save()});
  await login(conflict,'alice@example.test'); await signedIn(conflict);
  await conflict.waitForSelector('[data-cloud="useRemote"]');
  assert.equal(await conflict.evaluate(()=>state.todos[0].id),'guest');
  await conflict.click('[data-cloud="useRemote"]');
  await conflict.waitForFunction(()=>state.todos.some(t=>t.id==='alice-local'));
  // Even an empty custom folder is user data and must trigger the initial conflict choice.
  const folderOnly=await client();await folderOnly.evaluate(()=>{state.habitGroups=[{id:'unsynced-folder',name:'지켜야 할 모음'}];save()});await login(folderOnly,'alice@example.test');await signedIn(folderOnly);await folderOnly.waitForSelector('[data-cloud="useRemote"]');assert.equal(await folderOnly.evaluate(()=>state.habitGroups[0].id),'unsynced-folder');
  // SDK session expiry locks navigation immediately, with local records intact.
  await second.evaluate(async()=>{const sdk=await import('./firebase-vendor.js');sdk.__expireAuth()});
  await second.waitForSelector('#cloudLoginForm'); assert(!await second.locator('#main').isVisible());
  assert(await second.evaluate(()=>state.todos.some(t=>t.id==='alice-local')));
  assert.deepEqual(server.denied,[]);assert.deepEqual(errors,[]);
  for(const context of contexts)await context.close();await browser.close();
  console.log('PASS login gate, failed/unverified sign-in, cached/offline session, auto sync/photo exclusion, settings photo backup, logout lock, account+draft isolation and restore, second device, conflict safety, auth expiry; mocked SDK, no real account changes, no JS errors');
})().catch(error=>{console.error(error);process.exit(1)});
