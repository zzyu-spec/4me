import {decodeNode,encodeNode} from './page-node.mjs';
export function compareOrder(a,b,fallback=(x,y)=>(y.updated||y.created)-(x.updated||x.created)){
 const x=decodeNode(a.note).order,y=decodeNode(b.note).order;
 return (x??Number.MAX_SAFE_INTEGER)-(y??Number.MAX_SAFE_INTEGER)||fallback(a,b)||a.id.localeCompare(b.id);
}
export function descendants(items,id){const found=new Set([id]);let changed=true;while(changed){changed=false;for(const i of items)if(!found.has(i.id)&&found.has(decodeNode(i.note).parentId)){found.add(i.id);changed=true}}return found}
export function planDrop(items,sourceId,targetId,mode,now=Date.now()){
 const source=items.find(i=>i.id===sourceId&&!i.deleted&&i.type!=='space'),target=items.find(i=>i.id===targetId&&!i.deleted&&i.type!=='space');
 if(!source||!target||!['inside','before','after'].includes(mode))throw Error('옮길 위치를 다시 선택해 주세요.');
 const own=descendants(items,source.id),parentId=mode==='inside'?target.id:decodeNode(target.note).parentId;
 if(own.has(target.id)||parentId&&own.has(parentId))throw Error('자신이나 자신의 하위 항목 안으로 옮길 수 없어요.');
 const collection=target.collection,original=decodeNode(source.note);
 const siblings=items.filter(i=>i.id!==source.id&&!i.deleted&&i.type!=='space'&&i.collection===collection&&decodeNode(i.note).parentId===parentId).sort((a,b)=>compareOrder(a,b,parentId?(x,y)=>x.created-y.created:undefined));
 let index=mode==='inside'?siblings.length:siblings.findIndex(i=>i.id===target.id)+(mode==='after'?1:0);if(index<0)throw Error('위치가 바뀌었어요. 다시 시도해 주세요.');
 siblings.splice(index,0,{...source,collection,note:encodeNode({...original,parentId,order:null}),updated:now});
 const batch=siblings.map((i,n)=>{const node=decodeNode(i.note),order=(n+1)*1024;return {...i,note:encodeNode({...node,order})}}).filter(i=>{const old=items.find(o=>o.id===i.id);return old.note!==i.note||old.collection!==i.collection});
 if(collection!==source.collection)for(const i of items)if(i.id!==source.id&&own.has(i.id))batch.push({...i,collection,updated:now});
 return batch;
}
