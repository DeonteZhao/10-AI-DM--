create extension if not exists "pgcrypto";

create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  rule_set text not null,
  race text,
  role_class text,
  background text,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  module_id text not null,
  character_id uuid not null references characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists game_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  player_content text,
  ai_content text,
  created_at timestamptz not null default now()
);

alter table characters enable row level security;
alter table sessions enable row level security;
alter table game_logs enable row level security;

do $$
begin
  create policy "characters_anon_insert" on characters
    for insert to anon with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "characters_anon_select" on characters
    for select to anon using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "sessions_anon_insert" on sessions
    for insert to anon with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "sessions_anon_select" on sessions
    for select to anon using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "game_logs_anon_insert" on game_logs
    for insert to anon with check (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "game_logs_anon_select" on game_logs
    for select to anon using (true);
exception
  when duplicate_object then null;
end $$;
