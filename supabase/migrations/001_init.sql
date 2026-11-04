-- Tour Interativo pela Escola
-- Execute este arquivo uma vez no SQL Editor do Supabase (ou via CLI).
-- A service_role permanece apenas no servidor. O frontend usa a chave anon.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  school_name text not null default 'Escola Horizonte',
  logo_url text,
  cover_url text,
  game_title text not null default 'TOUR INTERATIVO PELA ESCOLA',
  welcome_text text not null,
  success_title text not null,
  success_detail text not null,
  encourage_title text not null,
  encourage_detail text not null,
  start_button_label text not null default 'COMEÇAR TOUR',
  retry_button_label text not null default 'TENTAR NOVAMENTE',
  font_family text not null default 'Nunito',
  font_scale numeric not null default 1,
  color_primary text not null default '#0b6e62',
  color_secondary text not null default '#e39b2b',
  color_background text not null default '#eef6f3',
  color_button text not null default '#0b6e62',
  color_text text not null default '#14312e',
  color_progress text not null default '#d86b2a',
  collect_class boolean not null default true,
  approval_threshold int not null default 100,
  on_fail text not null default 'retry' check (on_fail in ('retry', 'continue')),
  quiz_enabled boolean not null default true,
  quiz_time_total int not null default 180,
  quiz_time_per_question int not null default 30,
  quiz_attempts int not null default 2,
  quiz_random_order boolean not null default false,
  quiz_max_score int not null default 50,
  puzzle_enabled boolean not null default true,
  puzzle_time_total int not null default 180,
  puzzle_attempts int not null default 2,
  puzzle_difficulty text not null default 'easy' check (puzzle_difficulty in ('easy', 'medium', 'hard')),
  puzzle_score int not null default 24,
  puzzle_speed_bonus int not null default 6,
  puzzle_selected_id uuid references public.puzzles (id) on delete set null,
  words_enabled boolean not null default true,
  words_time_total int not null default 50,
  words_attempts int not null default 2,
  words_fall_speed text not null default 'normal'
    check (words_fall_speed in ('very_slow', 'slow', 'normal', 'fast', 'very_fast', 'custom')),
  words_custom_speed numeric not null default 80,
  words_spawn_interval_ms int not null default 1100,
  words_max_simultaneous int not null default 5,
  words_penalty int not null default 4,
  words_max_score int not null default 40,
  updated_at timestamptz not null default now()
);

create table if not exists public.audio_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  master_volume numeric not null default 0.85,
  music_volume numeric not null default 0.45,
  sfx_volume numeric not null default 0.9,
  tracks jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  image_url text,
  points int not null default 10 check (points >= 0 and points <= 1000),
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.alternatives (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  position int not null default 0
);

create table if not exists public.words (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  is_correct boolean not null default false,
  points int not null default 4 check (points >= 0 and points <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'finished')),
  quiz_score int not null default 0,
  puzzle_score int not null default 0,
  words_score int not null default 0,
  total_score int not null default 0,
  quiz_time_ms int not null default 0,
  puzzle_time_ms int not null default 0,
  words_time_ms int not null default 0,
  total_time_ms int not null default 0,
  error_count int not null default 0,
  quiz_attempts_used int not null default 0,
  puzzle_attempts_used int not null default 0,
  words_attempts_used int not null default 0,
  quiz_status text not null default 'pending' check (quiz_status in ('pending', 'active', 'locked')),
  puzzle_status text not null default 'pending' check (puzzle_status in ('pending', 'active', 'locked')),
  words_status text not null default 'pending' check (words_status in ('pending', 'active', 'locked')),
  quiz_errors int not null default 0,
  puzzle_errors int not null default 0,
  words_errors int not null default 0,
  budget jsonb not null default '{}'::jsonb,
  result text check (result in ('aprovado', 'incentivo')),
  result_title text,
  result_detail text,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  phase text not null check (phase in ('quiz', 'puzzle', 'words')),
  attempt_number int not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  score int not null default 0,
  time_ms int not null default 0,
  errors int not null default 0,
  status text not null default 'active' check (status in ('active', 'finished')),
  meta jsonb not null default '{}'::jsonb,
  secret jsonb not null default '{}'::jsonb,
  unique (session_id, phase, attempt_number)
);

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null,
  alternative_id uuid,
  is_correct boolean not null default false,
  points int not null default 0,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create table if not exists public.word_instances (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  word_id uuid not null,
  style int not null default 0,
  spawned_at timestamptz not null default now(),
  resolved_at timestamptz,
  outcome text check (outcome in ('hit', 'expired')),
  delta int not null default 0
);

create index if not exists questions_position_idx on public.questions (position);
create index if not exists alternatives_question_idx on public.alternatives (question_id, position);
create index if not exists attempts_session_idx on public.attempts (session_id, phase);
create unique index if not exists attempts_one_active_idx on public.attempts (session_id, phase) where status = 'active';
create index if not exists word_instances_attempt_idx on public.word_instances (attempt_id);
create index if not exists sessions_created_idx on public.sessions (created_at desc);

alter table public.admins enable row level security;
alter table public.puzzles enable row level security;
alter table public.settings enable row level security;
alter table public.audio_settings enable row level security;
alter table public.questions enable row level security;
alter table public.alternatives enable row level security;
alter table public.words enable row level security;
alter table public.participants enable row level security;
alter table public.sessions enable row level security;
alter table public.attempts enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.word_instances enable row level security;

