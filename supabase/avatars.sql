-- Optional: store avatars on people rows (app already works via Storage fallback).
-- Run in Supabase SQL Editor if you want DB columns too.
alter table public.people
  add column if not exists avatar_style text;

alter table public.people
  add column if not exists avatar_seed text;
