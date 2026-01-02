-- Enable trigram search for community post discovery
create extension if not exists pg_trgm;

-- Speed up ILIKE searches on post body for visible posts
create index if not exists idx_posts_body_trgm
  on public.posts using gin (body gin_trgm_ops)
  where deleted_at is null and hidden_at is null;
