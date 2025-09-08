-- Create private bucket for plant images with owner-folder RLS policies (idempotent)

-- 1) Create bucket if not exists
insert into storage.buckets (id, name, public)
values ('plant-images', 'plant-images', false)
on conflict (id) do nothing;

-- 2) Policies: drop if exist then recreate to keep migration idempotent
drop policy if exists "plant-images: read own images" on storage.objects;
drop policy if exists "plant-images: upload to own folder" on storage.objects;
drop policy if exists "plant-images: delete own images" on storage.objects;

-- Read: only objects in plant-images bucket where first folder equals auth.uid()
create policy "plant-images: read own images"
  on storage.objects for select
  using (
    bucket_id = 'plant-images'
    and (auth.role() = 'authenticated')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Insert: allow only into own folder
create policy "plant-images: upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'plant-images'
    and (auth.role() = 'authenticated')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: allow only own objects
create policy "plant-images: delete own images"
  on storage.objects for delete
  using (
    bucket_id = 'plant-images'
    and (auth.role() = 'authenticated')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Optional verification (no-op in migration runners that ignore selects)
-- select id, name, public from storage.buckets where id = 'plant-images';


