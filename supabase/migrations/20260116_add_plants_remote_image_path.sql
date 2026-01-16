-- Add remote_image_path column to plants table
-- This dedicated column replaces fragile JSON metadata queries for better performance

alter table public.plants add column if not exists remote_image_path text;

-- Create index for efficient queries on plants with remote images
create index if not exists plants_remote_image_path_idx on public.plants (remote_image_path)
  where remote_image_path is not null;

-- Backfill existing data from metadata->remoteImagePath
update public.plants
set remote_image_path = metadata->>'remoteImagePath'
where metadata->>'remoteImagePath' is not null
  and remote_image_path is null;
