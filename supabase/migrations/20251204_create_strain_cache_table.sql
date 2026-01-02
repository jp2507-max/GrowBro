-- Strain cache table for public strain metadata
create table if not exists public.strain_cache (
  id text primary key,
  slug text not null,
  name text not null,
  race text,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.strain_cache enable row level security;

-- Indexes
create index if not exists idx_strain_cache_slug on public.strain_cache (slug);
create index if not exists idx_strain_cache_name on public.strain_cache (name);

-- RLS policies (mirror production)
create policy "strain_cache_public_read"
  on public.strain_cache for select
  using (true);

create policy "Allow anon to insert"
  on public.strain_cache for insert
  to anon
  with check (true);

create policy "Allow anon to update"
  on public.strain_cache for update
  to anon
  using (true)
  with check (true);

create policy "Allow authenticated users to insert"
  on public.strain_cache for insert
  to authenticated
  with check (true);

create policy "Allow authenticated users to update"
  on public.strain_cache for update
  to authenticated
  using (true)
  with check (true);

create policy "strain_cache_service_write"
  on public.strain_cache for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
