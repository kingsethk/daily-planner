// db.js — all Supabase database operations
// Each function tries Supabase first, falls back to localStorage

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── SYNC STATUS ───────────────────────────────────────────────────────────────
let _online = navigator.onLine;
window.addEventListener('online',  () => { _online = true;  syncPendingWrites(); showSyncStatus('Synced'); });
window.addEventListener('offline', () => { _online = false; showSyncStatus('Offline — saved locally'); });

function showSyncStatus(msg) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3000);
}

// Pending writes queue for offline support
const PENDING_KEY = 'progrex_pending';
function getPending() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch(e) { return []; } }
function addPending(op) { const q = getPending(); q.push(op); localStorage.setItem(PENDING_KEY, JSON.stringify(q)); }
function clearPending() { localStorage.removeItem(PENDING_KEY); }

async function syncPendingWrites() {
  const q = getPending();
  if (!q.length) return;
  const user = await getUser();
  if (!user) return;
  for (const op of q) {
    try {
      if (op.type === 'upsert') await sb.from(op.table).upsert(op.data);
      if (op.type === 'delete') await sb.from(op.table).delete().eq('id', op.id);
    } catch(e) { return; } // stop on first failure, retry later
  }
  clearPending();
  showSyncStatus('Synced ✓');
}

// ── USER ──────────────────────────────────────────────────────────────────────
async function getUser() {
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

// ── LOCAL CACHE ───────────────────────────────────────────────────────────────
const LS = {
  get: (k) => { try { return JSON.parse(localStorage.getItem('progrex_' + k) || 'null'); } catch(e) { return null; } },
  set: (k, v) => { try { localStorage.setItem('progrex_' + k, JSON.stringify(v)); } catch(e) {} },
};

// ── TASKS ─────────────────────────────────────────────────────────────────────
async function dbLoadTasks() {
  if (!_online) return LS.get('tasks') || {};
  const user = await getUser();
  if (!user) return LS.get('tasks') || {};
  const { data, error } = await sb.from('tasks').select('*').eq('user_id', user.id);
  if (error || !data) return LS.get('tasks') || {};
  // Convert array to {date: [tasks]} map
  const map = {};
  data.forEach(t => {
    if (!map[t.date]) map[t.date] = [];
    map[t.date].push({
      id: t.id, text: t.text, done: t.done, time: t.time,
      cat: t.cat, recurDays: t.recur_days || [], autoMove: t.auto_move,
    });
  });
  LS.set('tasks', map);
  return map;
}

async function dbSaveTask(date, task, userId) {
  const row = {
    id: task.id, user_id: userId, date, text: task.text, done: task.done,
    time: task.time || null, cat: task.cat || 'none',
    recur_days: task.recurDays || [], auto_move: task.autoMove || false,
    updated_at: new Date().toISOString(),
  };
  if (_online) {
    const { error } = await sb.from('tasks').upsert(row);
    if (!error) { showSyncStatus('Saved'); return; }
  }
  addPending({ type: 'upsert', table: 'tasks', data: row });
}

async function dbDeleteTask(taskId, userId) {
  if (_online) {
    await sb.from('tasks').delete().eq('id', taskId).eq('user_id', userId);
    showSyncStatus('Deleted');
  } else {
    addPending({ type: 'delete', table: 'tasks', id: taskId });
  }
}

// ── GOALS ─────────────────────────────────────────────────────────────────────
async function dbLoadGoals() {
  if (!_online) return LS.get('goals') || [];
  const user = await getUser();
  if (!user) return LS.get('goals') || [];
  const { data: gData } = await sb.from('goals').select('*').eq('user_id', user.id).order('created_at');
  const { data: stData } = await sb.from('subtasks').select('*').eq('user_id', user.id).order('created_at');
  if (!gData) return LS.get('goals') || [];
  const goals = gData.map(g => ({
    id: g.id, text: g.text, done: g.done, deadline: g.deadline,
    subtasks: (stData || []).filter(s => s.goal_id === g.id).map(s => ({ id: s.id, text: s.text, done: s.done })),
  }));
  LS.set('goals', goals);
  return goals;
}

async function dbSaveGoal(goal, userId) {
  const row = { id: goal.id, user_id: userId, text: goal.text, done: goal.done, deadline: goal.deadline || null };
  if (_online) { await sb.from('goals').upsert(row); showSyncStatus('Saved'); }
  else addPending({ type: 'upsert', table: 'goals', data: row });
}

async function dbDeleteGoal(goalId, userId) {
  if (_online) { await sb.from('goals').delete().eq('id', goalId).eq('user_id', userId); }
  else addPending({ type: 'delete', table: 'goals', id: goalId });
}

async function dbSaveSubtask(subtask, goalId, userId) {
  const row = { id: subtask.id, goal_id: goalId, user_id: userId, text: subtask.text, done: subtask.done };
  if (_online) { await sb.from('subtasks').upsert(row); }
  else addPending({ type: 'upsert', table: 'subtasks', data: row });
}

async function dbDeleteSubtask(subtaskId, userId) {
  if (_online) { await sb.from('subtasks').delete().eq('id', subtaskId).eq('user_id', userId); }
  else addPending({ type: 'delete', table: 'subtasks', id: subtaskId });
}

// ── NOTES ─────────────────────────────────────────────────────────────────────
async function dbLoadNotes() {
  if (!_online) return { notes: LS.get('notes') || [], groups: LS.get('noteGroups') || [] };
  const user = await getUser();
  if (!user) return { notes: LS.get('notes') || [], groups: LS.get('noteGroups') || [] };
  const { data: nData } = await sb.from('notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
  const { data: gData } = await sb.from('note_groups').select('*').eq('user_id', user.id).order('created_at');
  const notes = (nData || []).map(n => ({ id: n.id, title: n.title, body: n.body, groupId: n.group_id, updatedAt: n.updated_at }));
  const groups = (gData || []).map(g => ({ id: g.id, name: g.name }));
  LS.set('notes', notes);
  LS.set('noteGroups', groups);
  return { notes, groups };
}

async function dbSaveNote(note, userId) {
  const row = { id: note.id, user_id: userId, title: note.title || 'Untitled', body: note.body || '', group_id: note.groupId || null, updated_at: new Date().toISOString() };
  if (_online) { await sb.from('notes').upsert(row); }
  else addPending({ type: 'upsert', table: 'notes', data: row });
}

async function dbDeleteNote(noteId, userId) {
  if (_online) { await sb.from('notes').delete().eq('id', noteId).eq('user_id', userId); }
  else addPending({ type: 'delete', table: 'notes', id: noteId });
}

async function dbSaveNoteGroup(group, userId) {
  const row = { id: group.id, user_id: userId, name: group.name };
  if (_online) { await sb.from('note_groups').upsert(row); }
  else addPending({ type: 'upsert', table: 'note_groups', data: row });
}

async function dbDeleteNoteGroup(groupId, userId) {
  if (_online) { await sb.from('note_groups').delete().eq('id', groupId).eq('user_id', userId); }
  else addPending({ type: 'delete', table: 'note_groups', id: groupId });
}

// ── JOURNAL ───────────────────────────────────────────────────────────────────
async function dbLoadJournal() {
  if (!_online) return LS.get('journal') || {};
  const user = await getUser();
  if (!user) return LS.get('journal') || {};
  const { data } = await sb.from('journal').select('*').eq('user_id', user.id);
  const map = {};
  (data || []).forEach(j => { map[j.date] = j.body; });
  LS.set('journal', map);
  return map;
}

async function dbSaveJournal(date, body, userId) {
  const row = { user_id: userId, date, body, updated_at: new Date().toISOString() };
  if (_online) { await sb.from('journal').upsert(row, { onConflict: 'user_id,date' }); }
  else addPending({ type: 'upsert', table: 'journal', data: row });
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────
async function dbLoadCategories() {
  if (!_online) return LS.get('customCats') || [];
  const user = await getUser();
  if (!user) return LS.get('customCats') || [];
  const { data } = await sb.from('categories').select('*').eq('user_id', user.id).order('created_at');
  const cats = (data || []).map(c => ({ id: c.id, label: c.label, color: c.color }));
  LS.set('customCats', cats);
  return cats;
}

async function dbSaveCategory(cat, userId) {
  const row = { id: cat.id, user_id: userId, label: cat.label, color: cat.color };
  if (_online) { await sb.from('categories').upsert(row); }
  else addPending({ type: 'upsert', table: 'categories', data: row });
}

async function dbDeleteCategory(catId, userId) {
  if (_online) { await sb.from('categories').delete().eq('id', catId).eq('user_id', userId); }
  else addPending({ type: 'delete', table: 'categories', id: catId });
}

// ── WIDGET LAYOUT ─────────────────────────────────────────────────────────────
async function dbSaveWidgetLayout(layout, userId) {
  const row = { user_id: userId, layout, updated_at: new Date().toISOString() };
  if (_online) { await sb.from('widget_layouts').upsert(row, { onConflict: 'user_id' }); }
}

async function dbLoadWidgetLayout() {
  if (!_online) return null;
  const user = await getUser();
  if (!user) return null;
  const { data } = await sb.from('widget_layouts').select('layout').eq('user_id', user.id).single();
  return data?.layout || null;
}

// ── LOAD ALL (called on login) ────────────────────────────────────────────────
async function dbLoadAll() {
  const [tasks, goals, { notes, groups }, journal, customCats, widgetLayout] = await Promise.all([
    dbLoadTasks(), dbLoadGoals(), dbLoadNotes(),
    dbLoadJournal(), dbLoadCategories(), dbLoadWidgetLayout(),
  ]);
  return { tasks, goals, notes, noteGroups: groups, journal, customCats, widgetLayout };
}
