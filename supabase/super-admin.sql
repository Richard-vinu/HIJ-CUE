-- Make Pastor Anish super admin (safe to re-run)
alter table public.people
  add column if not exists is_super_admin boolean not null default false;

update public.people
set is_admin = true, is_super_admin = true
where slug = 'anish' or email = 'pr.anish@hij.com';

update public.people
set is_super_admin = false
where slug <> 'anish' and email <> 'pr.anish@hij.com';
