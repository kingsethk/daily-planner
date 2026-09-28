// api/calendar/[token].js
// Vercel serverless function — generates iCal feed from Supabase tasks
// URL: https://your-domain.vercel.app/api/calendar/YOUR_SECRET_TOKEN

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service role key — server only

// Format date as iCal YYYYMMDD
function icalDate(dateStr) {
  return dateStr.replace(/-/g, '');
}

// Format datetime as iCal YYYYMMDDTHHMMSSZ
function icalDateTime(dateStr, timeStr) {
  if (!timeStr) return icalDate(dateStr);
  const [h, m] = timeStr.split(':');
  return `${dateStr.replace(/-/g, '')}T${h}${m}00`;
}

// Escape special chars for iCal
function icalEscape(str) {
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Fold long lines per iCal spec (max 75 chars per line)
function foldLine(line) {
  if (line.length <= 75) return line;
  let out = '';
  while (line.length > 75) {
    out += line.slice(0, 75) + '\r\n ';
    line = line.slice(75);
  }
  out += line;
  return out;
}

function generateUID(taskId, date) {
  return `${taskId}-${date}@progrex.app`;
}

module.exports = async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('Missing token');
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).send('Server configuration error');
  }

  // Create Supabase admin client (bypasses RLS to look up token)
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Look up which user owns this token
  const { data: tokenRow, error: tokenErr } = await sb
    .from('calendar_tokens')
    .select('user_id')
    .eq('token', token)
    .single();

  if (tokenErr || !tokenRow) {
    return res.status(404).send('Invalid or expired calendar token');
  }

  const userId = tokenRow.user_id;

  // Fetch all tasks for this user
  const { data: tasks, error: tasksErr } = await sb
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (tasksErr) {
    return res.status(500).send('Error fetching tasks');
  }

  // Fetch user email for calendar name
  const { data: userData } = await sb.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email || 'Progrex User';

  // Build iCal string
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Progrex//Progrex Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:Progrex — ${userEmail}`),
    'X-WR-TIMEZONE:America/New_York',
    'X-WR-CALDESC:Tasks from Progrex daily planner',
  ].join('\r\n');

  // Add each task as a VEVENT
  for (const task of tasks || []) {
    const dtStart = icalDateTime(task.date, task.time);
    const dtEnd   = task.time
      ? icalDateTime(task.date, task.time) // same time, Canvas will handle duration
      : icalDate(task.date);

    const status  = task.done ? 'COMPLETED' : 'NEEDS-ACTION';
    const cat     = task.cat && task.cat !== 'none' ? task.cat.toUpperCase() : '';

    const lines = [
      '\r\nBEGIN:VEVENT',
      foldLine(`UID:${generateUID(task.id, task.date)}`),
      `DTSTAMP:${now}`,
      task.time
        ? `DTSTART:${dtStart}`
        : `DTSTART;VALUE=DATE:${dtStart}`,
      task.time
        ? `DTEND:${dtEnd}`
        : `DTEND;VALUE=DATE:${icalDate(task.date)}`,
      foldLine(`SUMMARY:${icalEscape(task.text)}`),
      `STATUS:${status}`,
      cat ? `CATEGORIES:${cat}` : '',
      task.done ? `COMPLETED:${now}` : '',
      `X-APPLE-SORT-ORDER:0`,
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');

    ical += lines;
  }

  ical += '\r\nEND:VCALENDAR';

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'inline; filename="progrex.ics"');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).send(ical);
};
