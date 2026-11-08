import {account,friendly} from './account.mjs';
import {totals,won,validate} from './model.mjs';
let context,connecting=false,user=null,entries=[],off,phase='loading',error='';
function targets(){return [...document.querySelectorAll('[data-record-dialog="spending"] .journal-record-content,.journal-detail-panel')];}
function update(){
  const date=state.selectedDate;
  for(const target of targets()){
    const spending=target.closest('[data-record-dialog="spending"]');
    const textarea=spending?.querySelector('#journalSpending');
    if(textarea&&!textarea.closest('.ledger-consumption-memo')){
      const label=document.createElement('label');label.className='ledger-consumption-memo';
      const caption=document.createElement('span');caption.textContent='소비 메모 · 선택';label.append(caption);
      textarea.before(label);label.append(textarea);
    }
    let block=target.querySelector('.ledger-journal-summary');
    if(!block){block=document.createElement('section');block.className='ledger-journal-summary';block.setAttribute('aria-label','가계부 지출');if(spending)target.prepend(block);else target.append(block)}
    const day=entries.filter(x=>!x.deleted&&x.kind==='expense'&&x.date===date),signature=JSON.stringify([date,user?.uid,phase,error,day]);
    if(block.dataset.signature===signature)continue;
    block.dataset.signature=signature;block.replaceChildren();
    const heading=document.createElement('h3');heading.textContent='가계부 지출';block.append(heading);
    const amount=document.createElement(phase==='ready'?'strong':'p');
    amount.className=phase==='ready'?'ledger-journal-amount':'ledger-journal-status';
    amount.textContent=phase==='ready'?won(totals(day).expense):phase==='loading'?'지출을 불러오는 중…':phase==='signed-out'?'로그인하면 지출을 확인할 수 있어요.':'가계부를 연결하지 못했어요.';
    block.append(amount);
    if(phase==='ready'){
      if(day.length){
        const list=document.createElement('ul');list.className='ledger-journal-entries';
        for(const item of day.slice(0,5)){
          const row=document.createElement('li'),title=document.createElement('span'),cost=document.createElement('span');
          title.textContent=item.title;cost.textContent=won(item.amount);row.append(title,cost);list.append(row);
        }
        if(day.length>5){const more=document.createElement('li');more.className='ledger-journal-more';more.textContent='+'+(day.length-5)+'건';list.append(more)}
        block.append(list);
      }else{const empty=document.createElement('p');empty.className='ledger-journal-status';empty.textContent='등록한 지출이 없어요.';block.append(empty)}
    }
    if(phase==='error'){
      const detail=document.createElement('p');detail.className='ledger-journal-error';detail.textContent=error;block.append(detail);
    }
    const actions=document.createElement('div');actions.className='ledger-journal-actions';
    const link=document.createElement('a');link.className='btn secondary';link.href='ledger/?date='+encodeURIComponent(date);link.textContent='가계부 열기';actions.append(link);
    if(phase==='error'){const retry=document.createElement('button');retry.type='button';retry.className='btn ghost';retry.textContent='다시 연결';retry.dataset.ledgerReconnect='';actions.append(retry)}
    block.append(actions);
  }
}
function watch(){off?.();off=null;entries=[];if(!user?.emailVerified){phase='signed-out';update();return;}phase='loading';update();const uid=user.uid;off=context.sdk.onSnapshot(context.sdk.collection(context.db,'users',user.uid,'ledgerEntries'),{includeMetadataChanges:true},snapshot=>{if(user?.uid!==uid)return;try{entries=snapshot.docs.map(doc=>{const item=validate(doc.data());if(item.id!==doc.id)throw Error('가계부 기록 형식을 확인해 주세요.');return item});phase=snapshot.metadata.fromCache?'loading':'ready';if(snapshot.metadata.fromCache&&entries.length)phase='ready';update()}catch(e){phase='error';error=e.message;update()}},e=>{if(user?.uid!==uid)return;entries=[];phase='error';error=e.code==='permission-denied'?'가계부 접근 권한을 확인하지 못했어요. 같은 계정으로 로그인했는지 확인한 뒤 다시 연동해 주세요.':'가계부를 불러오지 못했어요. 연결을 확인하고 가계부에서 다시 시도해 주세요.';update()});}
async function refresh(){if(!targets().length)return;update();if(context||connecting)return;connecting=true;try{context=await account();context.auth.onAuthStateChanged(next=>{user=next;watch()})}catch(e){phase='error';error=friendly(e);if(e.code)error+=' (오류 코드: '+e.code+')';update()}finally{connecting=false}}
new MutationObserver(()=>refresh()).observe(document.querySelector('#main'),{childList:true,subtree:true});refresh();

document.addEventListener('click',e=>{if(!e.target.closest('[data-ledger-reconnect]'))return;if(context)watch();else refresh()});
window.addEventListener('online',()=>{if(phase==='error'||phase==='loading'){if(context)watch();else refresh()}});
