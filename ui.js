// ui.js — all render functions (widgets, calendar, notes, journal, settings)
// Depends on: app.js globals (S, allCats, getTasks, etc.)

// ── DRAG + RESIZE ─────────────────────────────────────────────────────────────
function bindDraggable(el,wKey){
  const header=el.querySelector('.widget-header');if(!header)return;
  const fresh=header.cloneNode(true);header.parentNode.replaceChild(fresh,header);
  let ox=0,oy=0,sx=0,sy_=0;
  fresh.addEventListener('mousedown',e=>{
    if(e.target.closest('button')||e.target.closest('.widget-header-btns'))return;
    e.preventDefault();sx=e.clientX;sy_=e.clientY;ox=S.widgets[wKey].x;oy=S.widgets[wKey].y;el.classList.add('dragging');
    const mv=e=>{const nx=Math.max(0,ox+e.clientX-sx),ny=Math.max(0,oy+e.clientY-sy_);S.widgets[wKey].x=nx;S.widgets[wKey].y=ny;el.style.left=nx+'px';el.style.top=ny+'px';};
    const up=()=>{el.classList.remove('dragging');saveWidgets();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}

function bindResize(el,wKey){
  const handle=el.querySelector('.resize-handle');if(!handle)return;
  let sw=0,sh=0,sx=0,sy_=0;
  handle.addEventListener('mousedown',e=>{
    e.preventDefault();e.stopPropagation();
    sx=e.clientX;sy_=e.clientY;sw=S.widgets[wKey].w;sh=S.widgets[wKey].h||el.offsetHeight;
    const mv=e=>{const nw=Math.max(280,sw+e.clientX-sx),nh=Math.max(200,sh+e.clientY-sy_);S.widgets[wKey].w=nw;S.widgets[wKey].h=nh;el.style.width=nw+'px';el.style.height=nh+'px';};
    const up=()=>{saveWidgets();document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up);};
    document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up);
  });
}

function applyWidgetSize(el,wKey){
  const w=S.widgets[wKey];
  el.style.left=w.x+'px';el.style.top=w.y+'px';el.style.width=w.w+'px';
  if(w.h)el.style.height=w.h+'px';else el.style.height='';
  el.classList.toggle('collapsed',w.collapsed);
}

function timeOpts(sel){let o='<option value="">No time</option>';for(let h=0;h<24;h++)for(let m=0;m<60;m+=30){const hh=pad(h),mm=pad(m),val=`${hh}:${mm}`,ampm=h<12?'AM':'PM',h12=h===0?12:h>12?h-12:h;o+=`<option value="${val}"${sel===val?' selected':''}>${h12}:${mm} ${ampm}</option>`;}return o;}

let _addCat='none',_selDays=[];

// ── TASK HTML ─────────────────────────────────────────────────────────────────
function taskHTML(t,k,isOD=false){
  const cat=catById(t.cat);const od=isOD||isOverdue(k,t);
  if(S.editingId===t.id){
    return`<div class="task-item" data-id="${t.id}" data-key="${k}" style="cursor:default;border-left-color:${cat.color}"><div class="task-edit-wrap">
      <input class="edit-text" type="text" value="${esc(t.text)}"/>
      <select class="edit-cat">${allCats().map(c=>`<option value="${c.id}"${t.cat===c.id?' selected':''}>${esc(c.label)}</option>`).join('')}</select>
      <select class="edit-time">${timeOpts(t.time||'')}</select>
      <button class="btn sm primary save-edit" data-id="${t.id}" data-key="${k}">Save</button>
      <button class="btn sm ghost cancel-edit">Cancel</button>
    </div></div>`;
  }
  return`<div class="task-item cat-${esc(t.cat)}${t.done?' done':''}${od&&!t.done?' is-overdue':''}" data-id="${t.id}" data-key="${k}" style="border-left-color:${od&&!t.done?'var(--danger)':cat.color}">
    <div class="task-check">${t.done?'<svg width="10" height="10" viewBox="0 0 12 12"><polyline points="1,6 4,10 11,2" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round"/></svg>':''}</div>
    <div class="task-body">
      <div class="task-name">${esc(t.text)}</div>
      <div class="task-meta">
        ${t.cat!=='none'?`<span class="task-badge" style="background:${cat.color}22;color:${cat.color}">${esc(cat.label)}</span>`:''}
        ${t.time?`<span class="task-time-lbl">${t.time}</span>`:''}
        ${t.autoMove?'<span class="task-time-lbl">auto-move</span>':''}
      </div>
    </div>
    <div class="task-acts">
      <button class="task-act-btn edit-btn" data-id="${t.id}" title="Edit">&#9998;</button>
      ${isOD?`<button class="task-act-btn move-btn" data-id="${t.id}" data-key="${k}" title="Move to today">&#8594;</button>`:''}
      <button class="task-act-btn del del-btn" data-id="${t.id}" data-key="${k}" title="Delete">&#10005;</button>
    </div>
  </div>`;
}

function bindTaskEvents(el,currentKey){
  el.querySelectorAll('.task-item[data-id]').forEach(item=>{item.onclick=e=>{if(e.target.closest('.task-acts')||e.target.closest('.task-edit-wrap'))return;const k=item.dataset.key||currentKey;toggleTask(k,item.dataset.id);renderTasksWidget();renderCalWidget();};});
  el.querySelectorAll('.edit-btn').forEach(b=>{b.onclick=e=>{e.stopPropagation();S.editingId=b.dataset.id;saveLocal();renderTasksWidget();};});
  el.querySelectorAll('.save-edit').forEach(b=>{b.onclick=e=>{e.stopPropagation();const row=b.closest('.task-item');const text=row.querySelector('.edit-text').value.trim();if(!text)return;saveTaskEdit(b.dataset.key||currentKey,b.dataset.id,text,row.querySelector('.edit-cat').value,row.querySelector('.edit-time').value);renderTasksWidget();};});
  el.querySelectorAll('.cancel-edit').forEach(b=>{b.onclick=e=>{e.stopPropagation();S.editingId=null;saveLocal();renderTasksWidget();};});
  el.querySelectorAll('.del-btn').forEach(b=>{b.onclick=e=>{e.stopPropagation();deleteTask(b.dataset.key||currentKey,b.dataset.id);renderTasksWidget();renderCalWidget();};});
  el.querySelectorAll('.move-btn').forEach(b=>{b.onclick=e=>{e.stopPropagation();moveToNext(b.dataset.key,b.dataset.id);renderTasksWidget();renderCalWidget();};});
}

// ── TASKS WIDGET ──────────────────────────────────────────────────────────────
function renderTasksWidget(){
  injectCatStyles();
  let el=document.getElementById('w-tasks');
  if(!el){el=document.createElement('div');el.id='w-tasks';el.className='widget';document.getElementById('planner-canvas').appendChild(el);}
  applyWidgetSize(el,'tasks');
  const k=S.selectedKey;const allTasks=getTasks(k);
  let filtered=[...allTasks];
  if(S.filter==='active')filtered=filtered.filter(t=>!t.done);
  if(S.filter==='done')filtered=filtered.filter(t=>t.done);
  if(S.catFilter!=='all')filtered=filtered.filter(t=>t.cat===S.catFilter);
  const done=allTasks.filter(t=>t.done).length,total=allTasks.length,pct=total?Math.round(done/total*100):0;
  const{big,sub}=fmtKey(k);const overDays=getOverdueDays();const cats=allCats();
  const w=S.widgets.tasks;
  el.innerHTML=`
    <div class="widget-header">
      <div class="widget-title"><div class="dot"></div>Tasks</div>
      <div class="widget-header-btns"><button class="widget-collapse">${w.collapsed?'+':'&#8722;'}</button></div>
    </div>
    <div class="widget-body" style="${w.h?'overflow-y:auto;height:calc(100% - 42px);':''}">
      <div class="storage-info"><strong>&#9729; Cloud Sync</strong> &#8212; your data is saved to Supabase and synced across devices.</div>
      <div class="date-header"><span class="date-big">${big}</span>${sub?`<span class="date-sub">${sub}</span>`:''}</div>
      <div class="stats">
        <div class="stat"><div class="stat-num">${total}</div><div class="stat-label">tasks</div></div>
        <div class="stat"><div class="stat-num">${done}</div><div class="stat-label">done</div></div>
        <div class="stat"><div class="stat-num">${pct}%</div><div class="stat-label">complete</div></div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div style="display:flex;gap:8px;margin-bottom:14px;">
        <button class="add-task-trigger" id="add-trigger" style="margin-bottom:0;flex:1;">+ Add a task...</button>
        <button class="nav-icon-btn" id="task-search-btn" title="Search tasks" style="padding:7px 12px;border-radius:var(--radius-sm);">&#128269; Search</button>
      </div>
      <div class="add-dropdown" id="search-dropdown" style="margin-bottom:14px;">
        <div class="add-label">Search tasks across all days</div>
        <input class="inp" type="text" id="task-search-inp" placeholder="Search..." style="margin-top:6px;"/>
        <div id="task-search-results" style="margin-top:10px;display:flex;flex-direction:column;gap:4px;max-height:220px;overflow-y:auto;"></div>
      </div>
      <div class="add-dropdown" id="add-dropdown">
        <div class="add-field"><div class="add-label">Task name</div><input class="inp" type="text" id="add-text" placeholder="What needs to be done?"/></div>
        <div class="add-field"><div class="add-label">Time (optional)</div><select class="inp" id="add-time">${timeOpts('')}</select></div>
        <div class="add-field">
          <div class="add-label">Category</div>
          <div class="cat-picker">${cats.map(c=>{const sel=_addCat===c.id;return`<button class="cat-opt" data-cat="${c.id}" style="${sel?`background:${c.color}22;border-color:${c.color};color:${c.color}`:''}">${esc(c.label)}</button>`;}).join('')}</div>
        </div>
        <label class="recur-toggle"><input type="checkbox" id="recur-chk"/> Repeat on specific days</label>
        <div class="recur-extra" id="recur-extra">
          <div class="add-field"><div class="add-label">Select days</div>
            <div class="day-picker">
              <button class="day-btn${_selDays.length===7?' sel':''}" id="day-all">All</button>
              ${DAYS.map((d,i)=>`<button class="day-btn${_selDays.includes(i)?' sel':''}" data-day="${i}">${d}</button>`).join('')}
            </div>
          </div>
          <label class="recur-toggle" style="margin-top:8px;"><input type="checkbox" id="add-automove"/> Auto-move to next day if incomplete</label>
        </div>
        <div class="add-actions">
          <button class="btn primary" id="add-submit">Add Task</button>
          <button class="btn ghost" id="add-cancel">Cancel</button>
        </div>
      </div>
      <div class="filter-row">
        <button class="chip${S.filter==='all'?' active':''}" data-f="all">All</button>
        <button class="chip${S.filter==='active'?' active':''}" data-f="active">Active</button>
        <button class="chip${S.filter==='done'?' active':''}" data-f="done">Done</button>
        <span class="divider-v"></span>
        <button class="chip${S.catFilter==='all'?' active':''}" data-cf="all">All</button>
        ${cats.filter(c=>c.id!=='none').map(c=>`<button class="chip${S.catFilter===c.id?' active':''}" data-cf="${c.id}" style="${S.catFilter===c.id?`background:${c.color}22;border-color:${c.color};color:${c.color}`:''}">${esc(c.label)}</button>`).join('')}
      </div>
      <div class="task-list">${filtered.length===0?`<div class="empty">${total===0?'No tasks yet':'Nothing matches'}</div>`:filtered.map(t=>taskHTML(t,k)).join('')}</div>
      ${overDays.length?`<div class="overdue-section"><div class="section-label">Incomplete from Previous Days</div>${overDays.map(o=>{const{short}=fmtKey(o.key);return`<div class="overdue-date">${short}</div>${o.tasks.map(t=>taskHTML(t,o.key,true)).join('')}`;}).join('')}</div>`:''}
    </div>
    <div class="resize-handle"></div>`;
  bindDraggable(el,'tasks');bindResize(el,'tasks');
  el.querySelector('.widget-collapse').onclick=()=>{S.widgets.tasks.collapsed=!S.widgets.tasks.collapsed;saveWidgets();renderTasksWidget();};
  const trigger=el.querySelector('#add-trigger'),dropdown=el.querySelector('#add-dropdown');
  const recurChk=el.querySelector('#recur-chk'),recurExt=el.querySelector('#recur-extra');
  trigger.onclick=()=>{dropdown.classList.toggle('open');el.querySelector('#search-dropdown').classList.remove('open');if(dropdown.classList.contains('open'))el.querySelector('#add-text').focus();};
  el.querySelector('#add-cancel').onclick=()=>dropdown.classList.remove('open');
  recurChk.onchange=()=>recurExt.classList.toggle('open',recurChk.checked);
  el.querySelector('#add-text').onkeydown=e=>{if(e.key==='Enter')doAdd();};
  el.querySelector('#add-submit').onclick=doAdd;
  el.querySelectorAll('.cat-opt').forEach(b=>{b.onclick=e=>{e.stopPropagation();_addCat=b.dataset.cat;el.querySelectorAll('.cat-opt').forEach(x=>{const c=catById(x.dataset.cat);if(x.dataset.cat===_addCat){x.style.background=`${c.color}22`;x.style.borderColor=c.color;x.style.color=c.color;}else{x.style.background='';x.style.borderColor='';x.style.color='';}});};});
  el.querySelector('#day-all').onclick=e=>{e.stopPropagation();_selDays=_selDays.length===7?[]:[0,1,2,3,4,5,6];el.querySelectorAll('.day-btn[data-day]').forEach(b=>b.classList.toggle('sel',_selDays.includes(Number(b.dataset.day))));el.querySelector('#day-all').classList.toggle('sel',_selDays.length===7);};
  el.querySelectorAll('.day-btn[data-day]').forEach(b=>{b.onclick=e=>{e.stopPropagation();const day=Number(b.dataset.day);if(_selDays.includes(day))_selDays=_selDays.filter(d=>d!==day);else _selDays.push(day);b.classList.toggle('sel',_selDays.includes(day));el.querySelector('#day-all').classList.toggle('sel',_selDays.length===7);};});
  el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{S.filter=b.dataset.f;saveLocal();renderTasksWidget();});
  el.querySelectorAll('[data-cf]').forEach(b=>b.onclick=()=>{S.catFilter=b.dataset.cf;saveLocal();renderTasksWidget();});
  bindTaskEvents(el,k);
  setupTaskSearch(el);
}

function doAdd(){
  const text=document.getElementById('add-text')?.value.trim();if(!text)return;
  const time=document.getElementById('add-time')?.value||null;
  const cat=_addCat||'none';
  const recurChk=document.getElementById('recur-chk')?.checked;
  const recurDays=recurChk?[..._selDays]:[];
  const autoMove=document.getElementById('add-automove')?.checked||false;
  addTask(S.selectedKey,text,time,cat,recurDays,autoMove);
  _addCat='none';_selDays=[];
  document.getElementById('add-dropdown')?.classList.remove('open');
  renderTasksWidget();renderCalWidget();
}

function setupTaskSearch(el){
  const searchBtn=el.querySelector('#task-search-btn');
  const searchDropdown=el.querySelector('#search-dropdown');
  const addDropdown=el.querySelector('#add-dropdown');
  const searchInp=el.querySelector('#task-search-inp');
  const resultsEl=el.querySelector('#task-search-results');
  if(!searchBtn)return;
  searchBtn.onclick=e=>{e.stopPropagation();searchDropdown.classList.toggle('open');addDropdown.classList.remove('open');if(searchDropdown.classList.contains('open'))searchInp.focus();};
  searchInp.oninput=()=>{
    const q=searchInp.value.trim().toLowerCase();
    if(!q){resultsEl.innerHTML='';return;}
    const hits=[];
    Object.keys(S.tasks).sort().forEach(k=>{getTasks(k).forEach(t=>{if(t.text.toLowerCase().includes(q))hits.push({task:t,key:k});});});
    if(!hits.length){resultsEl.innerHTML='<div class="empty" style="padding:12px 0;">No tasks found</div>';return;}
    resultsEl.innerHTML=hits.slice(0,20).map(({task:t,key:k})=>{const cat=catById(t.cat);const{short}=fmtKey(k);return`<div class="task-search-result" data-skey="${k}" data-sid="${t.id}"><div class="task-search-result-name" style="border-left:3px solid ${cat.color};padding-left:7px;">${esc(t.text)}</div><div class="task-search-result-date">${short}${t.time?' · '+t.time:''}${t.done?' · done':''}</div></div>`;}).join('');
    resultsEl.querySelectorAll('.task-search-result').forEach(r=>{r.onclick=()=>{const[y,m,d]=r.dataset.skey.split('-').map(Number);S.calYear=y;S.calMonth=m-1;S.selectedKey=r.dataset.skey;saveLocal();searchDropdown.classList.remove('open');searchInp.value='';resultsEl.innerHTML='';renderTasksWidget();renderCalWidget();};});
  };
}

// ── CALENDAR WIDGET ───────────────────────────────────────────────────────────
function renderCalWidget(){
  let el=document.getElementById('w-calendar');
  if(!el){el=document.createElement('div');el.id='w-calendar';el.className='widget';document.getElementById('planner-canvas').appendChild(el);}
  applyWidgetSize(el,'calendar');
  const w=S.widgets.calendar;
  const dim=new Date(S.calYear,S.calMonth+1,0).getDate(),fdow=new Date(S.calYear,S.calMonth,1).getDay(),prevD=new Date(S.calYear,S.calMonth,0).getDate();
  let cells='';
  for(let i=0;i<fdow;i++){const d=prevD-fdow+1+i,ck=dateKey(new Date(S.calYear,S.calMonth-1,d));cells+=`<div class="cal-day other${ck===S.selectedKey?' selected':''}${getTasks(ck).length?' has-tasks':''}${getTasks(ck).some(t=>isOverdue(ck,t))?' has-overdue':''}" data-key="${ck}">${d}</div>`;}
  for(let d=1;d<=dim;d++){const ck=dateKey(new Date(S.calYear,S.calMonth,d));cells+=`<div class="cal-day${ck===todayKey?' is-today':''}${ck===S.selectedKey?' selected':''}${getTasks(ck).length?' has-tasks':''}${getTasks(ck).some(t=>isOverdue(ck,t))?' has-overdue':''}" data-key="${ck}">${d}</div>`;}
  const trail=42-fdow-dim;for(let d=1;d<=trail;d++){const ck=dateKey(new Date(S.calYear,S.calMonth+1,d));cells+=`<div class="cal-day other${ck===S.selectedKey?' selected':''}${getTasks(ck).length?' has-tasks':''}${getTasks(ck).some(t=>isOverdue(ck,t))?' has-overdue':''}" data-key="${ck}">${d}</div>`;}
  const upcoming=getUpcoming();
  el.innerHTML=`
    <div class="widget-header">
      <div class="widget-title"><div class="dot"></div>Calendar</div>
      <div class="widget-header-btns">
        <button class="widget-expand" id="cal-popout-btn">&#9974; Expand</button>
        <button class="widget-collapse">${w.collapsed?'+':'&#8722;'}</button>
      </div>
    </div>
    <div class="widget-body" style="${w.h?'overflow-y:auto;height:calc(100% - 42px);':''}">
      <div class="cal-nav"><button class="cal-nav-btn" id="cal-prev">&#8249;</button><span class="cal-month-lbl">${MONTHS[S.calMonth]} ${S.calYear}</span><button class="cal-nav-btn" id="cal-next">&#8250;</button></div>
      <div class="cal-grid">${DAYS.map(d=>`<div class="cal-day-name">${d[0]}</div>`).join('')}${cells}</div>
      ${upcoming.length?`<div class="upcoming"><div class="upcoming-lbl">Upcoming</div>${upcoming.map(u=>`<div class="upcoming-item" data-key="${u.key}"><div class="upcoming-dot${u.tasks.some(t=>isOverdue(u.key,t))?' od':''}"></div><span class="upcoming-dt">${u.label}</span><span class="upcoming-txt">${u.tasks.length} task${u.tasks.length>1?'s':''}: ${u.tasks.map(t=>esc(t.text)).join(', ')}</span></div>`).join('')}</div>`:''}
    </div>
    <div class="resize-handle"></div>`;
  bindDraggable(el,'calendar');bindResize(el,'calendar');
  el.querySelector('.widget-collapse').onclick=()=>{S.widgets.calendar.collapsed=!S.widgets.calendar.collapsed;saveWidgets();renderCalWidget();};
  el.querySelector('#cal-popout-btn')?.addEventListener('click',()=>openCalPopout());
  el.querySelector('#cal-prev').onclick=()=>{if(S.calMonth===0){S.calMonth=11;S.calYear--;}else S.calMonth--;saveLocal();renderCalWidget();};
  el.querySelector('#cal-next').onclick=()=>{if(S.calMonth===11){S.calMonth=0;S.calYear++;}else S.calMonth++;saveLocal();renderCalWidget();};
  el.querySelectorAll('.cal-day[data-key]').forEach(d=>{d.onclick=()=>{S.selectedKey=d.dataset.key;saveLocal();renderTasksWidget();renderCalWidget();};});
  el.querySelectorAll('.upcoming-item[data-key]').forEach(u=>{u.onclick=()=>{const[y,m,d]=u.dataset.key.split('-').map(Number);S.calYear=y;S.calMonth=m-1;S.selectedKey=u.dataset.key;saveLocal();renderTasksWidget();renderCalWidget();};});
}

// ── GOALS WIDGET ──────────────────────────────────────────────────────────────
function setupGoalModal(){
  document.getElementById('gm-save')?.addEventListener('click',()=>{
    const text=document.getElementById('gm-text').value.trim();if(!text)return;
    const deadline=document.getElementById('gm-deadline').value||null;
    const goal={id:S.editingGoalId||crypto.randomUUID(),text,done:false,deadline,subtasks:S.goals.find(g=>g.id===S.editingGoalId)?.subtasks||[]};
    saveGoal(goal);S.editingGoalId=null;renderGoalsWidget();
    document.getElementById('goal-modal').classList.remove('open');
  });
  document.getElementById('gm-cancel')?.addEventListener('click',()=>{S.editingGoalId=null;document.getElementById('goal-modal').classList.remove('open');});
  document.getElementById('goal-modal')?.addEventListener('click',e=>{if(e.target===document.getElementById('goal-modal'))document.getElementById('gm-cancel').click();});
}

function openGoalModal(g){
  const modal=document.getElementById('goal-modal');
  document.getElementById('goal-modal-title').textContent=g?'Edit Goal':'Add Goal';
  document.getElementById('gm-text').value=g?g.text:'';
  document.getElementById('gm-deadline').value=g?.deadline||'';
  S.editingGoalId=g?g.id:null;
  modal.classList.add('open');
  setTimeout(()=>document.getElementById('gm-text').focus(),50);
}

function renderGoalsWidget(){
  let el=document.getElementById('w-goals');
  if(!el){el=document.createElement('div');el.id='w-goals';el.className='widget';document.getElementById('planner-canvas').appendChild(el);}
  applyWidgetSize(el,'goals');
  const w=S.widgets.goals;
  el.innerHTML=`
    <div class="widget-header"><div class="widget-title"><div class="dot"></div>Goals</div><div class="widget-header-btns"><button class="widget-collapse">${w.collapsed?'+':'&#8722;'}</button></div></div>
    <div class="widget-body" style="${w.h?'overflow-y:auto;height:calc(100% - 42px);':''}">
      <button class="add-goal-trigger" id="add-goal-trigger">+ Add a goal...</button>
      <div>${S.goals.length===0?'<div class="empty">No goals yet</div>':S.goals.map(g=>`
        <div class="goal-item${g.done?' done':''}${goalExpired(g)?' expired':''}" data-gid="${g.id}">
          <div class="goal-check">${g.done?'<svg width="10" height="10" viewBox="0 0 12 12"><polyline points="1,6 4,10 11,2" fill="none" stroke="var(--success)" stroke-width="2" stroke-linecap="round"/></svg>':''}</div>
          <div class="goal-body">
            <div class="goal-txt">${esc(g.text)}</div>
            ${g.deadline?`<div class="goal-dead${goalExpired(g)?' exp':''}">${goalExpired(g)?'&#9888; Expired: ':'Due: '}${g.deadline}</div>`:''}
          </div>
          <div class="goal-acts">
            <button class="goal-act-btn edit-goal-btn" data-gid="${g.id}">&#9998;</button>
            <button class="goal-act-btn del del-goal-btn" data-gid="${g.id}">&#10005;</button>
          </div>
        </div>
        <div class="subtask-list">
          ${(g.subtasks||[]).map(st=>`<div class="subtask-item${st.done?' st-done':''}" data-stid="${st.id}" data-pgid="${g.id}">
            <div class="subtask-check">${st.done?'<svg width="8" height="8" viewBox="0 0 12 12"><polyline points="1,6 4,10 11,2" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round"/></svg>':''}</div>
            <span>${esc(st.text)}</span>
            <button class="subtask-del" data-stdel="${st.id}" data-pgid="${g.id}">&#10005;</button>
          </div>`).join('')}
          <div class="subtask-add-row">
            <input type="text" class="st-inp" data-gid="${g.id}" placeholder="Add subtask..."/>
            <button class="subtask-add-btn st-add" data-gid="${g.id}">+ Add</button>
          </div>
        </div>`).join('')}
      </div>
    </div>
    <div class="resize-handle"></div>`;
  bindDraggable(el,'goals');bindResize(el,'goals');
  el.querySelector('.widget-collapse').onclick=()=>{S.widgets.goals.collapsed=!S.widgets.goals.collapsed;saveWidgets();renderGoalsWidget();};
  el.querySelector('#add-goal-trigger').onclick=()=>openGoalModal(null);
  el.querySelectorAll('.goal-item[data-gid]').forEach(g=>{g.onclick=e=>{if(e.target.closest('.goal-acts'))return;const goal=S.goals.find(x=>x.id===g.dataset.gid);if(!goal)return;saveGoal({...goal,done:!goal.done});renderGoalsWidget();};});
  el.querySelectorAll('.edit-goal-btn').forEach(b=>{b.onclick=e=>{e.stopPropagation();openGoalModal(S.goals.find(x=>x.id===b.dataset.gid));};});
  el.querySelectorAll('.del-goal-btn').forEach(b=>{b.onclick=e=>{e.stopPropagation();removeGoal(b.dataset.gid);renderGoalsWidget();};});
  el.querySelectorAll('.subtask-check').forEach(chk=>{chk.onclick=e=>{e.stopPropagation();const item=chk.closest('.subtask-item');const goalId=item.dataset.pgid,stid=item.dataset.stid;const g=S.goals.find(x=>x.id===goalId);const st=(g?.subtasks||[]).find(s=>s.id===stid);if(st){saveSubtask(goalId,{...st,done:!st.done});renderGoalsWidget();}};});
  el.querySelectorAll('[data-stdel]').forEach(b=>{b.onclick=e=>{e.stopPropagation();removeSubtask(b.dataset.pgid,b.dataset.stdel);renderGoalsWidget();};});
  el.querySelectorAll('.st-add').forEach(btn=>{btn.onclick=e=>{e.stopPropagation();const gid=btn.dataset.gid;const inp=el.querySelector(`.st-inp[data-gid="${gid}"]`);const text=inp.value.trim();if(!text)return;saveSubtask(gid,{id:crypto.randomUUID(),text,done:false});renderGoalsWidget();};});
  el.querySelectorAll('.st-inp').forEach(inp=>{inp.onkeydown=e=>{if(e.key!=='Enter')return;e.stopPropagation();const gid=inp.dataset.gid;const text=inp.value.trim();if(!text)return;saveSubtask(gid,{id:crypto.randomUUID(),text,done:false});renderGoalsWidget();};});
}

// ── NOTES ─────────────────────────────────────────────────────────────────────
let _noteSearch='',_noteSaveTmr=null,_draggingNoteId=null;

function renderNotes(){
  applyNotesLayout();renderNotesList();renderNoteEditor();
  document.getElementById('notes-search').oninput=e=>{_noteSearch=e.target.value;renderNotesList();};
  document.getElementById('notes-search').value=_noteSearch;
  document.getElementById('new-note-btn').onclick=()=>{const n={id:crypto.randomUUID(),title:'Untitled',body:'',groupId:null,updatedAt:new Date().toISOString()};saveNote(n);S.activeNoteId=n.id;renderNotesList();renderNoteEditor();};
  document.getElementById('new-group-btn').onclick=()=>{const g={id:crypto.randomUUID(),name:'New Group'};saveNoteGroup(g);renderNotesList();};
  document.getElementById('layout-two').onclick=()=>{S.notesLayout='two';saveLocal();applyNotesLayout();};
  document.getElementById('layout-one').onclick=()=>{S.notesLayout='one';saveLocal();applyNotesLayout();};
}

function applyNotesLayout(){
  const sidebar=document.getElementById('notes-sidebar');
  document.getElementById('layout-two')?.classList.toggle('active',S.notesLayout==='two');
  document.getElementById('layout-one')?.classList.toggle('active',S.notesLayout==='one');
  sidebar?.classList.toggle('hidden',S.notesLayout==='one');
}

function renderNotesList(){
  const container=document.getElementById('notes-groups-list');if(!container)return;
  let notes=[...S.notes];
  if(_noteSearch)notes=notes.filter(n=>(n.title||'').toLowerCase().includes(_noteSearch.toLowerCase())||(n.body||'').toLowerCase().includes(_noteSearch.toLowerCase()));
  notes.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  const ungrouped=notes.filter(n=>!n.groupId);
  let html=dropZoneHTML(null,'top')+ungrouped.map(n=>noteItemHTML(n)).join('')+dropZoneHTML(null,'bottom');
  S.noteGroups.forEach(g=>{
    html+=`<div class="note-group-section"><div class="note-group-header"><span class="note-group-name-lbl" data-gid="${g.id}">${esc(g.name)}</span><button class="notes-group-edit-btn" data-gedit="${g.id}">&#9998;</button></div>`;
    html+=dropZoneHTML(g.id,'top');
    const gnotes=notes.filter(n=>n.groupId===g.id);
    html+=gnotes.length?gnotes.map(n=>noteItemHTML(n)).join(''):'<div style="font-size:11px;color:var(--text3);padding:3px 10px 5px;">Empty</div>';
    html+=dropZoneHTML(g.id,'bottom')+'</div>';
  });
  container.innerHTML=html;
  container.querySelectorAll('.note-list-item[data-nid]').forEach(item=>{
    item.onclick=()=>{S.activeNoteId=item.dataset.nid;saveLocal();renderNoteEditor();container.querySelectorAll('.note-list-item').forEach(x=>x.classList.toggle('active',x.dataset.nid===S.activeNoteId));};
    item.addEventListener('dragstart',e=>{_draggingNoteId=item.dataset.nid;item.classList.add('dragging-note');e.dataTransfer.effectAllowed='move';});
    item.addEventListener('dragend',()=>{_draggingNoteId=null;item.classList.remove('dragging-note');container.querySelectorAll('.note-drop-zone').forEach(z=>z.classList.remove('drag-over'));});
  });
  container.querySelectorAll('.note-drop-zone').forEach(zone=>{
    zone.addEventListener('dragover',e=>{e.preventDefault();zone.classList.add('drag-over');});
    zone.addEventListener('dragleave',()=>zone.classList.remove('drag-over'));
    zone.addEventListener('drop',e=>{
      e.preventDefault();zone.classList.remove('drag-over');if(!_draggingNoteId)return;
      const gid=zone.dataset.gid==='null'?null:zone.dataset.gid;
      const note=S.notes.find(n=>n.id===_draggingNoteId);
      if(note){const updated={...note,groupId:gid,updatedAt:new Date().toISOString()};saveNote(updated);renderNotesList();}
    });
  });
  container.querySelectorAll('[data-gedit]').forEach(btn=>{
    btn.onclick=e=>{
      e.stopPropagation();const gid=btn.dataset.gedit;
      const nameEl=container.querySelector(`.note-group-name-lbl[data-gid="${gid}"]`);
      const g=S.noteGroups.find(x=>x.id===gid);if(!g||!nameEl)return;
      const inp=document.createElement('input');inp.className='notes-group-name-input';inp.value=g.name;
      nameEl.replaceWith(inp);inp.focus();inp.select();
      const commit=()=>{g.name=inp.value.trim()||g.name;saveNoteGroup(g);renderNotesList();};
      inp.onblur=commit;inp.onkeydown=e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){saveLocal();renderNotesList();}};
    };
  });
}

