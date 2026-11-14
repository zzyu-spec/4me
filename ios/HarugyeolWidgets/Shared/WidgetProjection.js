// Read-only adapter, using the planner's existing recurrence implementation.
(function(){'use strict';
function buildWidgetData(snapshot,date,clock){
 const model=HarugyeolReminderModel.createModel(snapshot),categories=[...new Set(['',...(snapshot.sections||[]),...model.dayTodos(date).map(t=>t.section||'')])],categoryOrder=snapshot.todoSectionOrder||[],categoryRank=new Map(categories.map((x,i)=>[x,categoryOrder.includes(x)?categoryOrder.indexOf(x):categoryOrder.length+i]));
 const periodStart=period=>{if(period==='monthly')return date.slice(0,7)+'-01';if(period==='weekly'){const d=new Date(date+'T12:00:00Z'),offset=(d.getUTCDay()-(snapshot.weekStart==='mon'?1:0)+7)%7;return new Date(d.getTime()-offset*86400000).toISOString().slice(0,10)}return date};
 const todo=model.dayTodos(date).filter(t=>model.pending(t)).map((item,index)=>{const period=item.period||'daily',order=(snapshot.todoOrder||{})[JSON.stringify([period,periodStart(period),item.section||''])]||[];return {item,index,rank:order.includes(item.id)?order.indexOf(item.id):order.length+index}}).sort((a,b)=>categoryRank.get(a.item.section||'')-categoryRank.get(b.item.section||'')||({daily:0,weekly:1,monthly:2}[a.item.period||'daily']??3)-({daily:0,weekly:1,monthly:2}[b.item.period||'daily']??3)||a.rank-b.rank||a.index-b.index).map(x=>x.item);
 const events=model.dayEvents(date).map((item,index)=>({item,index,span:model.eventWindow(item,date)})).sort((a,b)=>(a.item.allDay?'':a.span.start||'99:99').localeCompare(b.item.allDay?'':b.span.start||'99:99')||a.index-b.index);
 const habits=model.dayRoutines(date),pendingHabits=habits.filter(r=>!model.rdone(r.id,date));
 const clean=(item,view,detail)=>({id:String(item.id||'').slice(0,200),title:String(item.title||'이름 없음').slice(0,300),detail:String(detail||'').slice(0,120),view,date});
 const colors={rose:'#b77d72',sage:'#789681',lavender:'#9284b5',sky:'#6f9eaf',butter:'#b49a52',mono:'#777777'};
 return {date,accent:colors[snapshot.themeColor]||colors.rose,events:events.slice(0,12).map(x=>clean(x.item,'calendar',x.item.allDay?'종일':[x.span.start,x.span.end].filter(Boolean).join(' ~ '))),todos:todo.slice(0,12).map(t=>clean(t,'todos',t.time||t.section)),habits:pendingHabits.slice(0,12).map(r=>clean(r,'routines',r.whenMode==='text'?r.whenText:r.time)),eventCount:events.length,todoCount:todo.length,habitCount:pendingHabits.length,habitTotal:habits.length};
}
if(typeof module!=='undefined'&&module.exports)module.exports={buildWidgetData};else globalThis.buildWidgetData=buildWidgetData;
})();
