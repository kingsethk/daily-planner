// app.js — main app init, integrates all modules with Supabase

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const JOURNAL_WORD_LIMIT=5000;
const NOTE_CHAR_LIMIT=10000;
const GOFUNDME='https://www.gofundme.com/f/help-fund-a-college-students-dreams';
const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const todayKey=dateKey(new Date());
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const BUILTIN_CATS=[
  {id:'none',label:'None',color:'#6b7280'},
  {id:'work',label:'Work',color:'#6366f1'},
  {id:'personal',label:'Personal',color:'#10b981'},
  {id:'health',label:'Health',color:'#f59e0b'},
  {id:'finance',label:'Finance',color:'#ec4899'},
];

// ── STATE ─────────────────────────────────────────────────────────────────────
function defaultState(){
  return{
    selectedKey:todayKey,calYear:new Date().getFullYear(),calMonth:new Date().getMonth(),
    tasks:{},filter:'all',catFilter:'all',
    notes:[],noteGroups:[],activeNoteId:null,notesLayout:'two',
    goals:[],journal:{},journalDate:todayKey,
    editingId:null,editingGoalId:null,customCats:[],
    userId: null,
    widgets:{
      tasks:{x:0,y:0,w:520,h:null,collapsed:false},
      calendar:{x:540,y:0,w:320,h:null,collapsed:false},
      goals:{x:540,y:400,w:320,h:null,collapsed:false}
    }
  };
}

let S = defaultState();

// ── SAVE ──────────────────────────────────────────────────────────────────────
// Saves to localStorage immediately, then syncs to Supabase
function saveLocal() {
  try { localStorage.setItem('progrex_state', JSON.stringify(S)); } catch(e) {}
}

// ── ON USER SIGNED IN ─────────────────────────────────────────────────────────
async function onUserSignedIn(user) {
  S.userId = user.id;
  updateUserBadge(user.email);
  showApp();
  showSyncStatus('Loading your data...');

  // Load from Supabase, merge with any local data
  try {
    const remote = await dbLoadAll();
    // Merge: remote wins for cloud data, but keep local unsaved tasks
    if (Object.keys(remote.tasks).length > 0) S.tasks = remote.tasks;
    if (remote.goals.length > 0) S.goals = remote.goals;
    if (remote.notes.length > 0) { S.notes = remote.notes; S.noteGroups = remote.noteGroups; }
    if (Object.keys(remote.journal).length > 0) S.journal = remote.journal;
    if (remote.customCats.length > 0) S.customCats = remote.customCats;
    if (remote.widgetLayout) S.widgets = { ...S.widgets, ...remote.widgetLayout };
    saveLocal();
    showSyncStatus('Data loaded ✓');
    // Push any pending offline writes
    syncPendingWrites();
  } catch(e) {
    // Fallback to local data
    const local = localStorage.getItem('progrex_state');
    if (local) { try { Object.assign(S, JSON.parse(local)); } catch(e2) {} }
    showSyncStatus('Offline — using local data');
  }

  initApp();
}