function dropZoneHTML(gid,pos){return`<div class="note-drop-zone" data-gid="${gid}" data-pos="${pos}" style="margin:2px 4px;"></div>`;}
function noteItemHTML(n){return`<div class="note-list-item${S.activeNoteId===n.id?' active':''}" data-nid="${n.id}" draggable="true"><div class="note-list-title">${esc(n.title||'Untitled')}</div><div class="note-list-preview">${stripHTML(n.body||'').slice(0,55)||'No content'}</div><div class="note-list-date">${new Date(n.updatedAt).toLocaleDateString()}</div></div>`;}
function stripHTML(html){const d=document.createElement('div');d.innerHTML=html;return d.textContent||d.innerText||'';}

function renderNoteEditor(){
  const emptyState=document.getElementById('note-empty-state'),editorWrap=document.getElementById('note-editor-wrap');if(!editorWrap)return;
  const note=S.notes.find(n=>n.id===S.activeNoteId);
  if(!note){emptyState.style.display='flex';editorWrap.classList.remove('open');return;}
  emptyState.style.display='none';editorWrap.classList.add('open');
  const titleInp=document.getElementById('note-title-inp'),content=document.getElementById('note-content'),charCount=document.getElementById('note-char-count'),groupSel=document.getElementById('note-group-sel');
  if(!content)return;
  titleInp.value=note.title||'';content.innerHTML=note.body||'';
  updateNoteCharCount(note);
  groupSel.innerHTML=`<option value="">No group</option>${S.noteGroups.map(g=>`<option value="${g.id}"${note.groupId===g.id?' selected':''}>${esc(g.name)}</option>`).join('')}`;
  groupSel.onchange=()=>{const n=S.notes.find(x=>x.id===S.activeNoteId);if(!n)return;saveNote({...n,groupId:groupSel.value||null,updatedAt:new Date().toISOString()});renderNotesList();};
  titleInp.oninput=()=>{const n=S.notes.find(x=>x.id===S.activeNoteId);if(!n)return;saveNote({...n,title:titleInp.value,updatedAt:new Date().toISOString()});clearTimeout(_noteSaveTmr);_noteSaveTmr=setTimeout(()=>renderNotesList(),400);};
  content.oninput=()=>{const n=S.notes.find(x=>x.id===S.activeNoteId);if(!n)return;if(stripHTML(content.innerHTML).length>NOTE_CHAR_LIMIT){content.innerHTML=n.body;return;}saveNote({...n,body:content.innerHTML,updatedAt:new Date().toISOString()});updateNoteCharCount(S.notes.find(x=>x.id===S.activeNoteId));clearTimeout(_noteSaveTmr);_noteSaveTmr=setTimeout(()=>renderNotesList(),600);};
  document.getElementById('note-del-btn').onclick=()=>{if(!confirm('Delete this note?'))return;removeNote(S.activeNoteId);S.activeNoteId=S.notes.length?S.notes[0].id:null;saveLocal();renderNotesList();renderNoteEditor();};
  setupRichText();
}

