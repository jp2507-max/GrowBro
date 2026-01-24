-- Improve strain search performance for ILIKE '%...%' queries.
-- Uses pg_trgm GIN indexes (extension is installed in schema `extensions`).

create index if not exists idx_strain_cache_name_trgm
  on public.strain_cache
  using gin (name extensions.gin_trgm_ops);

create index if not exists idx_strain_cache_slug_trgm
  on public.strain_cache
  using gin (slug extensions.gin_trgm_ops);

