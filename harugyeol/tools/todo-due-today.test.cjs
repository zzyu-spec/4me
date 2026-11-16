const {chromium}=require('playwright'),assert=require('node:assert/strict');
const {useAuthenticatedUI}=require('./test-ui-auth.cjs');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await useAuthenticatedUI(page);await page.goto(process.env.HARUGYEOL_TEST_URL||'http://127.0.0.1:8062');
 await page.evaluate(()=>{const d=todayISO();state.todos=[
  ...Array.from({length:4},(_,i)=>({id:'regular'+i,title:'일반 '+i,date:d,status:'open',important:true})),
  {id:'due',title:'오늘 마감 과제',date:'',due:d,deadlineOnly:true,status:'open',note:'원문',unknown:{keep:true}},
  {id:'future',title:'내일 마감',date:'',due:plusDays(d,1),deadlineOnly:true,status:'open'},
  {id:'past',title:'어제 마감',date:'',due:plusDays(d,-1),deadlineOnly:true,status:'open'},
  ...['done','cancelled','moved','cross','archived'].map(status=>({id:status,title:status,date:'',due:d,deadlineOnly:true,status:status==='cross'?'open':status==='archived'?'open':status,statusExplicit:status==='cross',section:status==='archived'?'보관':''})),
  {id:'assigned',title:'배정된 오늘 마감',date:d,due:d,status:'open'}
 ];state.todoCategoryCompletions=[{name:'보관',date:d}];state.sections=['보관'];state.hiddenTodoSections=[];state.homePreviewTodos=3;state.todoDeadlineCollapsed=false;state.hideClosed=false;save();setView('home')});
 const before=await page.evaluate(()=>JSON.stringify(state.todos));
 let titles=await page.locator('.home-task-title strong').allTextContents();assert(titles.includes('오늘 마감 과제'));assert.deepEqual(new Set(titles.slice(0,2)),new Set(['오늘 마감 과제','배정된 오늘 마감']));assert(titles.includes('배정된 오늘 마감'));assert.equal(titles.length,3);
 assert.equal(await page.evaluate(()=>homeSortedTodos(todayISO()).filter(t=>t.id==='assigned').length),1);
 const text=await page.locator('.home-tasks-panel').textContent();for(const word of ['내일 마감','어제 마감','cancelled','moved','cross','archived'])assert(!text.includes(word));
 await page.evaluate(()=>{state.selectedDate=plusDays(todayISO(),1);render()});assert(!(await page.locator('.home-tasks-panel').textContent()).includes('오늘 마감 과제'));
 await page.evaluate(()=>{state.selectedDate=todayISO();setView('todos')});
 const due=page.locator('.todo-card').filter({has:page.locator('[data-id="due"]')});assert(await due.isVisible());assert((await due.getAttribute('class')).includes('todo-due-today'));
 const red=await page.evaluate(()=>{const probe=document.createElement('span');probe.style.color='var(--red)';document.body.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color});
 assert.equal(await due.locator('.todo-content>strong').evaluate(el=>getComputedStyle(el).color),red);assert.equal(await due.locator('.todo-deadline-label').evaluate(el=>getComputedStyle(el).color),red);
 for(const id of ['future','past','cancelled','moved','cross']){const row=page.locator('.todo-card').filter({has:page.locator(`[data-id="${id}"]`)});if(await row.count())assert(!(await row.getAttribute('class')).includes('todo-due-today'))}
 for(const appearance of ['light','dark'])for(const width of [320,390,1440]){await page.setViewportSize({width,height:844});await page.evaluate(a=>{state.appearance=a;applyTheme()},appearance);assert.equal(await due.locator('.todo-content>strong').evaluate(el=>getComputedStyle(el).color),await page.evaluate(()=>{const p=document.createElement('span');p.style.color='var(--red)';document.body.append(p);const c=getComputedStyle(p).color;p.remove();return c}));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}
 assert.equal(await page.evaluate(()=>JSON.stringify(state.todos)),before);
 await due.locator('.todo-check').click();await page.click('[data-status=done]');await page.evaluate(()=>setView('home'));assert(!(await page.locator('.home-tasks-panel').textContent()).includes('오늘 마감 과제'));
 assert.equal(await page.evaluate(()=>state.todos.find(t=>t.id==='due').unknown.keep),true);assert.equal(await page.evaluate(()=>state.todos.find(t=>t.id==='due').note),'원문');
 await page.reload();await page.evaluate(()=>setView('home'));assert(!(await page.locator('.home-tasks-panel').textContent()).includes('오늘 마감 과제'));assert.deepEqual(errors,[]);
 console.log('PASS today deadline home priority, exclusions, date isolation, dedup, red light/dark 320–1440, source preservation, completion and reload');
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exit(1)});
