-- Migration: Create community playbook templates table with RLS
-- This table stores user-contributed playbook templates that can be shared with the community
-- All PII and personal plant data must be stripped before insertion

-- Create community_playbook_templates table
CREATE TABLE IF NOT EXISTS public.community_playbook_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_handle TEXT NOT NULL,
  
  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  setup TEXT NOT NULL CHECK (setup IN ('auto_indoor', 'auto_outdoor', 'photo_indoor', 'photo_outdoor')),
  locale TEXT NOT NULL DEFAULT 'en',
  
  -- License information
  license TEXT NOT NULL DEFAULT 'CC-BY-SA',
  
  -- Normalized playbook steps (JSON Schema validated)
  -- This contains only the step structure, no personal plant data
  steps JSONB NOT NULL,
  phase_order JSONB NOT NULL DEFAULT '["seedling", "veg", "flower", "harvest"]'::jsonb,
  
  -- Metadata
  total_weeks INTEGER,
  task_count INTEGER,
  
  -- Engagement metrics
  adoption_count INTEGER NOT NULL DEFAULT 0,
  rating_average DECIMAL(3,2),
  rating_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_rating CHECK (rating_average IS NULL OR (rating_average >= 0 AND rating_average <= 5)),
  CONSTRAINT valid_counts CHECK (adoption_count >= 0 AND rating_count >= 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_templates_author ON public.community_playbook_templates(author_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_templates_setup ON public.community_playbook_templates(setup) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_templates_created ON public.community_playbook_templates(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_templates_rating ON public.community_playbook_templates(rating_average DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_community_templates_adoption ON public.community_playbook_templates(adoption_count DESC) WHERE deleted_at IS NULL;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_community_templates_updated_at
  BEFORE UPDATE ON public.community_playbook_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security
ALTER TABLE public.community_playbook_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Public read access for non-deleted templates
CREATE POLICY "Public can view community templates"
  ON public.community_playbook_templates
  FOR SELECT
  USING (deleted_at IS NULL);

-- Authors can insert their own templates
CREATE POLICY "Users can create their own templates"
  ON public.community_playbook_templates
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Authors can update their own templates
CREATE POLICY "Authors can update their own templates"
  ON public.community_playbook_templates
  FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Authors can soft-delete their own templates
CREATE POLICY "Authors can delete their own templates"
  ON public.community_playbook_templates
  FOR UPDATE
  USING (auth.uid() = author_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = author_id);

-- Create template_ratings table for future use
CREATE TABLE IF NOT EXISTS public.template_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.community_playbook_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One rating per user per template
  UNIQUE(template_id, user_id)
);

-- Create indexes for ratings
CREATE INDEX IF NOT EXISTS idx_template_ratings_template ON public.template_ratings(template_id);
CREATE INDEX IF NOT EXISTS idx_template_ratings_user ON public.template_ratings(user_id);

-- Enable RLS for ratings
ALTER TABLE public.template_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ratings

-- Public can view ratings
CREATE POLICY "Public can view ratings"
  ON public.template_ratings
  FOR SELECT
  USING (true);

-- Users can create their own ratings
CREATE POLICY "Users can create ratings"
  ON public.template_ratings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update their own ratings"
  ON public.template_ratings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete their own ratings"
  ON public.template_ratings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create template_comments table for future use
CREATE TABLE IF NOT EXISTS public.template_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.community_playbook_templates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_handle TEXT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes for comments
CREATE INDEX IF NOT EXISTS idx_template_comments_template ON public.template_comments(template_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_template_comments_user ON public.template_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_template_comments_created ON public.template_comments(created_at DESC) WHERE deleted_at IS NULL;

-- Enable RLS for comments
ALTER TABLE public.template_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments

-- Public can view non-deleted comments
CREATE POLICY "Public can view comments"
  ON public.template_comments
  FOR SELECT
  USING (deleted_at IS NULL);

-- Users can create comments
CREATE POLICY "Users can create comments"
  ON public.template_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own comments
CREATE POLICY "Users can update their own comments"
  ON public.template_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to update template rating average
CREATE OR REPLACE FUNCTION public.update_template_rating_average()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.community_playbook_templates
  SET 
    rating_average = (
      SELECT AVG(rating)::DECIMAL(3,2)
      FROM public.template_ratings
      WHERE template_id = COALESCE(NEW.template_id, OLD.template_id)
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM public.template_ratings
      WHERE template_id = COALESCE(NEW.template_id, OLD.template_id)
    )
  WHERE id = COALESCE(NEW.template_id, OLD.template_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update rating average on insert/update/delete
CREATE TRIGGER update_template_rating_on_change
  AFTER INSERT OR UPDATE OR DELETE ON public.template_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_template_rating_average();

-- Grant necessary permissions
GRANT SELECT ON public.community_playbook_templates TO anon, authenticated;
GRANT INSERT, UPDATE ON public.community_playbook_templates TO authenticated;
GRANT SELECT ON public.template_ratings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.template_ratings TO authenticated;
GRANT SELECT ON public.template_comments TO anon, authenticated;
GRANT INSERT, UPDATE ON public.template_comments TO authenticated;
