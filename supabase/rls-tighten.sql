-- HIJ Cue — production notes / optional RLS refresh
-- Run in Supabase SQL Editor if you want storage updates allowed (signed URL flows).
-- Attachment/task deletes from the app use the service role and bypass RLS.

drop policy if exists "task_files_update" on storage.objects;
create policy "task_files_update" on storage.objects
  for update using (bucket_id = 'task-files')
  with check (bucket_id = 'task-files');

-- Allow team members to delete attachment rows they can see.
-- App still authorizes uploader-or-admin in deleteAttachment();
-- service role is the primary path.
drop policy if exists "attachments_admin_delete" on public.attachments;
drop policy if exists "attachments_delete_all" on public.attachments;
create policy "attachments_delete_all" on public.attachments
  for delete using (true);

drop policy if exists "task_files_admin_delete" on storage.objects;
drop policy if exists "task_files_delete" on storage.objects;
create policy "task_files_delete" on storage.objects
  for delete using (bucket_id = 'task-files');
