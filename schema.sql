-- Run this entire file in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- It creates all tables with Row Level Security so users only see their own data.

-- CATEGORIES
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  label text not null,
  color text not null default '#6366f1',
  created_at timestamptz default now()
);
alter table categories enable row level security;
create policy "Users own categories" on categories for all using (auth.uid() = user_id);

-- TASKS
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  text text not null,
  done boolean default false,
  time text,
  cat text default 'none',
  recur_days int[] default '{}',
  auto_move boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table tasks enable row level security;
create policy "Users own tasks" on tasks for all using (auth.uid() = user_id);

-- GOALS
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  done boolean default false,
  deadline text,
  created_at timestamptz default now()
);
alter table goals enable row level security;
create policy "Users own goals" on goals for all using (auth.uid() = user_id);

-- SUBTASKS
create table if not exists subtasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  done boolean default false,
  created_at timestamptz default now()
);
alter table subtasks enable row level security;
create policy "Users own subtasks" on subtasks for all using (auth.uid() = user_id);

-- NOTE GROUPS
create table if not exists note_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'New Group',
  created_at timestamptz default now()
);
alter table note_groups enable row level security;
create policy "Users own note_groups" on note_groups for all using (auth.uid() = user_id);

-- NOTES
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default 'Untitled',
  body text default '',
  group_id uuid references note_groups(id) on delete set null,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);
alter table notes enable row level security;
create policy "Users own notes" on notes for all using (auth.uid() = user_id);

-- JOURNAL
create table if not exists journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date text not null,
  body text default '',
  updated_at timestamptz default now(),
  unique(user_id, date)
);
alter table journal enable row level security;
create policy "Users own journal" on journal for all using (auth.uid() = user_id);

-- WIDGET LAYOUT (saves widget positions per user)
create table if not exists widget_layouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  layout jsonb default '{}',
  updated_at timestamptz default now()
);
alter table widget_layouts enable row level security;
create policy "Users own widget_layouts" on widget_layouts for all using (auth.uid() = user_id);
