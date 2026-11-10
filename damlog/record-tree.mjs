import {decodeNode} from './page-node.mjs';
import {compareOrder} from './move-items.mjs';
// Keep every matching record reachable, including missing parents and old cycles.
export function recordTree(records){
 const map=new Map(records.map(i=>[i.id,i])),parents=new Map(),children=new Map();
 for(const i of records){const parent=decodeNode(i.note).parentId;if(parent&&parent!==i.id&&map.has(parent))parents.set(i.id,parent)}
 for(const i of records){const seen=new Set([i.id]);let next=parents.get(i.id);while(next){if(seen.has(next)){parents.delete(i.id);break}seen.add(next);next=parents.get(next)}}
 for(const i of records){const parent=parents.get(i.id);if(parent){if(!children.has(parent))children.set(parent,[]);children.get(parent).push(i)}}
 for(const branch of children.values())branch.sort((a,b)=>compareOrder(a,b,(x,y)=>x.created-y.created));
 return {roots:records.filter(i=>!parents.has(i.id)),children};
}
