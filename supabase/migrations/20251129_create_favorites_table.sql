-- Favorites table for user-curated strains
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strain_id text not null,
  added_at bigint not null,
  snapshot jsonb not null,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.favorites enable row level security;

-- Indexes
create unique index if not exists favorites_user_strain_unique on public.favorites (user_id, strain_id);
create index if not exists idx_favorites_user_id on public.favorites (user_id);
create index if not exists idx_favorites_strain_id on public.favorites (strain_id);
create index if not exists idx_favorites_user_deleted on public.favorites (user_id, deleted_at) where deleted_at is null;

-- RLS policies
create policy "Users can view their own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "Users can insert their own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own favorites"
  on public.favorites for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);
