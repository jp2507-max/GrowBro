-- Enable trigram search for community post discovery
-- Notes:
-- - Use CONCURRENTLY to avoid locking the posts table during index build
-- - Do NOT wrap this migration in a transaction (CONCURRENTLY is not allowed inside transaction blocks)
-- - Queries must include the predicate "deleted_at is null and hidden_at is null" for the planner to use this partial index
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Speed up ILIKE searches on post body for visible posts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_body_trgm
  ON public.posts USING GIN (body gin_trgm_ops)
  WHERE deleted_at IS NULL AND hidden_at IS NULL;
