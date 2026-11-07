const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {useAuthenticatedUI}=require('./test-ui-auth.cjs');
const base=process.env.HARUGYEOL_TEST_URL||'http://127.0.0.1:8003';
const tracks=[
 {kind:'song',trackId:1,trackName:'밤편지',artistName:'아이유',collectionName:'Palette',artworkUrl100:'https://is1-ssl.mzstatic.com/image/thumb/test/100x100bb.jpg',trackViewUrl:'https://music.apple.com/kr/album/test/1?i=1'},
 {kind:'song',trackId:1,trackName:'밤편지',artistName:'아이유',collectionName:'Palette',trackViewUrl:'https://music.apple.com/kr/album/test/1?i=1'},
 {kind:'song',trackId:2,trackName:'밤편지',artistName:'아이유',collectionName:'Another album',trackViewUrl:'https://music.apple.com/kr/album/test/2?i=2'},
 {kind:'song',trackId:3,trackName:'Love <script>',artistName:'Test & Artist',collectionName:'Album',trackViewUrl:'https://music.apple.com/kr/album/test/3?i=3'},
 {kind:'song',trackId:4,trackName:'Unsafe',artistName:'Bad',trackViewUrl:'javascript:alert(1)'}
];
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const errors=[],context=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await useAuthenticatedUI(page);
 let mode='success',requests=0,held=[];
 await context.route('https://itunes.apple.com/search?**',async route=>{
  requests++;const u=new URL(route.request().url()),callback=u.searchParams.get('callback');
  assert.equal(u.searchParams.get('entity'),'song');assert.equal(u.searchParams.get('country'),'KR');assert.equal(u.searchParams.get('limit'),'25');
  if(mode==='error')return route.abort('failed');
  if(mode==='held'){held.push({route,callback});return}
  const data=mode==='empty'?[]:tracks;
  return route.fulfill({contentType:'application/javascript',body:`${callback}(${JSON.stringify({results:data})});`});
 });
 await context.route('https://**.mzstatic.com/**',route=>route.fulfill({status:404,body:''}));
 await page.goto(base);
 const open=async()=>page.click('[data-music-open]');
 const search=async q=>{await page.fill('#musicQuery',q);await page.click('[data-music-submit]')};
 await page.evaluate(()=>{setView('journal');openJournalEditor();state.journals[state.selectedDate]={...(state.journals[state.selectedDate]||{}),songTitle:'과거 노래',songArtist:'과거 가수',unknownField:{keep:true}};render()});
 assert((await page.locator('#journalSongSection').innerText()).includes('과거 노래'));
 await page.fill('#journalForm [name=headline]','노래와 함께');await page.fill('#journalForm [name=good]','기존 입력 보존');
 await open();await search('아이유');await page.waitForFunction(()=>document.querySelectorAll('[data-music-result]').length===2);
 assert.equal(requests,1);assert.equal(await page.locator('[data-music-result]').count(),2);assert.equal(await page.locator('#modal script').count(),0);
 assert((await page.locator('[data-music-results]').innerText()).includes('Love <script>'));
 await page.click('[data-music-result="0"]');
 let j=await page.evaluate(()=>state.journals[state.selectedDate]);
 assert.equal(j.song.title,'밤편지');assert.equal(j.song.artist,'아이유');assert.equal(j.song.album,'Palette');assert.equal(j.song.source,'itunes');assert(j.song.artworkUrl.startsWith('https://'));assert(!JSON.stringify(j.song).includes('data:'));assert.equal(j.good,'기존 입력 보존');assert.deepEqual(j.unknownField,{keep:true});assert.equal(j.songTitle,'과거 노래');
 assert.equal(await page.locator('#journalSongSection .music-song-card').getAttribute('target'),'_blank');
 await page.locator('#journalSongSection img').waitFor({state:'detached'});
 assert.equal(await page.locator('#journalSongSection .music-artwork svg').count(),1);
 assert.equal(await page.inputValue('#journalForm [name=headline]'),'노래와 함께');
 const date=await page.evaluate(()=>state.selectedDate);
 // Cached query does not call API again; cancelling does not replace the song.
 await open();await search('아이유');await page.waitForFunction(()=>document.querySelectorAll('[data-music-result]').length===2);assert.equal(requests,1);await page.click('#modal .modal-close');assert.equal(await page.evaluate(()=>state.journals[state.selectedDate].song.title),'밤편지');
 await page.reload();await page.evaluate(d=>{setView('journal');openJournalEditor(d)},date);assert((await page.locator('#journalSongSection').innerText()).includes('밤편지'));
 // Date isolation and old fields remain intact.
 await page.evaluate(d=>openJournalEditor(plusDays(d,1)),date);assert.equal(await page.locator('#journalSongSection .music-song-card').count(),0);
 await page.evaluate(d=>openJournalEditor(d),date);await open();
 await page.click('[data-music-provider="spotify"]');assert((await page.locator('[data-music-status]').innerText()).includes('자동 검색은 지원하지 않아요'));
 await page.fill('#musicLink','https://example.com/not-spotify');await page.fill('#musicTitle','Manual song');await page.fill('#musicArtist','Singer');await page.click('#musicManualForm button');assert.equal(await page.locator('#musicManualForm').count(),1);assert((await page.locator('[data-music-manual-error]').innerText()).includes('HTTPS'));
 await page.fill('#musicLink','https://open.spotify.com/track/example');await page.fill('#musicAlbum','Album');await page.click('#musicManualForm button');assert.equal(await page.locator('#modal').count(),0);assert.equal(await page.evaluate(()=>state.journals[state.selectedDate].song.source),'spotify');
 for(const [source,url] of [['soundcloud','https://soundcloud.com/artist/track'],['melon','https://www.melon.com/song/detail.htm?songId=123']]){
  await open();await page.click(`[data-music-provider="${source}"]`);await page.fill('#musicLink',url);await page.fill('#musicTitle',source+' title');await page.fill('#musicArtist','Artist');await page.click('#musicManualForm button');assert.equal(await page.evaluate(()=>state.journals[state.selectedDate].song.source),source);
 }
 assert.equal(requests,1);
 // Validation and service mismatch cannot save; javascript/data URLs never become links.
 await open();await page.fill('#musicLink','https://www.melon.com/song/1');await page.fill('#musicTitle','Bad art');await page.fill('#musicArtist','Artist');await page.fill('#musicArtwork','data:image/png;base64,abc');await page.click('#musicManualForm button');assert.equal(await page.locator('#musicManualForm').count(),1);await page.click('#modal .modal-close');
 // Deletion hides legacy fields rather than destroying old user data.
 page.once('dialog',d=>d.accept());await page.click('[data-music-remove]');assert.equal(await page.locator('#journalSongSection .music-song-card').count(),0);assert.equal(await page.evaluate(()=>state.journals[state.selectedDate].song),null);assert.equal(await page.evaluate(()=>state.journals[state.selectedDate].songTitle),'과거 노래');
 // Loading, error and empty are distinct, and provider switching cancels old searches.
 await page.waitForTimeout(4100);mode='error';await open();await search('오류 검색');await page.waitForFunction(()=>document.querySelector('[data-music-status]').classList.contains('music-error'));assert((await page.locator('[data-music-status]').innerText()).includes('연결하지 못했어요'));assert.equal(await page.locator('#journalSongSection .music-song-card').count(),0);
 await page.waitForTimeout(4100);mode='empty';await search('없는 노래');await page.waitForFunction(()=>document.querySelector('[data-music-status]').textContent.includes('검색 결과가 없어요'));assert.equal(await page.locator('[data-music-status].music-error').count(),0);
 await page.waitForTimeout(4100);mode='held';await search('느린 검색');await page.waitForFunction(()=>document.querySelector('[data-music-status]').textContent==='검색 중…');assert(await page.locator('[data-music-submit]').isDisabled());await page.click('[data-music-provider="spotify"]');for(const h of held)await h.route.fulfill({contentType:'application/javascript',body:`${h.callback}(${JSON.stringify({results:tracks})});`});held=[];assert.equal(await page.locator('[data-music-result]').count(),0);assert.equal(await page.locator('script[data-music-search]').count(),0);await page.click('#modal .modal-close');
 // Account/date change while a dialog is open is rejected.
 await open();await page.click('[data-music-provider="melon"]');await page.fill('#musicLink','https://www.melon.com/song/detail.htm?songId=5');await page.fill('#musicTitle','Stale');await page.fill('#musicArtist','Artist');await page.evaluate(()=>{state.selectedDate=plusDays(state.selectedDate,1)});await page.click('#musicManualForm button');assert.equal(await page.locator('#modal').count(),1);assert.equal(await page.evaluate(()=>state.journals[state.selectedDate]?.song?.title||''),'');await page.click('#modal .modal-close');await page.evaluate(d=>openJournalEditor(d),date);
 // Save again, export the actual JSON, restore it, and render without the API.
 mode='success';await page.waitForTimeout(4100);await open();await search('백업 검색');await page.waitForFunction(()=>document.querySelectorAll('[data-music-result]').length===2);await page.click('[data-music-result="0"]');
 const downloaded=page.waitForEvent('download');await page.evaluate(()=>exportData());const file=await downloaded;const backup=JSON.parse(await fs.readFile(await file.path(),'utf8'));assert.equal(backup.journals[date].song.title,'밤편지');assert.equal(backup.journals[date].songTitle,'과거 노래');
 await page.evaluate(()=>{state.journals={};save()});page.once('dialog',d=>d.accept());await page.evaluate(data=>importData(new File([JSON.stringify(data)],'music-backup.json',{type:'application/json'})),backup);await page.waitForFunction(d=>state.journals[d]?.song?.title==='밤편지',date);await page.evaluate(d=>{setView('journal');openJournalEditor(d)},date);
 await context.setOffline(true);await page.evaluate(()=>{journalScreen='detail';render()});assert((await page.locator('#journalSongSection').innerText()).includes('밤편지'));await context.setOffline(false);
 for(const appearance of ['light','dark'])for(const width of[320,390,760,1440]){
  await page.setViewportSize({width,height:844});await page.evaluate(appearance=>{state.appearance=appearance;applyTheme();openJournalEditor()},appearance);await open();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.click('[data-music-provider="soundcloud"]');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.click('#modal .modal-close');
 }
 // Storage failures must not replace the existing song or dismiss the form.
 await open();await page.click('[data-music-provider="spotify"]');await page.fill('#musicLink','https://open.spotify.com/track/failed');await page.fill('#musicTitle','저장 실패');await page.fill('#musicArtist','Singer');const previousSong=await page.evaluate(()=>JSON.stringify(state.journals[state.selectedDate].song));await page.evaluate(()=>{window.musicTestSave=save;save=()=>false});await page.click('#musicManualForm button');assert.equal(await page.locator('#musicManualForm').count(),1);assert.equal(await page.evaluate(()=>JSON.stringify(state.journals[state.selectedDate].song)),previousSong);await page.evaluate(()=>{save=window.musicTestSave;delete window.musicTestSave});await page.click('#modal .modal-close');
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS mocked official iTunes JSONP, duplicate/unsafe results, metadata/legacy/date/persistence, all service manual links, cover failure, loading/error/empty/cancel, stale session, real JSON backup/restore, offline saved song, light/dark 320–1440; no JS errors. Live API blocked by environment proxy.');
})().catch(e=>{console.error(e);process.exit(1)});