function updateNoteCharCount(n){const charCount=document.getElementById('note-char-count');if(!charCount||!n)return;const len=stripHTML(n.body||'').length;charCount.textContent=`${len} / ${NOTE_CHAR_LIMIT.toLocaleString()}`;charCount.style.color=len>NOTE_CHAR_LIMIT*0.9?'var(--danger)':'var(--text3)';}

function setupRichText(){
  const content=document.getElementById('note-content');if(!content)return;
  document.querySelectorAll('.rte-btn[data-cmd]').forEach(btn=>{btn.onclick=e=>{e.preventDefault();document.execCommand(btn.dataset.cmd,false,null);content.focus();};});
  document.getElementById('rte-undo')?.addEventListener('click',e=>{e.preventDefault();document.execCommand('undo');content.focus();});
  document.getElementById('rte-redo')?.addEventListener('click',e=>{e.preventDefault();document.execCommand('redo');content.focus();});
  document.getElementById('rte-format').onchange=function(){document.execCommand('formatBlock',false,this.value);content.focus();this.value='p';};
  document.getElementById('rte-size').onchange=function(){document.execCommand('fontSize',false,this.value);content.focus();};
  document.getElementById('rte-text-color').oninput=function(){document.execCommand('foreColor',false,this.value);content.focus();};
  document.getElementById('rte-bg-color').oninput=function(){document.execCommand('hiliteColor',false,this.value);content.focus();};
  document.getElementById('rte-link').onclick=()=>{const url=prompt('Enter URL:','https://');if(url)document.execCommand('createLink',false,url);content.focus();};
  document.getElementById('rte-quote').onclick=()=>{document.execCommand('formatBlock',false,'blockquote');content.focus();};
  const ft=document.getElementById('floating-toolbar');
  document.querySelectorAll('.ft-btn[data-cmd]').forEach(btn=>{btn.onclick=e=>{e.preventDefault();document.execCommand(btn.dataset.cmd,false,null);content.focus();};});
  document.getElementById('ft-link')?.addEventListener('click',()=>{const url=prompt('Enter URL:','https://');if(url)document.execCommand('createLink',false,url);content.focus();});
  content.addEventListener('mouseup',()=>setTimeout(showFloatingToolbar,10));
  document.addEventListener('mousedown',e=>{if(ft&&!ft.contains(e.target))ft.classList.remove('visible');});
}

