(function(){
'use strict';
// Server adapter of the existing planner recurrence model. Parity is browser-tested.
const DAY=86400000;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const validTime=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
const plusDays=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*DAY).toISOString().slice(0,10);
function validZone(zone){try{return typeof zone==='string'&&zone.length<80&&Boolean(new Intl.DateTimeFormat('en',{timeZone:zone}))}catch{return false}}
function wallParts(at,zone){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));return {date:parts.year+'-'+parts.month+'-'+parts.day,clock:parts.hour+':'+parts.minute}}
// Resolve local wall time without assuming 24-hour DST days. Skip nonexistent spring times;
// choose the earlier occurrence of an ambiguous fall time, once per occurrence tag.
function wallEpoch(date,time,zone){if(!validDate(date)||!validTime(time)||!validZone(zone))return null;const nominal=Date.parse(date+'T'+time+':00Z');let guess=nominal;for(let i=0;i<4;i++){const w=wallParts(guess,zone),delta=nominal-Date.parse(w.date+'T'+w.clock+':00Z');if(!delta)break;guess+=delta}const found=[];for(const delta of[-7200000,-3600000,0,3600000,7200000]){const at=guess+delta,w=wallParts(at,zone);if(w.date===date&&w.clock===time)found.push(at)}return found.length?Math.min(...found):null}
function createModel(snapshot){
 const state={...snapshot,events:snapshot.events||[],todos:snapshot.todos||[],routines:snapshot.routines||[],routineLogs:snapshot.routineLogs||{}};
function repeatRule(o){return ['daily','weekly','weekdays','monthly','yearly','custom'].includes(o.repeat)?o.repeat:''}
function dateDistance(a,b){return Math.round((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/86400000)}
function repeatsOn(o,date){if(!repeatRule(o)||!o.date||date<o.date||(o.repeatUntil&&date>o.repeatUntil))return false;const n=dateDistance(o.date,date),weekday=new Date(date+'T12:00:00Z').getUTCDay(),days=Array.isArray(o.repeatDays)&&o.repeatDays.length?o.repeatDays:[new Date(o.date+'T12:00:00Z').getUTCDay()];if(o.repeat==='daily')return true;if(o.repeat==='weekly')return n%7===0;if(o.repeat==='weekdays')return days.includes(weekday);const months=(Number(date.slice(0,4))-Number(o.date.slice(0,4)))*12+Number(date.slice(5,7))-Number(o.date.slice(5,7)),years=Number(date.slice(0,4))-Number(o.date.slice(0,4));if(o.repeat==='monthly')return date.slice(8)===o.date.slice(8);if(o.repeat==='yearly')return date.slice(5)===o.date.slice(5);const interval=Math.max(1,Math.floor(Number(o.repeatInterval)||1));switch(o.repeatUnit){case'week':{const monday=d=>plusDays(d,-((new Date(d+'T12:00:00Z').getUTCDay()+6)%7));return days.includes(weekday)&&Math.floor(dateDistance(monday(o.date),monday(date))/7)%interval===0}case'month':return months%interval===0&&date.slice(8)===o.date.slice(8);case'year':return years%interval===0&&date.slice(5)===o.date.slice(5);default:return n%interval===0}}
function repeatOccurrence(o,date){const shift=dateDistance(o.date,date);return {...o,id:o.id+'::'+date,repeatParent:o.id,repeatDate:date,repeat:'',date,subtasks:Array.isArray(o.subtasks)?o.subtasks.map(x=>({...x,done:date===o.date?!!x.done:false})):o.subtasks,endDate:o.endDate?plusDays(o.endDate,shift):o.endDate,due:o.due?plusDays(o.due,shift):o.due,status:date===o.date?(o.status||'open'):'open',statusExplicit:date===o.date?o.statusExplicit===true:false,completedAt:date===o.date?o.completedAt:undefined,movedFrom:undefined,movedTo:undefined}}
function itemsOnDate(key,date){const list=state[key],out=list.filter(o=>!repeatRule(o)&&!o.repeatSkip&&(!o.repeatParent||list.some(m=>m.id===o.repeatParent&&repeatsOn(m,o.repeatDate)))&&(key==='events'?eventOnDate(o,date):(o.date===date||!o.date&&o.due===date)));for(const master of list.filter(o=>repeatRule(o)&&!o.repeatParent)){const duration=key==='events'?Math.max(0,dateDistance(master.date,eventEndDate(master))):0;let start=plusDays(date,-duration);if(start<master.date)start=master.date;for(let d=start;d<=date;d=plusDays(d,1)){if(repeatsOn(master,d)){const item=repeatOccurrence(master,d);if(!list.some(o=>o.id===item.id))out.push(item)}}}return out}
function eventEndDate(e){return /^\d{4}-\d{2}-\d{2}$/.test(e.endDate||'')&&e.endDate>=e.date?e.endDate:e.date}
function eventOnDate(e,date){return e.date<=date&&date<=eventEndDate(e)}
function eventWindow(e,date){if(e.allDay)return {start:'',end:''};if(eventEndDate(e)===e.date||(!e.start&&!e.end))return {start:e.start||'',end:e.end||''};return {start:date===e.date?(e.start||'00:00'):'00:00',end:date===eventEndDate(e)?(e.end||'24:00'):'24:00'}}
function todoCategoryCompletion(name){return (state.todoCategoryCompletions||[]).find(entry=>entry.name===name)||null}
function todoIsCross(t){return t.status==='cancelled'||t.status==='open'&&t.statusExplicit===true}
function routineWhenMode(r){return ['clock','text','none'].includes(r.whenMode)?r.whenMode:(r.id||r.time||r.endTime?'clock':'none')}
const isRoutineOn=(r,date)=>!(r.startDate&&date<r.startDate||r.endDate&&date>r.endDate)&&(!r.days?.length||r.days.includes(new Date(date+'T12:00:00Z').getUTCDay()));
const dayEvents=date=>itemsOnDate('events',date);
const dayTodos=date=>itemsOnDate('todos',date).filter(t=>!(t.deadlineOnly===true&&!t.date));
const dayRoutines=date=>state.routines.filter(r=>isRoutineOn(r,date));
const rdone=(id,date)=>state.routineLogs[id+'_'+date]?.done===true;
const pending=t=>!['done','cancelled','moved'].includes(t.status)&&!todoIsCross(t)&&!todoCategoryCompletion(t.section||'');
return {state,repeatsOn,dayEvents,dayTodos,dayRoutines,rdone,pending,eventWindow};
}
function dueAt(snapshot,at,zone){
 if(!validZone(zone))throw Error('Invalid IANA time zone');
 const m=createModel(snapshot),s=snapshot.reminders||{};if(s.enabled!==true)return [];
 const {date,clock}=wallParts(at,zone),messages=[],events=Array.isArray(s.events)?s.events:[],todos=Array.isArray(s.todos)?s.todos:[],routines=Array.isArray(s.routines)?s.routines:[];
 const defaultCategory=(snapshot.eventCategories||[]).find(c=>['기본','카테고리 미정'].includes(c.name))?.name||(snapshot.eventCategories||[])[0]?.name||'기본';
 const category=e=>e.category||defaultCategory;
 const push=(kind,item,d,time,offset,title,body)=>messages.push({tag:kind+':'+item.id+':'+d+':'+time+':'+offset,title,body,route:{view:kind==='event'?'calendar':kind==='todo'?'todos':'routines',date:d,id:item.id}});
 if((s.times||[]).includes(clock)){
  const entries=[...m.dayEvents(date).filter(e=>{const w=m.eventWindow(e,date),last=w.end||w.start;return events.includes(category(e))&&(!last||last>=clock)}),...m.dayTodos(date).filter(t=>todos.includes(t.section||'')&&m.pending(t)),...m.dayRoutines(date).filter(r=>routines.includes(r.id)&&!m.rdone(r.id,date))];
  if(entries.length)messages.push({tag:'digest:'+date+':'+clock,title:'하루결 · 오늘의 할 일',body:entries.slice(0,3).map(i=>i.title).join(' · ')+(entries.length>3?' 외 '+(entries.length-3)+'개':''),route:{view:'home',date,id:''}});
 }
 // Includes up to a week of advance notice and yesterday/today around offsets.
 for(let n=0;n<=8;n++)for(const e of m.dayEvents(plusDays(date,n))){
  if(!validDate(e.date)||e.date!==plusDays(date,n)||!events.includes(category(e))||e.reminderMinutes==null)continue;
  const time=e.allDay?'09:00':e.start,offset=Number(e.reminderMinutes);if(!validTime(time)||!Number.isInteger(offset)||offset<0||offset>10080)continue;
  const start=wallEpoch(e.date,time,zone);if(start!==null&&Math.floor((start-offset*60000)/60000)===Math.floor(at/60000))push('event',e,e.date,time,offset,'하루결 · '+e.title,offset?'시작 '+offset+'분 전 · '+time:'시작 시각입니다. · '+time);
 }
 // due + explicit reminderTime is independent of execution date; legacy todos get no new alert.
 for(const t of m.state.todos){
  if(t.repeatParent||t.repeatSkip||!validDate(t.due)||!validTime(t.reminderTime)||!todos.includes(t.section||'')||!t.repeat&&!m.pending(t)||t.repeat&&!validDate(t.date))continue;
  // Expand a repeating master through its shifted due date, replacing edited/skipped occurrences.
  if(t.repeat){const shift=Math.round((Date.parse(t.due+'T12:00:00Z')-Date.parse(t.date+'T12:00:00Z'))/DAY),source=plusDays(date,-shift);for(const occurrence of m.dayTodos(source).filter(o=>o.repeatParent===t.id)){if(occurrence.due===date&&occurrence.reminderTime===clock&&m.pending(occurrence))push('todo',occurrence,date,clock,0,'하루결 · '+occurrence.title,'오늘 마감하는 투두예요. · '+clock)}}
  else if(t.due===date&&t.reminderTime===clock)push('todo',t,date,clock,0,'하루결 · '+t.title,'오늘 마감하는 투두예요. · '+clock);
 }
 // Explicit occurrence overrides can have a different due date/time from the parent.
 for(const t of m.state.todos.filter(t=>t.repeatParent&&!t.repeatSkip))if(t.due===date&&t.reminderTime===clock&&todos.includes(t.section||'')&&m.pending(t)&&m.dayTodos(t.date).some(o=>o.id===t.id))push('todo',t,date,clock,0,'하루결 · '+t.title,'오늘 마감하는 투두예요. · '+clock);
 for(const r of m.dayRoutines(date))if(r.reminderTime===clock&&!m.rdone(r.id,date))push('routine',r,date,clock,0,'하루결 · '+r.title,'습관을 실천할 시간이에요. · '+clock);
 return [...new Map(messages.map(x=>[x.tag,{...x,title:String(x.title).slice(0,120),body:String(x.body).slice(0,400)}])).values()];
}
function dueWindow(snapshot,now,zone,minutes=10){const out=[];for(let i=0;i<minutes;i++){const at=Math.floor(now/60000)*60000-i*60000;for(const message of dueAt(snapshot,at,zone))out.push({...message,scheduledAt:at})}return [...new Map(out.map(x=>[x.tag,x])).values()]}
function decodeSnapshot(snapshot){const prefix='~harugyeol-key~',marker=prefix+'version';if(snapshot?.[marker]===undefined)return snapshot;if(snapshot[marker]!==1)throw Error('Unsupported cloud field encoding');function decode(v){if(!v||typeof v!=='object')return v;if(Array.isArray(v))return v.map(decode);return Object.fromEntries(Object.entries(v).filter(([k])=>k!==marker).map(([k,x])=>[k.startsWith(prefix)?new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(k.slice(prefix.length).match(/../g)||[],x=>parseInt(x,16))):k,decode(x)]))}return decode(snapshot)}
const api={validDate,validTime,validZone,wallParts,wallEpoch,createModel,dueAt,dueWindow,decodeSnapshot};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else globalThis.HarugyeolReminderModel=api;

})();
