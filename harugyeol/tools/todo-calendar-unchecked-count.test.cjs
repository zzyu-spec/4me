const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {useAuthenticatedUI}=require('./test-ui-auth.cjs');
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const p=await b.newPage({viewport:{width:390,height:844}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await useAuthenticatedUI(p);await p.goto(process.env.HARUGYEOL_TEST_URL||'http://127.0.0.1:8063');
 const date=await p.evaluate(()=>{const d=todayISO();state.todos=['done','partial','cancelled','moved','open'].map(status=>({id:status,title:status,date:d,status,note:'보존',unknown:{keep:true}}));state.hideClosed=false;state.hiddenTodoSections=[];state.todoCategoryCompletions=[];state.todoCollectCompleted=false;save();setView('todos');return d});
 const original=await p.evaluate(()=>JSON.stringify(state.todos));assert.equal(await p.evaluate(()=>todoPendingCount(todayISO())),2);assert.equal(await p.evaluate(()=>todoCalendarCount(todayISO())),1);
 const badge=()=>p.locator(`[data-workspace-calendar="todo"] [data-date="${date}"] .todo-unchecked-count, [data-workspace-calendar="todo"] [data-workspace-date="${date}"] .todo-unchecked-count`);
 for(const mode of ['week','month']){
  await p.evaluate(mode=>{workspaceCalendarModes.todo=mode;render()},mode);
  assert.equal(await badge().textContent(),'1');assert.equal(await p.evaluate(()=>JSON.stringify(state.todos)),original);
  const emptyDate=await p.evaluate(()=>plusDays(todayISO(),1));assert.equal(await p.locator(`[data-date="${emptyDate}"] .todo-unchecked-count,[data-workspace-date="${emptyDate}"] .todo-unchecked-count`).count(),0);
 }
 for(const mode of ['week','month']){
  await p.evaluate(mode=>{workspaceCalendarModes.todo=mode;render()},mode);
  await p.locator('[data-sort-todo="open"] .todo-check').click();await p.click('[data-status="partial"]');
  assert.equal(await badge().count(),0);assert.equal(await p.evaluate(()=>state.todos.find(t=>t.id==='partial').status),'partial');
  await p.locator('[data-sort-todo="open"] .todo-check').click();await p.click('[data-status="done"]');assert.equal(await badge().count(),0);
  await p.evaluate(()=>{const t=state.todos.find(t=>t.id==='open');t.status='open';t.statusExplicit=false;save();render()});assert.equal(await badge().textContent(),'1');
 }
 for(const width of [320,390,1440]){await p.setViewportSize({width,height:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
 await p.reload();await p.evaluate(()=>setView('todos'));assert.equal(await badge().textContent(),'1');
 assert.deepEqual(await p.evaluate(()=>state.todos.filter(t=>t.id!=='open')),JSON.parse(original).filter(t=>t.id!=='open'));
 assert.equal(await p.evaluate(()=>state.todos.find(t=>t.id==='open').unknown.keep),true);assert.deepEqual(errors,[]);
 console.log('PASS unchecked-only week/month badges; partial/cross/moved/done excluded; zero hidden; real status changes instant; pending helper unchanged; data/reload/responsive preserved');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
