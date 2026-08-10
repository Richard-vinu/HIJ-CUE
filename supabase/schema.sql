-- HIJ Cue schema + seed
-- Run in Supabase SQL Editor (once).

create extension if not exists "pgcrypto";

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  email text not null unique,
  is_admin boolean not null default false,
  is_super_admin boolean not null default false,
  avatar_style text,
  avatar_seed text,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Existing projects that already created people without these columns:
alter table public.people
  add column if not exists is_super_admin boolean not null default false;

alter table public.people
  add column if not exists avatar_style text;

alter table public.people
  add column if not exists avatar_seed text;

-- Optional free-text role (UI also stores roles in Storage meta/people-roles.json)
alter table public.people
  add column if not exists role text;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  assignee_id uuid references public.people (id) on delete set null,
  due_date date not null,
  status text not null default 'To do'
    check (status in ('To do', 'In progress', 'Done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid not null references public.people (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  name text not null,
  size_bytes bigint not null default 0,
  storage_path text not null,
  mime_type text,
  uploaded_by uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists tasks_due_date_idx on public.tasks (due_date);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id);
create index if not exists comments_task_idx on public.comments (task_id);
create index if not exists attachments_task_idx on public.attachments (task_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.people p
    where p.auth_user_id = auth.uid() and p.is_admin = true
  );
$$;

alter table public.people enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;

drop policy if exists "people_select_all" on public.people;
create policy "people_select_all" on public.people for select using (true);

drop policy if exists "people_admin_write" on public.people;
create policy "people_admin_write" on public.people
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "tasks_select_all" on public.tasks;
create policy "tasks_select_all" on public.tasks for select using (true);

drop policy if exists "tasks_update_all" on public.tasks;
create policy "tasks_update_all" on public.tasks for update using (true) with check (true);

drop policy if exists "tasks_admin_insert" on public.tasks;
create policy "tasks_admin_insert" on public.tasks
  for insert with check (public.is_admin());

drop policy if exists "tasks_admin_delete" on public.tasks;
create policy "tasks_admin_delete" on public.tasks
  for delete using (public.is_admin());

drop policy if exists "comments_select_all" on public.comments;
create policy "comments_select_all" on public.comments for select using (true);

drop policy if exists "comments_insert_all" on public.comments;
create policy "comments_insert_all" on public.comments for insert with check (true);

drop policy if exists "comments_admin_delete" on public.comments;
create policy "comments_admin_delete" on public.comments
  for delete using (public.is_admin());

drop policy if exists "attachments_select_all" on public.attachments;
create policy "attachments_select_all" on public.attachments for select using (true);

drop policy if exists "attachments_insert_all" on public.attachments;
create policy "attachments_insert_all" on public.attachments for insert with check (true);

drop policy if exists "attachments_admin_delete" on public.attachments;
drop policy if exists "attachments_delete_all" on public.attachments;
create policy "attachments_delete_all" on public.attachments
  for delete using (true);

insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', true)
on conflict (id) do update set public = true;

drop policy if exists "task_files_read" on storage.objects;
create policy "task_files_read" on storage.objects
  for select using (bucket_id = 'task-files');

drop policy if exists "task_files_upload" on storage.objects;
create policy "task_files_upload" on storage.objects
  for insert with check (bucket_id = 'task-files');

drop policy if exists "task_files_admin_delete" on storage.objects;
drop policy if exists "task_files_delete" on storage.objects;
create policy "task_files_delete" on storage.objects
  for delete using (bucket_id = 'task-files');

drop policy if exists "task_files_update" on storage.objects;
create policy "task_files_update" on storage.objects
  for update using (bucket_id = 'task-files')
  with check (bucket_id = 'task-files');

-- Fixed IDs for stable seed / admin linking
insert into public.people (id, slug, name, email, is_admin, is_super_admin) values
  ('11111111-1111-1111-1111-111111111001', 'anish', 'Pastor Anish', 'pr.anish@hij.church', true, true),
  ('11111111-1111-1111-1111-111111111002', 'baji', 'Baji', 'baji@hij.church', false, false),
  ('11111111-1111-1111-1111-111111111003', 'elvin', 'Elvin', 'elvin@hij.church', false, false),
  ('11111111-1111-1111-1111-111111111004', 'jayashree', 'Jayashree', 'jayashree@hij.church', false, false),
  ('11111111-1111-1111-1111-111111111005', 'jeswin', 'Jeswin', 'jeswin@hij.church', false, false),
  ('11111111-1111-1111-1111-111111111006', 'prasthuthi', 'Prasthuthi', 'prasthuthi@hij.church', false, false),
  ('11111111-1111-1111-1111-111111111007', 'sushma', 'Sushma', 'sushma@hij.church', true, false),
  ('11111111-1111-1111-1111-111111111008', 'nikhil', 'Nikhil', 'nikhil@hij.church', false, false),
  ('11111111-1111-1111-1111-111111111009', 'deepak', 'Deepak', 'deepak@hij.church', true, false),
  ('11111111-1111-1111-1111-111111111010', 'asher', 'Asher', 'asher@hij.church', false, false)
on conflict (slug) do update set
  name = excluded.name,
  email = excluded.email,
  is_admin = excluded.is_admin,
  is_super_admin = excluded.is_super_admin;

insert into public.tasks (id, title, description, assignee_id, due_date, status) values
  (
    '22222222-2222-2222-2222-222222222001',
    'Song list in running order',
    'Final running order for Saturday 15 August, including the opening and the response after the message.',
    '11111111-1111-1111-1111-111111111006',
    '2026-08-15',
    'To do'
  ),
  (
    '22222222-2222-2222-2222-222222222002',
    'Share whole day schedule with timings',
    'Full Saturday timings from setup through to pack down, so media and sound know when they are needed.',
    '11111111-1111-1111-1111-111111111010',
    '2026-08-15',
    'To do'
  ),
  (
    '22222222-2222-2222-2222-222222222003',
    'Send lyrics for new songs',
    'Two new songs this month. Lyrics need to be in ProPresenter before the run-through.',
    '11111111-1111-1111-1111-111111111006',
    '2026-08-15',
    'In progress'
  ),
  (
    '22222222-2222-2222-2222-222222222004',
    'Confirm Bible version for the message',
    'So the verse slides match what is read from the platform.',
    '11111111-1111-1111-1111-111111111001',
    '2026-08-15',
    'To do'
  ),
  (
    '22222222-2222-2222-2222-222222222005',
    'Mark which songs are fast and which are slow',
    'Lighting and camera need the pace of each song to plan looks and shots.',
    '11111111-1111-1111-1111-111111111006',
    '2026-08-15',
    'To do'
  ),
  (
    '22222222-2222-2222-2222-222222222006',
    'Share announcement and promo videos',
    'Any video that plays before or after the message, uploaded here ahead of the event.',
    '11111111-1111-1111-1111-111111111001',
    '2026-08-15',
    'To do'
  ),
  (
    '22222222-2222-2222-2222-222222222007',
    'Post dress code for upcoming services',
    'Dress code for the next four Sundays, shared with the whole team.',
    '11111111-1111-1111-1111-111111111007',
    '2026-08-15',
    'Done'
  )
on conflict (id) do nothing;

insert into public.comments (id, task_id, author_id, body, created_at) values
  (
    '33333333-3333-3333-3333-333333333001',
    '22222222-2222-2222-2222-222222222001',
    '11111111-1111-1111-1111-111111111002',
    'Anything for me to load yet? Rehearsal is Saturday morning.',
    '2026-08-07 21:14:00+00'
  ),
  (
    '33333333-3333-3333-3333-333333333002',
    '22222222-2222-2222-2222-222222222001',
    '11111111-1111-1111-1111-111111111006',
    'Order is set, I am checking two keys with the team and then it goes up here.',
    '2026-08-08 08:02:00+00'
  ),
  (
    '33333333-3333-3333-3333-333333333003',
    '22222222-2222-2222-2222-222222222003',
    '11111111-1111-1111-1111-111111111003',
    'Send them as text if easier, I can format the slides.',
    '2026-08-09 19:40:00+00'
  )
on conflict (id) do nothing;
