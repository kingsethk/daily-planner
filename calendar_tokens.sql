-- Add this to your Supabase SQL Editor
-- Creates the table that stores each user's secret calendar token

create table if not exists calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz default now()
);

-- Only the server (service role) can read tokens
-- Users can read/generate their own token via the app
alter table calendar_tokens enable row level security;
create policy "Users can read own token" on calendar_tokens
  for select using (auth.uid() = user_id);
create policy "Users can insert own token" on calendar_tokens
  for insert with check (auth.uid() = user_id);
create policy "Users can delete own token" on calendar_tokens
  for delete using (auth.uid() = user_id);