function updateUserBadge(email) {
  const badge = document.getElementById('user-badge');
  const avatar = document.getElementById('user-avatar');
  const emailEl = document.getElementById('user-email');
  if (badge) badge.style.display = 'flex';
  if (avatar) avatar.textContent = (email || 'U')[0].toUpperCase();
  if (emailEl) emailEl.textContent = email || '';
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function allCats(){return[...BUILTIN_CATS,...(S.customCats||[])];}
function catById(id){return allCats().find(c=>c.id===id)||BUILTIN_CATS[0];}
function injectCatStyles(){
  let el=document.getElementById('cat-styles');
  if(!el){el=document.createElement('style');el.id='cat-styles';document.head.appendChild(el);}
  el.textContent=(S.customCats||[]).map(c=>`.task-item.cat-${c.id}{border-left-color:${c.color};}`).join('');
}

// ── TASKS ─────────────────────────────────────────────────────────────────────
function getTasks(k){return S.tasks[k]||[];}
function setTasks(k,list){
  S.tasks[k]=list;
  saveLocal();
  // Async Supabase sync
  if (S.userId) {
    list.forEach(t => dbSaveTask(k, t, S.userId));
  }
}

function addTask(key,text,time,cat,recurDays,autoMove){
  const t={id:crypto.randomUUID(),text,done:false,time:time||null,cat:cat||'none',recurDays:recurDays||[],autoMove:!!autoMove};
  const list=getTasks(key);list.push(t);setTasks(key,list);
  if(recurDays&&recurDays.length>0){
    const now=new Date(),winEnd=new Date(now.getFullYear(),now.getMonth()+6,0);
    const[sy,sm,sd]=key.split('-').map(Number);let cur=new Date(sy,sm-1,sd+1);
    while(cur<=winEnd){if(recurDays.includes(cur.getDay())){const k2=dateKey(cur);const l2=getTasks(k2);l2.push({...t,id:crypto.randomUUID(),done:false});setTasks(k2,l2);}cur.setDate(cur.getDate()+1);}
  }
}

function toggleTask(k,id){
  const list = getTasks(k).map(t=>t.id===id?{...t,done:!t.done}:t);
  S.tasks[k] = list; saveLocal();
  if (S.userId) { const t = list.find(x=>x.id===id); if(t) dbSaveTask(k, t, S.userId); }
}

function deleteTask(k,id){
  S.tasks[k]=getTasks(k).filter(t=>t.id!==id);
  saveLocal();
  if (S.userId) dbDeleteTask(id, S.userId);
}

function saveTaskEdit(k,id,text,cat,time){
  S.tasks[k]=getTasks(k).map(t=>t.id===id?{...t,text,cat,time:time||null}:t);
  S.editingId=null;saveLocal();
  if (S.userId) { const t = S.tasks[k].find(x=>x.id===id); if(t) dbSaveTask(k, t, S.userId); }
}

function moveToNext(k,id){
  const t=getTasks(k).find(x=>x.id===id);if(!t)return;
  deleteTask(k,id);
  const[y,m,d]=k.split('-').map(Number);
  const nk=dateKey(new Date(y,m-1,d+1));
  const l=getTasks(nk);l.push({...t,id:crypto.randomUUID(),done:false});setTasks(nk,l);
}

function isOverdue(k,t){if(t.done)return false;if(k<todayKey)return true;if(k===todayKey&&t.time){const now=new Date(),[h,m]=t.time.split(':').map(Number);return now>new Date(now.getFullYear(),now.getMonth(),now.getDate(),h,m);}return false;}
function getOverdueDays(){return Object.keys(S.tasks).filter(k=>k<todayKey).sort().map(k=>({key:k,tasks:getTasks(k).filter(t=>!t.done)})).filter(o=>o.tasks.length);}
function getUpcoming(){const res=[];const base=new Date();base.setHours(0,0,0,0);for(let i=1;i<=45&&res.length<5;i++){const d=new Date(base);d.setDate(d.getDate()+i);const k=dateKey(d);const tasks=getTasks(k).filter(t=>!t.done);if(tasks.length)res.push({key:k,label:`${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`,tasks});}return res;}
function fmtKey(k){const[y,m,d]=k.split('-').map(Number);const dt=new Date(y,m-1,d);const long=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dt.getDay()];return{big:`${long}, ${MONTHS[m-1]} ${d}`,sub:k===todayKey?'Today':(y!==new Date().getFullYear()?String(y):''),short:`${MONTHS[m-1].slice(0,3)} ${d}`};}
function goalExpired(g){return!g.done&&g.deadline&&g.deadline<todayKey;}

// Auto-move
(function autoMove(){const y=new Date();y.setDate(y.getDate()-1);const yk=dateKey(y);getTasks(yk).filter(t=>!t.done&&t.autoMove).forEach(t=>{deleteTask(yk,t.id);const l=getTasks(todayKey);l.push({...t,id:crypto.randomUUID(),done:false});setTasks(todayKey,l);});})();

// Prune old data
function pruneOldData(){const now=new Date();const past=dateKey(new Date(now.getFullYear(),now.getMonth()-6,1));const future=dateKey(new Date(now.getFullYear(),now.getMonth()+6,1));Object.keys(S.tasks).forEach(k=>{if(k<past||k>future)delete S.tasks[k];});saveLocal();}

// ── GOALS ─────────────────────────────────────────────────────────────────────
function saveGoal(goal){
  const idx = S.goals.findIndex(g=>g.id===goal.id);
  if (idx>=0) S.goals[idx]=goal; else S.goals.push(goal);
  saveLocal();
  if (S.userId) dbSaveGoal(goal, S.userId);
}

function removeGoal(id){
  S.goals=S.goals.filter(g=>g.id!==id);
  saveLocal();
  if (S.userId) dbDeleteGoal(id, S.userId);
}

function saveSubtask(goalId, subtask){
  S.goals=S.goals.map(g=>g.id===goalId?{...g,subtasks:[...(g.subtasks||[]).filter(s=>s.id!==subtask.id),subtask]}:g);
  saveLocal();
  if (S.userId) dbSaveSubtask(subtask, goalId, S.userId);
}

