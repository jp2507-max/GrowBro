-- Add strain and category columns to posts table with constraints
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS strain TEXT CHECK (length(strain) <= 100);
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category TEXT CHECK (
  category IS NULL OR category IN ('problem_deficiency')
);

-- Add comments for documentation
COMMENT ON COLUMN public.posts.strain IS 'Optional strain name, max 100 characters';
COMMENT ON COLUMN public.posts.category IS 'Post category for segmented feeds. NULL = showcase, problem_deficiency = help station';
