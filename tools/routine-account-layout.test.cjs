const {chromium}=require('playwright');
const {useAuthenticatedUI}=require('./test-ui-auth.cjs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await useAuthenticatedUI(page);await page.goto(process.env.HARUGYEOL_TEST_URL||'http://127.0.0.1:8001');
 await page.evaluate(()=>{state.routines=[{id:'layout',title:'아침 운동과 가벼운 스트레칭',days:[],whenMode:'clock',time:'08:45',endTime:'09:45'}];save();setView('routines')});
 for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:850});
  const check=await page.locator('.routine-check').boundingBox(),title=await page.locator('.routine-title').boundingBox();
  assert(check.x+check.width<=title.x);assert(Math.abs(check.y-title.y)<12);
  assert.equal(await page.locator('.routine-time').evaluate(e=>getComputedStyle(e).fontSize),'12px');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.locator('.routine-check').click();assert.equal(await page.locator('.routine-check').getAttribute('aria-checked'),'true');
 await page.reload();await page.evaluate(()=>setView('routines'));assert.equal(await page.locator('.routine-check').getAttribute('aria-checked'),'true');
 await page.locator('.routine-check').click();assert.equal(await page.locator('.routine-check').getAttribute('aria-checked'),'false');
 assert.equal(await page.locator('.footer').count(),0);assert.equal(await page.locator('#importFile').count(),0);
 await page.evaluate(()=>document.querySelector('[data-action="openSettings"]').click());
 assert.equal(await page.locator('#importFile').count(),1);assert.equal(await page.locator('[data-action="exportData"]').count(),1);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS routine checkbox title alignment, compact time, toggle/reload, 320–1440px, backups in settings; no JS errors');
})().catch(e=>{console.error(e);process.exit(1)});
