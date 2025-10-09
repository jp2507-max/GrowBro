-- Create private bucket for harvest photos with owner-scoped RLS policies (idempotent)
-- Requirements: 18.5, 18.7 (private bucket, auth.uid()-scoped access)

-- 1) Create bucket if not exists
insert into storage.buckets (id, name, public)
values ('harvest-photos', 'harvest-photos', false)
on conflict (id) do nothing;

-- 2) Policies: drop if exist then recreate to keep migration idempotent
drop policy if exists "harvest-photos: read own photos" on storage.objects;
drop policy if exists "harvest-photos: upload to own folder" on storage.objects;
drop policy if exists "harvest-photos: delete own photos" on storage.objects;

-- Read: only objects in harvest-photos bucket where first folder equals auth.uid()
-- Path structure: /user_id/harvest_id/variant_hash.ext
create policy "harvest-photos: read own photos"
  on storage.objects for select
  using (
    bucket_id = 'harvest-photos'
    and (auth.role() = 'authenticated')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Insert: allow only into own folder (user_id must match auth.uid())
create policy "harvest-photos: upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'harvest-photos'
    and (auth.role() = 'authenticated')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: allow only own objects
create policy "harvest-photos: delete own photos"
  on storage.objects for delete
  using (
    bucket_id = 'harvest-photos'
    and (auth.role() = 'authenticated')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Optional verification (no-op in migration runners that ignore selects)
-- select id, name, public from storage.buckets where id = 'harvest-photos';
