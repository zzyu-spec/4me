// Long press works with touch without blocking ordinary vertical scrolling.
export function installPressDrag({getScope,getItem,onDrop,onHold}){
 let press=null,timer,active=false,ghost=null,target=null,mode='',suppressedUntil=0,scrollFrame=0;
 const rowAt=(x,y)=>document.elementFromPoint(x,y)?.closest('[data-drag-id]');
 function clearMark(){document.querySelectorAll('.drop-inside,.drop-before,.drop-after').forEach(e=>e.classList.remove('drop-inside','drop-before','drop-after'))}
 function stop(){clearTimeout(timer);cancelAnimationFrame(scrollFrame);scrollFrame=0;press?.row.classList.remove('drag-source');clearMark();ghost?.remove();ghost=null;press=null;target=null;mode='';active=false;document.body.classList.remove('drag-active')}
 function autoScroll(){if(!active||!press)return;const scroller=press.row.closest('dialog')||document.scrollingElement,rect=scroller===document.scrollingElement?{top:0,bottom:innerHeight}:scroller.getBoundingClientRect(),y=press.y,delta=y<rect.top+65?-9:y>rect.bottom-65?9:0;if(delta){scroller.scrollTop+=delta;mark(press.x,press.y)}scrollFrame=requestAnimationFrame(autoScroll)}
 function mark(x,y){if(!active)return;clearMark();target=null;mode='';const row=rowAt(x,y);if(!row||row.dataset.dragId===press.id)return;const item=getItem(row.dataset.dragId);if(!item||item.deleted||item.type==='space')return;const r=row.getBoundingClientRect(),ratio=(y-r.top)/r.height;mode=ratio<.25?'before':ratio>.75?'after':'inside';target=row.dataset.dragId;row.classList.add('drop-'+mode);ghost.textContent=mode==='inside'?'「'+item.title+'」안으로 이동':(mode==='before'?'앞으로 이동':'뒤로 이동')+' · '+item.title}
 function begin(row,x,y){if(press)return;const item=getItem(row.dataset.dragId),scope=getScope();if(!scope||!item||item.deleted||item.type==='space')return;press={id:item.id,row,x,y,startX:x,startY:y,scope};timer=setTimeout(()=>{if(!press||getScope()!==scope){stop();return}active=true;row.classList.add('drag-source');document.body.classList.add('drag-active');ghost=document.createElement('div');ghost.className='drag-bubble';ghost.setAttribute('role','status');ghost.textContent='끌어서 이동 · 놓고 위치 선택';(row.closest('dialog')||document.body).append(ghost);move(x,y);scrollFrame=requestAnimationFrame(autoScroll)},450)}
 function move(x,y){if(!press)return;if(!active){if(Math.hypot(x-press.startX,y-press.startY)>9)stop();return}press.x=x;press.y=y;ghost.style.left=Math.max(12,Math.min(x+10,innerWidth-240))+'px';ghost.style.top=Math.max(12,Math.min(y+18,innerHeight-62))+'px';mark(x,y)}
 function end(cancel=false){if(!press)return;const wasActive=active,id=press.id,scope=press.scope,destination=target,dropMode=mode,stationary=Math.hypot(press.x-press.startX,press.y-press.startY)<10;stop();if(!wasActive)return;suppressedUntil=Date.now()+700;if(cancel||getScope()!==scope)return;if(destination)Promise.resolve(onDrop(id,destination,dropMode)).catch(()=>{});else if(stationary)onHold(id)}
 function eligible(e){const row=e.target.closest('[data-drag-id]');return row&&!e.target.closest('.row-star,.child-edit,input,textarea,select')?row:null}
 document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0)return;const row=eligible(e);if(row)begin(row,e.clientX,e.clientY)});
 document.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')move(e.clientX,e.clientY)});
 document.addEventListener('pointerup',e=>{if(e.pointerType!=='touch')end()});document.addEventListener('pointercancel',e=>{if(e.pointerType!=='touch')end(true)});
 document.addEventListener('touchstart',e=>{if(e.touches.length!==1){end(true);return}const row=eligible(e);if(row){const t=e.touches[0];begin(row,t.clientX,t.clientY)}},{passive:true});
 document.addEventListener('touchmove',e=>{if(e.touches.length!==1){end(true);return}if(active&&e.cancelable)e.preventDefault();const t=e.touches[0];move(t.clientX,t.clientY)},{passive:false});
 document.addEventListener('touchend',()=>end());document.addEventListener('touchcancel',()=>end(true));
 document.addEventListener('click',e=>{if(Date.now()<suppressedUntil){e.preventDefault();e.stopImmediatePropagation()}},true);
 document.addEventListener('contextmenu',e=>{if(eligible(e))e.preventDefault()});document.addEventListener('dragstart',e=>{if(eligible(e))e.preventDefault()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&press){e.preventDefault();e.stopImmediatePropagation();end(true)}},true);
 window.addEventListener('blur',()=>end(true));document.addEventListener('visibilitychange',()=>{if(document.hidden)end(true)});
 return {get active(){return active}};
}
