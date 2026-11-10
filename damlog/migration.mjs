import {legacyDatabase} from './account.mjs';
import {downloadRecord} from './cloud.mjs';
import {inspectLegacyLocal,mergeLegacy,validateItem} from './store.mjs';
export class Migration{
 constructor(cloud){this.cloud=cloud}
 context(){const c=this.cloud;if(!c.store||!c.user)throw Error('먼저 로그인해 주세요.');const store=c.store,epoch=c.generation;return {store,guard:()=>c.guard(epoch,store),sdk:c.sdk,app:c.app,uid:c.user.uid}}
 async inspectLocal(){const x=this.context(),records=await inspectLegacyLocal(x.uid);x.guard();return records}
 async inspectServer(){const x=this.context(),db=await legacyDatabase(x.sdk,x.app);x.guard();const snapshot=await x.sdk.getDocsFromServer(x.sdk.collection(db,'users',x.uid,'damrokEntries'));x.guard();return {records:snapshot.docs.map(d=>{const value=d.data();if(value.id!==d.id)throw Error('이전 서버 자료의 ID를 확인하지 못했습니다.');return value}),db,uid:x.uid}}
 async materialize(source){const x=this.context();if(source.uid!==x.uid)throw Error('이전 계정이 바뀌었습니다. 다시 확인해 주세요.');const records=[];for(const value of source.records){x.guard();records.push(await downloadRecord({sdk:x.sdk,asset:(id,...parts)=>x.sdk.doc(source.db,'users',x.uid,'damrokAssets',id,...parts),guard:x.guard},value))}x.guard();return records}
 async importRecords(records,source){const x=this.context(),result=await mergeLegacy(x.store,records,source,x.guard);x.guard();await this.cloud.onChange();this.cloud.sync();return result}
}
export function downloadBackup(records,label='legacy'){
 const clean=records.map(validateItem),url=URL.createObjectURL(new Blob([JSON.stringify({format:'damrok-backup',version:2,source:label,exported:new Date().toISOString(),items:clean})],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='damlog-'+label+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
