-- Migration: Configure Realtime for community playbook templates only
-- This enables real-time updates for community features (templates, ratings, comments)
-- while keeping private user data (tasks, series, etc.) offline-only

BEGIN;

-- ============================================================================
-- ENABLE REALTIME FOR COMMUNITY TABLES ONLY
-- ============================================================================

-- Enable Realtime for community_playbook_templates
-- This allows users to see new templates, rating updates, and adoption counts in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_playbook_templates;

-- Enable Realtime for template_ratings
-- This allows users to see rating updates in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.template_ratings;

-- Enable Realtime for template_comments
-- This allows users to see new comments in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.template_comments;

COMMIT;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.community_playbook_templates IS 
  'Community-shared playbook templates. Realtime enabled for public discovery and engagement metrics.';

COMMENT ON TABLE public.template_ratings IS 
  'User ratings for community templates. Realtime enabled for live rating updates.';

COMMENT ON TABLE public.template_comments IS 
  'User comments on community templates. Realtime enabled for live discussion.';

COMMENT ON TABLE public.series IS 
  'Private user recurring task series. Realtime DISABLED - syncs via WatermelonDB only.';

COMMENT ON TABLE public.tasks IS 
  'Private user tasks. Realtime DISABLED - syncs via WatermelonDB only.';

COMMENT ON TABLE public.occurrence_overrides IS 
  'Private user occurrence overrides. Realtime DISABLED - syncs via WatermelonDB only.';

COMMENT ON TABLE public.notification_queue IS 
  'Private user notification queue. Realtime DISABLED - syncs via WatermelonDB only.';

-- ============================================================================
-- NOTE ON PRIVATE TABLES
-- ============================================================================
-- By default, tables are NOT in the realtime publication unless explicitly added.
-- The private tables (series, tasks, occurrence_overrides, notification_queue, ph_ec_readings)
-- are intentionally NOT added to supabase_realtime publication.
-- They sync exclusively via WatermelonDB sync endpoints (sync-pull/sync-push).

