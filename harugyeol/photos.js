/* Local-only photo overflow storage. Original JSON exports contain image data. */
(() => {
  'use strict';
  const prefix='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><rect width="120" height="90" rx="8" fill="#e8ece7"/><path d="M36 34h12l4-6h16l4 6h12v30H36Z" fill="none" stroke="#789681" stroke-width="3"/><circle cx="60" cy="49" r="9" fill="none" stroke="#789681" stroke-width="3"/></svg>')+'#harugyeol-photo-';
  const owner=()=>localStorage.getItem('harugyeol-cloud-owner'),isRef=value=>typeof value==='string'&&value.startsWith(prefix)&&/^[0-9a-f]{64}$/.test(value.slice(prefix.length));
  const error=()=>Error('기기 사진 저장소를 사용할 수 없어요. 기존 사진은 유지됩니다. 기기 여유 공간과 브라우저 저장 설정을 확인해 주세요.');
  function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open('harugyeol-photos',1);request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'id'});request.onerror=()=>reject(error());request.onblocked=()=>reject(error());request.onsuccess=()=>resolve(request.result)})}
  async function storePhotos(photos){
    const account=owner(),rows=[];
    for(const data of photos){if(isRef(data)||!String(data).startsWith('data:image/'))continue;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(account)+'\0'+data)),id=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');rows.push({id,owner:account,data})}
    if(account!==owner())throw Error('계정이 변경되어 사진 저장을 취소했습니다.');
    if(!rows.length)return [...photos];
    const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite'),store=tx.objectStore('photos');for(const row of rows)store.put(row);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(error())})}finally{db.close()}
    if(account!==owner())throw Error('계정이 변경되어 사진 저장을 취소했습니다.');
    const refs=new Map(rows.map(row=>[row.data,prefix+row.id]));return photos.map(data=>refs.get(data)||data);
  }
  async function readPhoto(ref,account=owner()){
    if(!isRef(ref))return ref;
    const db=await database();let row;try{row=await new Promise((resolve,reject)=>{const tx=db.transaction('photos'),req=tx.objectStore('photos').get(ref.slice(prefix.length));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(error())})}finally{db.close()}
    if(account!==owner())throw Error('계정이 변경되어 사진 읽기를 취소했습니다.');
    if(!row||row.owner!==account||!String(row.data).startsWith('data:image/'))throw Error('이 기기에서 사진 원본을 읽지 못했어요. 기존 기록은 유지됩니다. 사진이 포함된 JSON 백업이 있다면 복원해 주세요.');
    return row.data;
  }
  function photoArrays(data){const arrays=[];for(const journal of Object.values(data.journals||{})){if(Array.isArray(journal?.photos))arrays.push(journal.photos);for(const meal of Object.values(journal?.meals||{}))if(Array.isArray(meal?.photos))arrays.push(meal.photos)}return arrays}
  async function compactState(){
    const target=state,account=owner(),raw=[...new Set(photoArrays(target).flat().filter(src=>typeof src==='string'&&src.startsWith('data:image/')&&!isRef(src)))];if(!raw.length)return false;
    const refs=await storePhotos(raw);if(target!==state||account!==owner())return false;
    const mapping=new Map(raw.map((src,i)=>[src,refs[i]])),previous=state.journals,next=JSON.parse(JSON.stringify(previous));for(const array of photoArrays({journals:next}))for(let i=0;i<array.length;i++)array[i]=mapping.get(array[i])||array[i];
    state.journals=next;if(save({quiet:true})===false){state.journals=previous;return false}hydrate();return true;
  }
  async function packSnapshot(data){const copy=JSON.parse(JSON.stringify(data)),account=owner(),arrays=photoArrays(copy),raw=[...new Set(arrays.flat().filter(src=>typeof src==='string'&&src.startsWith('data:image/')&&!isRef(src)))],refs=await storePhotos(raw),mapping=new Map(raw.map((src,i)=>[src,refs[i]]));if(account!==owner())throw Error('계정이 변경되어 사진 복원을 취소했습니다.');for(const array of arrays)for(let i=0;i<array.length;i++)array[i]=mapping.get(array[i])||array[i];return copy}
  async function resolveSnapshot(data){const copy=JSON.parse(JSON.stringify(data)),account=owner();for(const array of photoArrays(copy))for(let i=0;i<array.length;i++)array[i]=await readPhoto(array[i],account);return copy}
  const pending=new WeakMap();
  async function hydrateImage(img){const ref=img.getAttribute('src');if(!isRef(ref)||pending.get(img)===ref)return;const account=owner();pending.set(img,ref);try{const src=await readPhoto(ref,account);if(img.isConnected&&owner()===account&&img.getAttribute('src')===ref){img.src=src;img.removeAttribute('data-photo-error')}}catch(e){if(img.isConnected&&owner()===account&&img.getAttribute('src')===ref){img.dataset.photoError='true';img.alt='사진을 읽지 못했어요';img.title=e.message}}finally{pending.delete(img)}}
  function hydrate(root=document){if(root.matches?.('img'))void hydrateImage(root);for(const img of root.querySelectorAll?.('img')||[])void hydrateImage(img)}
  new MutationObserver(changes=>{for(const change of changes){if(change.type==='attributes')void hydrateImage(change.target);else for(const node of change.addedNodes)if(node.nodeType===1)hydrate(node)}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src']});
  window.harugyeolPhotos={isRef,storePhotos,compactState,resolveSnapshot,packSnapshot,hydrate,readPhoto};hydrate();
})();