function showFloatingToolbar(){
  const ft=document.getElementById('floating-toolbar');
  const sel=window.getSelection();
  if(!sel||sel.isCollapsed||!sel.rangeCount){ft?.classList.remove('visible');return;}
  const rect=sel.getRangeAt(0).getBoundingClientRect();
  if(rect.width===0){ft?.classList.remove('visible');return;}
  ft.classList.add('visible');
  ft.style.left=Math.max(50,rect.left+rect.width/2)+'px';
  ft.style.top=Math.max(10,rect.top+window.scrollY-44)+'px';
}

// ── JOURNAL ───────────────────────────────────────────────────────────────────
function countWords(s){return s.trim().split(/\s+/).filter(Boolean).length;}
function renderJournal(){
  const dateInput=document.getElementById('j-date'),ta=document.getElementById('j-text');if(!dateInput||!ta)return;
  dateInput.value=S.journalDate;ta.value=S.journal[S.journalDate]||'';updateJCount();
  let tmr;
  ta.oninput=()=>{if(countWords(ta.value)>JOURNAL_WORD_LIMIT)ta.value=ta.value.trim().split(/\s+/).slice(0,JOURNAL_WORD_LIMIT).join(' ');saveJournal(S.journalDate,ta.value);updateJCount();document.getElementById('j-status').textContent='Saving...';clearTimeout(tmr);tmr=setTimeout(()=>{document.getElementById('j-status').textContent='Auto-saved';},700);};
  dateInput.onchange=()=>{S.journalDate=dateInput.value;saveLocal();ta.value=S.journal[S.journalDate]||'';updateJCount();};
  document.getElementById('j-prev').onclick=()=>{const[y,m,d]=S.journalDate.split('-').map(Number);S.journalDate=dateKey(new Date(y,m-1,d-1));saveLocal();renderJournal();};
  document.getElementById('j-next').onclick=()=>{const[y,m,d]=S.journalDate.split('-').map(Number);S.journalDate=dateKey(new Date(y,m-1,d+1));saveLocal();renderJournal();};
}
function updateJCount(){const ta=document.getElementById('j-text'),c=document.getElementById('j-count');if(!ta||!c)return;const w=countWords(ta.value);c.textContent=`${w.toLocaleString()} / ${JOURNAL_WORD_LIMIT.toLocaleString()} words`;c.style.color=w>JOURNAL_WORD_LIMIT*0.9?'var(--danger)':'var(--text3)';}

