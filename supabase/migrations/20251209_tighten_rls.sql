-- Tighten RLS on user-owned tables and restrict strain_cache writes

-- Enforce RLS at table level
alter table public.favorites force row level security;
alter table public.plants force row level security;
alter table public.strain_cache force row level security;

-- Restrict strain_cache writes to service role only; keep public read
drop policy if exists "Allow anon to insert" on public.strain_cache;
drop policy if exists "Allow anon to update" on public.strain_cache;
drop policy if exists "Allow authenticated users to insert" on public.strain_cache;
drop policy if exists "Allow authenticated users to update" on public.strain_cache;
drop policy if exists "strain_cache_public_read" on public.strain_cache;
drop policy if exists "strain_cache_service_write" on public.strain_cache;

create policy "strain_cache_public_read"
  on public.strain_cache for select
  using (true);

create policy "strain_cache_service_write"
  on public.strain_cache for all
  to service_role
  using (true)
  with check (true);
