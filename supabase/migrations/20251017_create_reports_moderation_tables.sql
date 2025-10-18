-- Migration: Create reports and moderation_audit tables
-- Description: Content reporting and moderation tracking
-- Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7

-- Reports table for user-submitted content reports
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved'))
);

-- Moderation audit table for tracking moderator actions
CREATE TABLE IF NOT EXISTS public.moderation_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment')),
  content_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('hide', 'unhide', 'delete')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_audit ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE public.reports IS 'User-submitted reports for inappropriate content';
COMMENT ON TABLE public.moderation_audit IS 'Audit log of all moderator actions for accountability';