// ── CALENDAR POPOUT ───────────────────────────────────────────────────────────
let _calPopView='month',_calPopYear=new Date().getFullYear(),_calPopMonth=new Date().getMonth();

function setupCalPopout(){
  document.getElementById('cal-popout-close')?.addEventListener('click',closeCalPopout);
  document.getElementById('cal-pop-prev')?.addEventListener('click',()=>{if(_calPopMonth===0){_calPopMonth=11;_calPopYear--;}else _calPopMonth--;renderCalPopout();});
  document.getElementById('cal-pop-next')?.addEventListener('click',()=>{if(_calPopMonth===11){_calPopMonth=0;_calPopYear++;}else _calPopMonth++;renderCalPopout();});
  document.getElementById('cal-pop-today')?.addEventListener('click',()=>{_calPopYear=new Date().getFullYear();_calPopMonth=new Date().getMonth();renderCalPopout();});
  document.getElementById('cal-pop-view-month')?.addEventListener('click',()=>{_calPopView='month';renderCalPopout();});
  document.getElementById('cal-pop-view-week')?.addEventListener('click',()=>{_calPopView='week';renderCalPopout();});
  document.getElementById('cal-popout-modal')?.addEventListener('click',e=>{if(e.target===document.getElementById('cal-popout-modal'))closeCalPopout();});
}

