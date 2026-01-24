-- Performance: add missing indexes for foreign keys
-- Rule: supabase-postgres-best-practices/schema-foreign-key-indexes

DO $$
BEGIN
  IF to_regclass('public.diagnostic_results_v2') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_diagnostic_results_v2_water_profile_id ON public.diagnostic_results_v2 (water_profile_id);';
  END IF;

  IF to_regclass('public.inventory_movements') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_inventory_movements_batch_id ON public.inventory_movements (batch_id);';
  END IF;

  IF to_regclass('public.legal_holds') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_legal_holds_created_by ON public.legal_holds (created_by);';
  END IF;

  IF to_regclass('public.model_metadata') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_model_metadata_created_by ON public.model_metadata (created_by);';
  END IF;

  IF to_regclass('public.moderation_audit') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_moderation_audit_actor_id ON public.moderation_audit (actor_id);';
  END IF;

  IF to_regclass('public.moderation_decisions') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_moderation_decisions_user_id ON public.moderation_decisions (user_id);';
  END IF;

  IF to_regclass('public.notification_requests') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notification_requests_created_by ON public.notification_requests (created_by);';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_notification_requests_user_id ON public.notification_requests (user_id);';
  END IF;

  IF to_regclass('public.post_comments') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments (user_id);';
  END IF;

  IF to_regclass('public.post_likes') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes (user_id);';
  END IF;

  IF to_regclass('public.reports') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports (reporter_id);';
  END IF;

  IF to_regclass('public.reservoirs_v2') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_reservoirs_v2_source_water_profile_id ON public.reservoirs_v2 (source_water_profile_id);';
  END IF;

  IF to_regclass('public.statements_of_reasons') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_statements_of_reasons_user_id ON public.statements_of_reasons (user_id);';
  END IF;

  IF to_regclass('public.user_age_status') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_user_age_status_active_token_id ON public.user_age_status (active_token_id);';
  END IF;
END
$$;

