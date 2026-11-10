const PREFIX='<!--damrok:sections:v1-->\n';
function normalize(sections){
 if(!Array.isArray(sections))throw Error('섹션 형식이 올바르지 않습니다.');
 const result=[],stack=[{source:sections,target:result}],ids=new Set();
 while(stack.length){const {source,target}=stack.pop();for(const raw of source){if(!raw||typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/.test(raw.id)||ids.has(raw.id)||typeof raw.title!=='string'||raw.title.length>150||typeof raw.text!=='string'||raw.text.length>100000||!Array.isArray(raw.children))throw Error('섹션 형식이 올바르지 않습니다.');ids.add(raw.id);const node={id:raw.id,title:raw.title,text:raw.text,children:[]};target.push(node);stack.push({source:raw.children,target:node.children})}}
 return result;
}
export function decodePage(note){
 if(!note.startsWith(PREFIX))return {body:note,sections:[]};
 try{const value=JSON.parse(note.slice(PREFIX.length));if(value.version!==1||typeof value.body!=='string')throw Error('Unknown page format');return {body:value.body,sections:normalize(value.sections)}}catch{return {body:note,sections:[]}};
}
export function encodePage(body,sections){
 const clean=normalize(sections),note=clean.length?PREFIX+JSON.stringify({version:1,body,sections:clean}):body;
 if(note.length>100000)throw Error('페이지 저장 용량을 넘었어요. 작성한 내용은 유지됩니다. 일부 내용을 다른 페이지로 나눠 주세요.');
 return note;
}
export const newSection=()=>({id:crypto.randomUUID(),title:'',text:'',children:[]});
export function findSection(sections,id){const stack=[sections];while(stack.length){const siblings=stack.pop();for(let index=0;index<siblings.length;index++){const node=siblings[index];if(node.id===id)return {node,siblings,index};stack.push(node.children)}}return null}
export function pageText(note){const page=decodePage(note),parts=[page.body],stack=[...page.sections];while(stack.length){const node=stack.pop();parts.push(node.title,node.text);stack.push(...node.children)}return parts.join('\n')}
