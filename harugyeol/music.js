/* Diary song metadata only. No audio, tokens, scraping, or private API calls. */
(() => {
  'use strict';
  const SERVICES = {
    itunes: {name:'Apple Music / iTunes',filter:'iTunes 검색',hosts:['music.apple.com','itunes.apple.com'],find:q=>'https://music.apple.com/kr/search?term='+encodeURIComponent(q)},
    spotify: {name:'Spotify',filter:'Spotify · 링크',hosts:['open.spotify.com','spotify.link'],find:q=>'https://open.spotify.com/search/'+encodeURIComponent(q)},
    soundcloud: {name:'SoundCloud',filter:'SoundCloud · 링크',hosts:['soundcloud.com','on.soundcloud.com'],find:q=>'https://soundcloud.com/search/sounds?q='+encodeURIComponent(q)},
    melon: {name:'Melon',filter:'Melon · 링크',hosts:['melon.com'],find:q=>'https://www.melon.com/search/total/index.htm?q='+encodeURIComponent(q)}
  };
  const icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="5.5" cy="18.5" rx="3.5" ry="2.5"/><ellipse cx="17.5" cy="16.5" rx="3.5" ry="2.5"/></svg>';
  const cache=new Map();
  let current=null,lastRequest=0,serial=0;
  const str=value=>typeof value==='string'?value.trim().slice(0,500):'';
  function safeURL(value,source='',artwork=false){
    try{
      const u=new URL(typeof value==='string'&&value.trim().length<=2000?value.trim():'');
      if(u.protocol!=='https:'||u.username||u.password||u.port)return '';
      const host=u.hostname.toLowerCase();
      if(artwork){if(!host.includes('.')||host==='localhost'||/^[\d.]+$/.test(host)||host.endsWith('.local'))return ''}
      else if(!SERVICES[source]?.hosts.some(h=>host===h||host.endsWith('.'+h)))return '';
      return u.href;
    }catch{return ''}
  }
  function songFor(j){
    if(!j)return null;
    if(Object.hasOwn(j,'song')){
      const s=j.song;if(!s||typeof s!=='object'||!str(s.title))return null;
      const source=Object.hasOwn(SERVICES,s.source)?s.source:'';
      return {...s,source,title:str(s.title),artist:str(s.artist),album:str(s.album),artworkUrl:safeURL(s.artworkUrl,'',true),url:safeURL(s.url,source)};
    }
    return j.songTitle||j.songArtist?{title:str(j.songTitle)||'오늘의 노래',artist:str(j.songArtist),album:'',source:'',url:'',artworkUrl:'',legacy:true}:null;
  }
  function artwork(s){return `<span class="music-artwork">${icon}${s.artworkUrl?`<img src="${esc(s.artworkUrl)}" alt="${esc(s.album||s.title)} 앨범 커버" loading="lazy" referrerpolicy="no-referrer" data-music-artwork>`:''}</span>`}
  function cardHTML(s){
    const body=`${artwork(s)}<span class="music-card-copy"><strong>${esc(s.title)}</strong>${s.artist?`<span>${esc(s.artist)}</span>`:''}<small>${esc([s.album,SERVICES[s.source]?.name||'직접 기록'].filter(Boolean).join(' · '))}</small>${s.url?`<small class="music-service-link">${s.source==='itunes'?'iTunes에서 보기':'원곡 페이지 열기'} ↗</small>`:''}</span>`;
    return s.url?`<a class="music-song-card" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${body}</a>`:`<div class="music-song-card">${body}</div>`;
  }
  function sectionHTML(j,editable=false){
    const s=songFor(j);if(!editable&&!s)return '';
    return `<section class="journal-form-card journal-song-section" id="journalSongSection"><div class="music-section-heading"><h3>오늘의 노래</h3>${editable&&s?`<div class="row"><button type="button" class="iconbtn" data-music-open aria-label="오늘의 노래 변경">${actionIcon('edit')}</button><button type="button" class="iconbtn" data-music-remove aria-label="오늘의 노래 삭제">${actionIcon('delete')}</button></div>`:''}</div>${s?cardHTML(s):`<button type="button" class="music-empty" data-music-open>${icon}<span>노래 검색 · 링크 추가</span><span aria-hidden="true">＋</span></button>`}</section>`;
  }
  function refresh(date){
    if(view!=='journal'||state.selectedDate!==date)return;
    const section=document.getElementById('journalSongSection');
    if(section)section.outerHTML=sectionHTML(state.journals[date],journalScreen==='write');
    else if(journalScreen!=='write')render();
  }
  function sessionValid(session){
    return current===session&&session.overlay.isConnected&&state===session.state&&state.selectedDate===session.date&&localStorage.getItem('harugyeol-cloud-owner')===session.owner&&window.harugyeolCloud?.isSignedIn?.()!==false;
  }
  function saveSong(date,song,session){
    if(session&&!sessionValid(session)){toast('날짜나 계정이 바뀌었어요. 다시 열어 주세요.');return false}
    const form=document.getElementById('journalForm');
    if(form?.dataset.journalDate===date&&!autoSaveJournal(form))return false;
    const old=state.journals[date];
    state.journals[date]={...(old||{}),song,updatedAt:new Date().toISOString()};
    if(save()===false){if(old)state.journals[date]=old;else delete state.journals[date];return false}
    journalSaveStatus(date,'저장됨');refresh(date);return true;
  }
  function normalizeResults(data){
    if(!data||!Array.isArray(data.results))throw new Error('검색 응답을 읽을 수 없어요. 다시 시도해 주세요.');
    const ids=new Set(),songs=new Set(),out=[];
    for(const r of data.results){
      if(r.kind!=='song'||!str(r.trackName)||!str(r.artistName))continue;
      const url=safeURL(r.trackViewUrl,'itunes');if(!url)continue;
      const id=String(r.trackId||''),key=(str(r.trackName)+'|'+str(r.artistName)).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ');
      if((id&&ids.has(id))||songs.has(key))continue;
      ids.add(id);songs.add(key);
      const image=safeURL(r.artworkUrl100||r.artworkUrl60,'',true);
      out.push({version:1,source:'itunes',serviceName:SERVICES.itunes.name,providerId:id,title:str(r.trackName),artist:str(r.artistName),album:str(r.collectionName),artworkUrl:image&&new URL(image).hostname.endsWith('.mzstatic.com')?image:'',url});
    }
    return out;
  }
  function jsonp(session,query){
    return new Promise((resolve,reject)=>{
      const callback='harugyeolMusic_'+Date.now()+'_'+(++serial),script=document.createElement('script');let settled=false;
      const cleanup=()=>{clearTimeout(timer);script.remove();window[callback]=()=>{};setTimeout(()=>{delete window[callback]},60000);if(session.cancel===cancel)session.cancel=null};
      const finish=(error,data)=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve(data)};
      const cancel=()=>finish(new DOMException('검색 취소','AbortError'));
      const timer=setTimeout(()=>finish(new Error('검색 응답이 늦어지고 있어요. 다시 시도하거나 링크로 추가해 주세요.')),15000);
      window[callback]=data=>finish(null,data);
      script.onerror=()=>finish(new Error('음악 검색에 연결하지 못했어요. 인터넷 연결을 확인하거나 링크로 추가해 주세요.'));
      const params=new URLSearchParams({term:query,media:'music',entity:'song',country:'KR',limit:'25',callback});
      script.src='https://itunes.apple.com/search?'+params;script.referrerPolicy='no-referrer';script.dataset.musicSearch='true';session.cancel=cancel;document.head.append(script);
    });
  }
  function status(session,text,error=false){
    if(!sessionValid(session))return;
    const el=session.overlay.querySelector('[data-music-status]');el.textContent=text;el.classList.toggle('music-error',error);el.setAttribute('role',error?'alert':'status');
  }
  function resultHTML(s,index){return `<div class="music-result"><button type="button" class="music-result-select" data-music-result="${index}" aria-label="${esc(s.title+' · '+s.artist)} 선택">${artwork(s)}<span class="music-card-copy"><strong>${esc(s.title)}</strong><span>${esc(s.artist)}</span><small>${esc(s.album)}</small></span><span class="music-result-plus" aria-hidden="true">＋</span></button><a class="music-result-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">iTunes에서 보기 ↗</a></div>`}
  async function search(session){
    if(!sessionValid(session))return;
    const query=session.overlay.querySelector('[name=musicQuery]').value.trim();
    session.query=query;updateExternalLink(session);
    if(session.source!=='itunes'){window.open(SERVICES[session.source].find(query),'_blank','noopener,noreferrer');status(session,'서비스에서 곡을 찾은 뒤 링크와 정보를 입력해 주세요.');return}
    if(query.length<2){status(session,'노래 제목이나 가수를 두 글자 이상 입력해 주세요.',true);return}
    session.cancel?.();const request=++session.request,results=session.overlay.querySelector('[data-music-results]'),button=session.overlay.querySelector('[data-music-submit]');
    const key=query.normalize('NFKC').toLocaleLowerCase(),entry=cache.get(key),cached=entry&&Date.now()-entry.time<300000?entry:null;
    if(!cached&&Date.now()-lastRequest<4000){status(session,'잠시 후 다시 검색해 주세요. 검색은 4초에 한 번 할 수 있어요.',true);return}
    results.replaceChildren();results.setAttribute('aria-busy','true');button.disabled=true;status(session,'검색 중…');
    try{
      let songs;
      if(cached)songs=cached.songs;
      else{lastRequest=Date.now();songs=normalizeResults(await jsonp(session,query));cache.set(key,{time:Date.now(),songs});if(cache.size>24)cache.delete(cache.keys().next().value)}
      if(!sessionValid(session)||request!==session.request||session.source!=='itunes')return;
      session.results=songs;results.innerHTML=songs.map(resultHTML).join('');status(session,songs.length?`${songs.length}곡을 찾았어요. 저장할 곡을 선택해 주세요.`:'검색 결과가 없어요. 다른 검색어나 링크 입력을 이용해 주세요.');
    }catch(error){if(error.name!=='AbortError'&&sessionValid(session)&&request===session.request)status(session,error.message||'검색에 실패했어요. 링크로도 추가할 수 있어요.',true)}
    finally{if(sessionValid(session)&&request===session.request){results.setAttribute('aria-busy','false');button.disabled=false}}
  }
  function updateExternalLink(session){
    const query=session.overlay.querySelector('[name=musicQuery]').value.trim(),link=session.overlay.querySelector('[data-music-external]');link.href=SERVICES[session.source].find(query);link.textContent=SERVICES[session.source].name+'에서 곡 찾기 ↗';
  }
  function manualHTML(session){
    const old=songFor(state.journals[session.date]),s=old&&(old.source===session.source||old.legacy)?old:{};
    return `<form id="musicManualForm" class="stack"><div class="field"><label for="musicLink">곡 링크</label><input id="musicLink" type="url" name="url" required maxlength="1500" placeholder="https://…" value="${esc(s.url||'')}"></div><div class="music-manual-pair"><div class="field"><label for="musicTitle">노래 제목</label><input id="musicTitle" name="title" required maxlength="300" value="${esc(s.title||'')}"></div><div class="field"><label for="musicArtist">아티스트</label><input id="musicArtist" name="artist" required maxlength="300" value="${esc(s.artist||'')}"></div></div><div class="field"><label for="musicAlbum">앨범명 · 선택</label><input id="musicAlbum" name="album" maxlength="300" value="${esc(s.album||'')}"></div><div class="field"><label for="musicArtwork">앨범 커버 URL · 선택</label><input id="musicArtwork" type="url" name="artworkUrl" maxlength="1500" placeholder="https://…" value="${esc(s.artworkUrl||'')}"><small class="muted">사용이 허용된 이미지 주소를 넣어 주세요. 없으면 음악 아이콘으로 표시해요.</small></div><p class="small muted" data-music-manual-error role="alert"></p><button type="submit" class="btn">이 노래 선택</button></form>`;
  }
  function showProvider(session,source){
    if(!sessionValid(session))return;
    session.cancel?.();session.request++;session.source=source;session.results=[];
    session.overlay.querySelectorAll('[data-music-provider]').forEach(b=>{const on=b.dataset.musicProvider===source;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
    const results=session.overlay.querySelector('[data-music-results]');results.replaceChildren();results.setAttribute('aria-busy','false');session.overlay.querySelector('[data-music-submit]').disabled=false;
    session.overlay.querySelector('[data-music-submit]').textContent=source==='itunes'?'검색':'사이트 검색';
    const manual=session.overlay.querySelector('[data-music-manual]');manual.innerHTML=source==='itunes'?`<details><summary>링크로 직접 추가</summary>${manualHTML(session)}</details>`:manualHTML(session);
    status(session,source==='itunes'?'iTunes에서 노래 제목이나 아티스트를 검색해 보세요.':SERVICES[source].name+'는 링크로 추가할 수 있어요. 자동 검색은 지원하지 않아요.');updateExternalLink(session);
    manual.querySelector('form').onsubmit=e=>{
      e.preventDefault();if(!sessionValid(session))return;
      const f=new FormData(e.target),url=safeURL(f.get('url'),session.source),artworkUrl=safeURL(f.get('artworkUrl'),'',true),error=e.target.querySelector('[data-music-manual-error]');
      if(!url){error.textContent=SERVICES[session.source].name+'의 HTTPS 곡 링크를 입력해 주세요.';return}
      if(str(f.get('artworkUrl'))&&!artworkUrl){error.textContent='커버 이미지는 HTTPS 이미지 주소를 입력해 주세요.';return}
      const song={version:1,source:session.source,serviceName:SERVICES[session.source].name,title:str(f.get('title')),artist:str(f.get('artist')),album:str(f.get('album')),artworkUrl,url,manual:true};
      if(saveSong(session.date,song,session)){session.overlay.remove();toast('오늘의 노래를 저장했어요.')}
    };
  }
  function open(){
    const form=document.getElementById('journalForm');if(form&&!autoSaveJournal(form))return;
    const date=state.selectedDate,target=state,owner=localStorage.getItem('harugyeol-cloud-owner');
    modal('오늘의 노래',`<div class="music-search-dialog"><form id="musicSearchForm" class="music-search-form"><label class="sr-only" for="musicQuery">노래 제목 또는 아티스트</label><input id="musicQuery" name="musicQuery" type="search" maxlength="100" placeholder="노래 제목이나 아티스트" autocomplete="off"><button type="submit" class="btn" data-music-submit>검색</button></form><div class="music-provider-filters" role="group" aria-label="음악 서비스">${Object.entries(SERVICES).map(([key,s])=>`<button type="button" class="chip" data-music-provider="${key}" aria-pressed="false">${s.filter}</button>`).join('')}</div><p class="small muted music-search-status" data-music-status role="status" aria-live="polite"></p><div class="music-results" data-music-results aria-busy="false"></div><a class="music-external-link" data-music-external target="_blank" rel="noopener noreferrer">서비스에서 곡 찾기 ↗</a><div class="music-manual" data-music-manual></div><p class="small muted music-attribution">검색 정보·앨범 커버: iTunes / Apple. 음악 재생 없이 원곡 페이지로 연결해요.</p></div>`);
    const overlay=document.getElementById('modal');overlay.classList.add('music-modal');
    const session={date,state:target,owner,overlay,source:'itunes',results:[],request:0,cancel:null};current=session;
    const observer=new MutationObserver(()=>{if(!overlay.isConnected){session.cancel?.();if(current===session)current=null;observer.disconnect()}});observer.observe(document.body,{childList:true});
    overlay.querySelector('#musicSearchForm').onsubmit=e=>{e.preventDefault();search(session)};
    overlay.querySelector('[name=musicQuery]').addEventListener('input',()=>updateExternalLink(session));
    overlay.addEventListener('click',e=>{
      const provider=e.target.closest('[data-music-provider]');if(provider){showProvider(session,provider.dataset.musicProvider);return}
      const result=e.target.closest('[data-music-result]');if(result){const s=session.results[Number(result.dataset.musicResult)];if(s&&saveSong(date,{...s},session)){overlay.remove();toast('오늘의 노래를 저장했어요.')}}
    });
    showProvider(session,songFor(state.journals[date])?.source||'itunes');
  }
  document.addEventListener('error',e=>{if(e.target.matches?.('img[data-music-artwork]'))e.target.remove()},true);
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-music-open]')){open();return}
    if(e.target.closest('[data-music-remove]')){
      const date=state.selectedDate;if(!confirm('오늘의 노래를 삭제할까요?'))return;
      if(saveSong(date,null))toast('오늘의 노래를 삭제했어요.');
    }
  });
  window.harugyeolMusic={sectionHTML};
})();
