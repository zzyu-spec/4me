import {decodeNode,encodeNode} from './page-node.mjs';
const TASK=/^\s*(?:[-*]\s+)?\[([ xX])\]\s+(.*)$/;
export function tasks(body){return body.split('\n').flatMap((line,index)=>{const match=line.match(TASK);return match&&match[2].trim()?[{index,line,text:match[2],done:match[1].toLowerCase()==='x'}]:[]})}
export function checklistBody(body){return body.split('\n').map(line=>!line.trim()||TASK.test(line)?line:'- [ ] '+line.replace(/^\s*[-*]\s+/,'').trim()).join('\n')}
export function isChecklist(item){if(item.type!=='page')return false;const node=decodeNode(item.note);return node.checklist===true||tasks(node.body).length>0}
export function toggleTask(note,index,expected){const node=decodeNode(note),lines=node.body.split('\n'),line=lines[index],task=typeof line==='string'?tasks(line)[0]:null;if(!task||line!==expected)throw Error('할 일이 다른 곳에서 바뀌었어요. 최신 내용을 확인하고 다시 체크해 주세요.');lines[index]=line.replace(/\[[ xX]\]/,task.done?'[ ]':'[x]');return encodeNode({...node,checklist:true,body:lines.join('\n')})}
export function addTask(note,text){text=text.trim().replace(/[\r\n]+/g,' ');if(!text)throw Error('할 일을 입력해 주세요.');const node=decodeNode(note);return encodeNode({...node,checklist:true,body:node.body+(node.body&&!node.body.endsWith('\n')?'\n':'')+'- [ ] '+text})}