function openCalPopout(){
  _calPopYear=S.calYear;_calPopMonth=S.calMonth;
  document.getElementById('cal-popout-modal').classList.add('open');
  renderCalPopout();
}

function closeCalPopout(){document.getElementById('cal-popout-modal').classList.remove('open');}

function renderCalPopout(){
  const lbl=document.getElementById('cal-pop-month-lbl');
  if(lbl)lbl.textContent=MONTHS[_calPopMonth]+' '+_calPopYear;
  document.getElementById('cal-pop-view-month')?.classList.toggle('primary',_calPopView==='month');
  document.getElementById('cal-pop-view-week')?.classList.toggle('primary',_calPopView==='week');
  if(_calPopView==='month')renderCalPopMonth();else renderCalPopWeek();
}

function renderCalPopMonth(){
  const body=document.getElementById('cal-pop-body');if(!body)return;
  const dim=new Date(_calPopYear,_calPopMonth+1,0).getDate(),fdow=new Date(_calPopYear,_calPopMonth,1).getDay(),prevD=new Date(_calPopYear,_calPopMonth,0).getDate();
  let html='<div class="cal-pop-grid-month">';
  DAYS.forEach(d=>{html+=`<div class="cal-pop-day-name">${d}</div>`;});
  for(let i=0;i<fdow;i++){const d=prevD-fdow+1+i,ck=dateKey(new Date(_calPopYear,_calPopMonth-1,d));html+=calPopCell(ck,d,true);}
  for(let d=1;d<=dim;d++){html+=calPopCell(dateKey(new Date(_calPopYear,_calPopMonth,d)),d,false);}
  const trail=42-fdow-dim;for(let d=1;d<=trail;d++){html+=calPopCell(dateKey(new Date(_calPopYear,_calPopMonth+1,d)),d,true);}
  html+='</div>';body.innerHTML=html;
  body.querySelectorAll('.cal-pop-task-pill').forEach(pill=>{pill.onclick=e=>{e.stopPropagation();toggleTask(pill.dataset.key,pill.dataset.id);renderCalPopout();};});
  body.querySelectorAll('.cal-pop-cell[data-key]').forEach(cell=>{cell.onclick=()=>{S.selectedKey=cell.dataset.key;const[y,m]=cell.dataset.key.split('-').map(Number);S.calYear=y;S.calMonth=m-1;saveLocal();renderTasksWidget();renderCalWidget();};});
}

