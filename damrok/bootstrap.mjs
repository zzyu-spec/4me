const VERSION=/^[a-f0-9]{64}$/;
export function releaseInfo(value){
 if(!value||!VERSION.test(value.version))throw Error('Invalid release');
 const base='releases/'+value.version+'/';
 if(value.entry!==base+'app.mjs'||value.stylesheet!==base+'style.css')throw Error('Invalid release paths');
 return value;
}
export function createUpdater({currentVersion,fetchRelease,canReload,onPending=()=>{},reload}){
 let pending=null,checking=false,applying=false,reloading=false;
 async function apply(){if(!pending||applying||reloading)return;applying=true;try{if(!await canReload())return;reloading=true;if(await reload(pending.version)===false)reloading=false}catch{reloading=false}finally{applying=false}}
 async function check(){if(checking||reloading)return;checking=true;try{const latest=releaseInfo(await fetchRelease());pending=latest.version===currentVersion?null:latest;onPending(!!pending);await apply()}catch{/* Offline or an incomplete deployment: keep the current app and all data. */}finally{checking=false}}
 return {check,apply,get pending(){return !!pending}};
}
async function readRelease(){const url=new URL('release.json',import.meta.url);url.searchParams.set('check',Date.now());const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('Release unavailable');return releaseInfo(await r.json())}finally{clearTimeout(timeout)}}
async function boot(){
 const stamp=document.querySelector('meta[name="damrok-release"]')?.content||'development';
 const notice=document.createElement('div');notice.className='update-notice';notice.role='status';notice.hidden=true;document.body.append(notice);
 async function reload(version){const url=new URL(location.href);url.searchParams.set('__damrok_update',version);url.searchParams.set('__damrok_check',Date.now());try{const r=await fetch(url.href,{cache:'no-store'});if(!r.ok)return false;const html=await r.text();if(!html.includes('name="damrok-release" content="'+version+'"'))return false;location.replace(url.href);return true}catch{return false}}
 let release;try{release=await readRelease()}catch{release=VERSION.test(stamp)?{version:stamp,entry:`releases/${stamp}/app.mjs`,stylesheet:`releases/${stamp}/style.css`}:null}
 // Refresh the HTML too: a new app may require new markup. Use a distinct URL once,
 // then restore the original address after the matching release has loaded.
 if(release&&VERSION.test(stamp)&&release.version!==stamp){notice.textContent='새 화면을 준비하고 있어요. 저장한 기록은 그대로 유지됩니다.';notice.hidden=false;const retry=async()=>{if(!await reload(release.version))setTimeout(retry,5000)};retry();return}
 const currentVersion=release?.version||stamp;
 if(release){document.querySelector('link[rel="stylesheet"]').href=new URL(release.stylesheet,import.meta.url).href}
 try{await import(new URL(release?.entry||'app.mjs',import.meta.url).href)}catch{notice.textContent='화면을 불러오지 못했어요. 연결을 확인하고 새로고침해 주세요.';notice.hidden=false;return}
 const clean=new URL(location.href);if(clean.searchParams.has('__damrok_update')){clean.searchParams.delete('__damrok_update');clean.searchParams.delete('__damrok_check');history.replaceState(history.state,'',clean.href)}
 const updater=createUpdater({currentVersion,fetchRelease:readRelease,canReload:()=>navigator.onLine!==false&&(globalThis.damrokLifecycle?.canReload()??false),onPending:yes=>{notice.textContent='새 화면이 준비됐어요. 작업을 마치고 열린 창을 닫으면 자동으로 적용됩니다.';notice.hidden=!yes},reload});
 const check=()=>{if(document.visibilityState!=='hidden')updater.check()};
 setInterval(check,30000);setInterval(()=>{if(updater.pending&&document.visibilityState!=='hidden')updater.apply()},1000);
 window.addEventListener('focus',check);window.addEventListener('online',check);document.addEventListener('visibilitychange',check);document.addEventListener('close',()=>updater.apply(),true);
 check();
}
if(typeof document!=='undefined')boot();