alter table public.admins force row level security;
alter table public.puzzles force row level security;
alter table public.settings force row level security;
alter table public.audio_settings force row level security;
alter table public.questions force row level security;
alter table public.alternatives force row level security;
alter table public.words force row level security;
alter table public.participants force row level security;
alter table public.sessions force row level security;
alter table public.attempts force row level security;
alter table public.quiz_answers force row level security;
alter table public.word_instances force row level security;

revoke all on public.admins from anon, authenticated;
revoke all on public.puzzles from anon, authenticated;
revoke all on public.settings from anon, authenticated;
revoke all on public.audio_settings from anon, authenticated;
revoke all on public.questions from anon, authenticated;
revoke all on public.alternatives from anon, authenticated;
revoke all on public.words from anon, authenticated;
revoke all on public.participants from anon, authenticated;
revoke all on public.sessions from anon, authenticated;
revoke all on public.attempts from anon, authenticated;
revoke all on public.quiz_answers from anon, authenticated;
revoke all on public.word_instances from anon, authenticated;

grant select, insert, update, delete on public.admins to authenticated;
grant select, insert, update, delete on public.puzzles to authenticated;
grant select, insert, update, delete on public.settings to authenticated;
grant select, insert, update, delete on public.audio_settings to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update, delete on public.alternatives to authenticated;
grant select, insert, update, delete on public.words to authenticated;
grant select, insert, update, delete on public.participants to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.attempts to authenticated;
grant select, insert, update, delete on public.quiz_answers to authenticated;
grant select, insert, update, delete on public.word_instances to authenticated;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists puzzles_admin on public.puzzles;
create policy puzzles_admin on public.puzzles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists settings_admin on public.settings;
create policy settings_admin on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists audio_admin on public.audio_settings;
create policy audio_admin on public.audio_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists questions_admin on public.questions;
create policy questions_admin on public.questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists alternatives_admin on public.alternatives;
create policy alternatives_admin on public.alternatives
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists words_admin on public.words;
create policy words_admin on public.words
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists participants_admin on public.participants;
create policy participants_admin on public.participants
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists sessions_admin on public.sessions;
create policy sessions_admin on public.sessions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists attempts_admin on public.attempts;
create policy attempts_admin on public.attempts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists quiz_answers_admin on public.quiz_answers;
create policy quiz_answers_admin on public.quiz_answers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists word_instances_admin on public.word_instances;
create policy word_instances_admin on public.word_instances
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Visões públicas: identidade visual e regras de tempo, sem gabarito e sem classificação das palavras.
drop view if exists public.public_settings;
create view public.public_settings
with (security_invoker = false) as
select
  s.school_name,
  s.logo_url,
  s.cover_url,
  s.game_title,
  s.welcome_text,
  s.success_title,
  s.success_detail,
  s.encourage_title,
  s.encourage_detail,
  s.start_button_label,
  s.retry_button_label,
  s.font_family,
  s.font_scale,
  s.color_primary,
  s.color_secondary,
  s.color_background,
  s.color_button,
  s.color_text,
  s.color_progress,
  s.collect_class,
  s.approval_threshold,
  s.on_fail,
  s.quiz_enabled,
  s.quiz_time_total,
  s.quiz_time_per_question,
  s.quiz_attempts,
  s.quiz_max_score,
  s.puzzle_enabled,
  s.puzzle_time_total,
  s.puzzle_attempts,
  s.puzzle_difficulty,
  s.puzzle_score,
  s.puzzle_speed_bonus,
  s.puzzle_selected_id,
  p.title as puzzle_title,
  p.image_url as puzzle_image_url,
  s.words_enabled,
  s.words_time_total,
  s.words_attempts,
  s.words_fall_speed,
  s.words_custom_speed,
  s.words_spawn_interval_ms,
  s.words_max_simultaneous,
  s.words_max_score
from public.settings s
left join public.puzzles p on p.id = s.puzzle_selected_id
where s.id = 1;

drop view if exists public.public_audio;
create view public.public_audio
with (security_invoker = false) as
select enabled, master_volume, music_volume, sfx_volume, tracks
from public.audio_settings
where id = 1;

revoke all on public.public_settings from public, anon, authenticated;
revoke all on public.public_audio from public, anon, authenticated;
grant select on public.public_settings to anon, authenticated;
grant select on public.public_audio to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('branding', 'branding', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('puzzles', 'puzzles', true, 8388608, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('questions', 'questions', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('audio', 'audio', true, 8388608, array['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tour_storage_read on storage.objects;
create policy tour_storage_read on storage.objects
  for select to public
  using (bucket_id in ('branding', 'puzzles', 'questions', 'audio'));

drop policy if exists tour_storage_insert on storage.objects;
create policy tour_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('branding', 'puzzles', 'questions', 'audio')
    and public.is_admin()
  );

drop policy if exists tour_storage_update on storage.objects;
create policy tour_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('branding', 'puzzles', 'questions', 'audio')
    and public.is_admin()
  )
  with check (
    bucket_id in ('branding', 'puzzles', 'questions', 'audio')
    and public.is_admin()
  );

drop policy if exists tour_storage_delete on storage.objects;
create policy tour_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('branding', 'puzzles', 'questions', 'audio')
    and public.is_admin()
  );
