-- Add indexes for category-filtered community feeds (Help Station)
-- These indexes support efficient querying of posts by category for the segmented feed

-- Index for category + created_at (newest first) - used by Help Station "new" sort
CREATE INDEX IF NOT EXISTS idx_posts_visible_category_created_at 
ON public.posts (category, created_at DESC) 
WHERE deleted_at IS NULL AND hidden_at IS NULL AND category IS NOT NULL;

-- Index for category + like_count + created_at - used by Help Station "top_7d" sort
CREATE INDEX IF NOT EXISTS idx_posts_visible_category_like_count_created_at 
ON public.posts (category, like_count DESC, created_at DESC) 
WHERE deleted_at IS NULL AND hidden_at IS NULL AND category IS NOT NULL;

-- Index for strain filtering (discovery feature)
CREATE INDEX IF NOT EXISTS idx_posts_visible_strain 
ON public.posts (strain, created_at DESC) 
WHERE deleted_at IS NULL AND hidden_at IS NULL AND strain IS NOT NULL;