function removeSubtask(goalId, subtaskId){
  S.goals=S.goals.map(g=>g.id===goalId?{...g,subtasks:(g.subtasks||[]).filter(s=>s.id!==subtaskId)}:g);
  saveLocal();
  if (S.userId) dbDeleteSubtask(subtaskId, S.userId);
}

// ── NOTES ─────────────────────────────────────────────────────────────────────
function saveNote(note){
  const idx=S.notes.findIndex(n=>n.id===note.id);
  if(idx>=0)S.notes[idx]=note;else S.notes.unshift(note);
  saveLocal();
  if(S.userId) dbSaveNote(note, S.userId);
}

function removeNote(id){
  S.notes=S.notes.filter(n=>n.id!==id);
  saveLocal();
  if(S.userId) dbDeleteNote(id, S.userId);
}

function saveNoteGroup(group){
  const idx=S.noteGroups.findIndex(g=>g.id===group.id);
  if(idx>=0)S.noteGroups[idx]=group;else S.noteGroups.push(group);
  saveLocal();
  if(S.userId) dbSaveNoteGroup(group, S.userId);
}

// ── JOURNAL ───────────────────────────────────────────────────────────────────
function saveJournal(date, body){
  S.journal[date]=body;
  saveLocal();
  if(S.userId) dbSaveJournal(date, body, S.userId);
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────
function saveCategory(cat){
  const idx=S.customCats.findIndex(c=>c.id===cat.id);
  if(idx>=0)S.customCats[idx]=cat;else S.customCats.push(cat);
  saveLocal();
  if(S.userId) dbSaveCategory(cat, S.userId);
}

function removeCategory(id){
  S.customCats=S.customCats.filter(c=>c.id!==id);
  saveLocal();
  if(S.userId) dbDeleteCategory(id, S.userId);
}

// ── WIDGET LAYOUT ─────────────────────────────────────────────────────────────
function saveWidgets(){
  saveLocal();
  if(S.userId) dbSaveWidgetLayout(S.widgets, S.userId);
}

// ── INACTIVITY REFRESH ────────────────────────────────────────────────────────
let _inactivityTimer=null;
const INACTIVITY_MS=45*60*1000;
function resetInactivityTimer(){
  clearTimeout(_inactivityTimer);
  _inactivityTimer=setTimeout(()=>{saveLocal();location.reload();},INACTIVITY_MS);
}
['mousemove','keydown','click','scroll','touchstart'].forEach(evt=>document.addEventListener(evt,resetInactivityTimer,{passive:true}));
resetInactivityTimer();

// ── PAGE INIT ─────────────────────────────────────────────────────────────────
function initApp(){
  pruneOldData();
  injectCatStyles();
  renderTasksWidget();
  renderCalWidget();
  renderGoalsWidget();
  setupPageNav();
  setupGlobalEvents();
}

function setupGlobalEvents(){
  document.getElementById('donate-trigger')?.addEventListener('click',()=>window.open(GOFUNDME,'_blank'));
  document.getElementById('settings-btn')?.addEventListener('click',openSettings);
  document.getElementById('settings-close')?.addEventListener('click',closeSettings);
  document.getElementById('settings-overlay')?.addEventListener('click',closeSettings);
  document.getElementById('signout-btn')?.addEventListener('click',signOut);
  setupGoalModal();
  setupCalPopout();
}

function setupPageNav(){
  document.querySelectorAll('.nav-tab').forEach(tab=>{
    tab.addEventListener('click',()=>switchPage(tab.dataset.page));
  });
}

function switchPage(page){
  document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelector(`.nav-tab[data-page="${page}"]`)?.classList.add('active');
  document.getElementById('page-'+page)?.classList.add('active');
  if(page==='notes')renderNotes();
  if(page==='journal')renderJournal();
}

// ── BOOT ──────────────────────────────────────────────────────────────────────
async function boot(){
  setupAuthListeners();
  const session = await getSession();
  if (session) {
    await onUserSignedIn(session.user);
  } else {
    // Check for magic link in URL
    const hash = window.location.hash;
    if (hash.includes('access_token')) {
      // Supabase handles this via onAuthStateChange
      showApp(); // temporary, auth state change will fire
    } else {
      // Try local data for offline use
      const local = localStorage.getItem('progrex_state');
      if (local) {
        try { Object.assign(S, JSON.parse(local)); } catch(e) {}
      }
      showAuthScreen();
    }
  }
}

boot();
