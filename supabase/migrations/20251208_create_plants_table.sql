-- Plants table for user grow tracking
create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  stage text,
  strain text,
  planted_at timestamptz,
  expected_harvest_at timestamptz,
  last_watered_at timestamptz,
  last_fed_at timestamptz,
  health text,
  environment text,
  photoperiod_type text,
  genetic_lean text,
  image_url text,
  notes text,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.plants enable row level security;

-- Indexes
create index if not exists plants_user_id_idx on public.plants (user_id);
create index if not exists plants_stage_idx on public.plants (stage);
create index if not exists plants_photoperiod_idx on public.plants (photoperiod_type);
create index if not exists plants_environment_idx on public.plants (environment);

-- RLS policies (mirror production)
create policy "plants_select_own"
  on public.plants for select
  using (auth.uid() = user_id);

create policy "plants_insert_own"
  on public.plants for insert
  with check (auth.uid() = user_id);

create policy "plants_update_own"
  on public.plants for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "plants_delete_own"
  on public.plants for delete
  using (auth.uid() = user_id);
