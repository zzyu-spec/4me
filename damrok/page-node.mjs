import {decodePage,encodePage} from './page-sections.mjs';
const PREFIX='<!--damrok:page:v2-->\n',UUID=/^[a-f0-9-]{36}$/;
export function decodeNode(note){
 if(note.startsWith(PREFIX)){try{const v=JSON.parse(note.slice(PREFIX.length));if(v.version!==2||typeof v.content!=='string'||!['page','post'].includes(v.kind)||(v.parentId!==null&&!UUID.test(v.parentId)))throw Error('Invalid page');return {...decodePage(v.content),parentId:v.parentId,kind:v.kind}}catch{/* Preserve unknown content as text. */}}
 return {...decodePage(note),parentId:null,kind:'page'};
}
export function encodeNode({body,sections=[],parentId=null,kind='page'}){
 if(!['page','post'].includes(kind)||(parentId!==null&&!UUID.test(parentId)))throw Error('페이지 위치를 확인해 주세요.');
 const content=encodePage(body,sections),note=parentId===null&&kind==='page'?content:PREFIX+JSON.stringify({version:2,content,parentId,kind});
 if(note.length>100000)throw Error('페이지 저장 용량을 넘었어요. 입력은 유지됩니다. 내용을 다른 글로 나눠 주세요.');return note;
}
export const nodeText=note=>{const p=decodeNode(note),parts=[p.body],stack=[...p.sections];while(stack.length){const n=stack.pop();parts.push(n.title,n.text);stack.push(...n.children)}return parts.join('\n')};
export function childrenOf(items,parentId){return items.filter(i=>i.type!=='space'&&!i.deleted&&decodeNode(i.note).parentId===parentId).sort((a,b)=>a.created-b.created)}
export function ancestorChain(items,item){const map=new Map(items.filter(i=>i.type!=='space').map(i=>[i.id,i])),seen=new Set([item.id]),parents=[];let id=decodeNode(item.note).parentId;while(id&&!seen.has(id)){seen.add(id);const parent=map.get(id);if(!parent)break;parents.unshift(parent);id=decodeNode(parent.note).parentId}return parents}