function calPopCell(ck,d,other){
  const tasks=getTasks(ck),isToday=ck===todayKey,isSel=ck===S.selectedKey;
  const show=tasks.slice(0,3),more=tasks.length-show.length;
  let pills=show.map(t=>{const cat=catById(t.cat);return`<div class="cal-pop-task-pill${t.done?' done-pill':''}" style="background:${cat.color}22;color:${cat.color}" data-key="${ck}" data-id="${t.id}">${esc(t.text)}</div>`;}).join('');
  if(more>0)pills+=`<div class="cal-pop-more">+${more} more</div>`;
  return`<div class="cal-pop-cell${other?' other-month':''}${isToday?' is-today':''}${isSel?' selected':''}" data-key="${ck}"><div class="cal-pop-date"><span>${d}</span></div>${pills}</div>`;
}

function renderCalPopWeek(){
  const body=document.getElementById('cal-pop-body');if(!body)return;
  const ref=S.selectedKey?new Date(S.selectedKey.split('-').map(Number).map((v,i)=>i===1?v-1:v)):new Date();
  const weekStart=new Date(ref);weekStart.setDate(ref.getDate()-ref.getDay());
  const weekDays=Array.from({length:7},(_,i)=>{const d=new Date(weekStart);d.setDate(weekStart.getDate()+i);return d;});
  let html='<div class="cal-pop-week-grid"><div class="cal-pop-week-header"></div>';
  weekDays.forEach(d=>{const ck=dateKey(d);html+=`<div class="cal-pop-week-header${ck===todayKey?' is-today-h':''}">${DAYS[d.getDay()]} ${d.getDate()}</div>`;});
  for(let h=0;h<24;h++){
    html+=`<div class="cal-pop-hour-lbl">${h===0?'12am':h<12?h+'am':h===12?'12pm':(h-12)+'pm'}</div>`;
    weekDays.forEach(d=>{
      const ck=dateKey(d);
      const hTasks=getTasks(ck).filter(t=>t.time&&parseInt(t.time.split(':')[0])===h);
      const allDay=h===0?getTasks(ck).filter(t=>!t.time):[];
      const pills=[...hTasks,...allDay].map(t=>{const cat=catById(t.cat);return`<div class="cal-pop-hour-task" style="background:${cat.color}22;color:${cat.color}">${esc(t.text)}</div>`;}).join('');
      html+=`<div class="cal-pop-hour-cell">${pills}</div>`;
    });
  }
  html+='</div>';body.innerHTML=html;
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function openSettings(){renderSettingsBody();document.getElementById('settings-panel').classList.add('open');document.getElementById('settings-overlay').classList.add('open');}
function closeSettings(){document.getElementById('settings-panel').classList.remove('open');document.getElementById('settings-overlay').classList.remove('open');}

function renderSettingsBody(){
  const el=document.getElementById('settings-body');if(!el)return;
  el.innerHTML=`
    <div class="settings-section">
      <h3>Categories</h3>
      ${BUILTIN_CATS.filter(c=>c.id!=='none').map(c=>`<div class="cat-row"><div class="cat-swatch" style="background:${c.color}"></div><span class="cat-row-name">${esc(c.label)}</span><span style="font-size:11px;color:var(--text3)">Built-in</span></div>`).join('')}
      ${(S.customCats||[]).map(c=>`<div class="cat-row"><div class="cat-swatch" style="background:${c.color}"></div><span class="cat-row-name">${esc(c.label)}</span><button class="cat-row-del" data-cdel="${c.id}">&#10005;</button></div>`).join('')}
      <div class="new-cat-form"><input type="text" id="scat-name" placeholder="Category name..."/><input type="color" class="color-pick" id="scat-color" value="#8b5cf6"/><button class="btn primary sm" id="scat-add">+ Add</button></div>
    </div>
    <div class="settings-section">
      <h3>Data</h3>
      <p>Your data syncs to Supabase automatically. Export a JSON backup anytime.</p>
      <div class="export-row">
        <button class="btn" id="export-btn">&#8595; Export JSON</button>
        <label class="btn" style="cursor:pointer;">&#8593; Import JSON<input type="file" accept=".json" id="import-file" style="display:none;"/></label>
      </div>
      <div class="danger-zone">
        <div class="section-label" style="color:var(--danger);margin-bottom:10px;">Danger Zone</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn danger sm" id="reset-widgets-btn">Reset Widgets</button>
          <button class="btn danger sm" id="clear-all-btn">Clear All Data</button>
        </div>
      </div>
    </div>`;
  el.querySelectorAll('[data-cdel]').forEach(b=>{b.onclick=()=>{removeCategory(b.dataset.cdel);injectCatStyles();renderSettingsBody();renderTasksWidget();};});
  el.querySelector('#scat-add').onclick=()=>{const name=el.querySelector('#scat-name').value.trim();if(!name)return;const color=el.querySelector('#scat-color').value;const cat={id:crypto.randomUUID(),label:name,color};saveCategory(cat);injectCatStyles();renderSettingsBody();renderTasksWidget();el.querySelector('#scat-name').value='';};
  el.querySelector('#export-btn').onclick=()=>{const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`progrex-backup-${todayKey}.json`;a.click();};
  el.querySelector('#import-file').onchange=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=ev=>{try{Object.assign(S,JSON.parse(ev.target.result));saveLocal();location.reload();}catch(err){alert('Invalid backup file.');}};reader.readAsText(file);};
  el.querySelector('#reset-widgets-btn').onclick=()=>{if(!confirm('Reset widget positions?'))return;S.widgets=defaultState().widgets;saveWidgets();renderTasksWidget();renderCalWidget();renderGoalsWidget();closeSettings();};
  el.querySelector('#clear-all-btn').onclick=()=>{if(!confirm('Delete ALL data? This cannot be undone.'))return;if(!confirm('Are you really sure?'))return;localStorage.clear();if(S.userId){sb.from('tasks').delete().eq('user_id',S.userId);sb.from('goals').delete().eq('user_id',S.userId);sb.from('notes').delete().eq('user_id',S.userId);sb.from('journal').delete().eq('user_id',S.userId);sb.from('categories').delete().eq('user_id',S.userId);}location.reload();};
}
