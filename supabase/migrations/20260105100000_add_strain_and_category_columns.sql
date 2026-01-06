-- Add strain and category columns to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS strain TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS category TEXT;
