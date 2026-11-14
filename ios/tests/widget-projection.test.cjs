const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
// Execute as JavaScriptCore does: browser globals, no Node module/require/Buffer.
const context=vm.createContext({});
for(const file of ['harugyeol/functions/reminder-model.js','ios/HarugyeolWidgets/Shared/WidgetProjection.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
const project=(snapshot,date='2026-11-14')=>JSON.parse(JSON.stringify(context.buildWidgetData(snapshot,date,'12:00')));
test('pending totals exclude cross/cancelled/moved/done, archived categories and unassigned deadline-only tasks; input untouched',()=>{
 const todos=['open','done','cancelled','moved'].map(status=>({id:status,title:status,status,date:'2026-11-14'}));
 todos.push({id:'cross',status:'open',statusExplicit:true,date:'2026-11-14'},{id:'archived',section:'old',date:'2026-11-14'},{id:'deadline',due:'2026-11-14',deadlineOnly:true});
 const snapshot={todos,todoCategoryCompletions:[{name:'old'}],diary:{secret:'never exported'},unknown:{keep:true}};
 const original=JSON.stringify(snapshot), result=project(snapshot);
 assert.equal(result.todoCount,1);assert.equal(result.todos[0].id,'open');assert.equal(JSON.stringify(snapshot),original);assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!('diary' in result));
});
test('recurrence override and multi-day midnight windows retain ordering',()=>{
 const result=project({events:[{id:'r',title:'repeat',date:'2026-11-13',start:'10:00',end:'11:00',repeat:'daily'},{id:'r::2026-11-14',repeatParent:'r',repeatDate:'2026-11-14',title:'edited',date:'2026-11-14',start:'09:00',end:'09:30'},{id:'night',title:'night',date:'2026-11-13',endDate:'2026-11-14',start:'23:00',end:'01:00'}]});
 assert.equal(result.eventCount,2);assert.equal(result.events[0].detail,'00:00 ~ 01:00');assert.equal(result.events[1].title,'edited');
});
test('habit repeat weekdays, date boundaries and completed logs',()=>{
 const result=project({routines:[{id:'a',title:'daily',whenMode:'text',whenText:'식후'},{id:'b',title:'done'},{id:'weekday',days:[1,2,3,4,5]},{id:'future',startDate:'2026-11-15'}],routineLogs:{'b_2026-11-14':{done:true}}});
 assert.equal(result.habitTotal,2);assert.equal(result.habitCount,1);assert.equal(result.habits[0].detail,'식후');
});
test('manual category ordering, truncation and empty states',()=>{
 const snapshot={sections:['a','b'],todoSectionOrder:['b','a'],todos:[{id:'x',title:'X',section:'a',date:'2026-11-14'},{id:'z',title:'Z',section:'b',date:'2026-11-14'},{id:'y',title:'Y',section:'b',date:'2026-11-14'}],todoOrder:{'["daily","2026-11-14","b"]':['y','z']},themeColor:'sage'};
 assert.deepEqual(project(snapshot).todos.map(t=>t.id),['y','z','x']);assert.equal(project(snapshot).accent,'#789681');
 const many=project({todos:Array.from({length:25},(_,i)=>({id:String(i),title:'x'.repeat(400),date:'2026-11-14'}))});
 assert.equal(many.todoCount,25);assert.equal(many.todos.length,12);assert.equal(many.todos[0].title.length,300);
 assert.equal(project({}).eventCount,0);assert.equal(project({}).habitCount,0);
});
