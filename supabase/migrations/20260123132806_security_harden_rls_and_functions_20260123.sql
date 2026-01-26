-- Security hardening for RLS + SECURITY DEFINER functions
-- Rules: supabase-postgres-best-practices/security-rls-basics, security-privileges

-- 1) SECURITY DEFINER: pin search_path to prevent hijacking
DO $$
BEGIN
  IF to_regprocedure('public.increment_age_token_use_count(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.increment_age_token_use_count(uuid) SET search_path = '''';';
  END IF;
END
$$;

-- 2) Age verification: make "system" writes service-role only (avoid WITH CHECK true)
DO $$
BEGIN
  IF to_regclass('public.age_verification_audit') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert audit logs" ON public.age_verification_audit;';
    EXECUTE $p$
      CREATE POLICY "System can insert audit logs"
        ON public.age_verification_audit
        FOR INSERT
        TO service_role
        WITH CHECK (true)
    $p$;
  END IF;

  IF to_regclass('public.age_verification_tokens') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert tokens" ON public.age_verification_tokens;';
    EXECUTE 'DROP POLICY IF EXISTS "System can update tokens" ON public.age_verification_tokens;';

    EXECUTE $p$
      CREATE POLICY "System can insert tokens"
        ON public.age_verification_tokens
        FOR INSERT
        TO service_role
        WITH CHECK (true)
    $p$;

    EXECUTE $p$
      CREATE POLICY "System can update tokens"
        ON public.age_verification_tokens
        FOR UPDATE
        TO service_role
        USING (true)
        WITH CHECK (true)
    $p$;
  END IF;
END
$$;

-- 3) Privacy notice deliveries: system writes service-role only
DO $$
BEGIN
  IF to_regclass('public.privacy_notice_deliveries') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS privacy_notice_deliveries_system_write ON public.privacy_notice_deliveries;';
    EXECUTE $p$
      CREATE POLICY privacy_notice_deliveries_system_write
        ON public.privacy_notice_deliveries
        FOR INSERT
        TO service_role
        WITH CHECK (true)
    $p$;
  END IF;
END
$$;

-- 4) System logs: restrict INSERT to service-role
DO $$
BEGIN
  IF to_regclass('public.moderator_alert_log') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS moderator_alert_log_insert_system ON public.moderator_alert_log;';
    EXECUTE $p$
      CREATE POLICY moderator_alert_log_insert_system
        ON public.moderator_alert_log
        FOR INSERT
        TO service_role
        WITH CHECK (true)
    $p$;
  END IF;

  IF to_regclass('public.notification_delivery_log') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS notification_delivery_log_insert_system ON public.notification_delivery_log;';
    EXECUTE $p$
      CREATE POLICY notification_delivery_log_insert_system
        ON public.notification_delivery_log
        FOR INSERT
        TO service_role
        WITH CHECK (true)
    $p$;
  END IF;
END
$$;

-- 5) post_likes: replace overly permissive ALL policy (USING true) with per-user policies
DO $$
BEGIN
  IF to_regclass('public.post_likes') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS post_likes_access ON public.post_likes;';
    EXECUTE 'DROP POLICY IF EXISTS post_likes_select_own ON public.post_likes;';
    EXECUTE 'DROP POLICY IF EXISTS post_likes_insert_own ON public.post_likes;';
    EXECUTE 'DROP POLICY IF EXISTS post_likes_update_own ON public.post_likes;';
    EXECUTE 'DROP POLICY IF EXISTS post_likes_delete_own ON public.post_likes;';

    EXECUTE $p$
      CREATE POLICY post_likes_select_own
        ON public.post_likes
        FOR SELECT
        TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$;

    EXECUTE $p$
      CREATE POLICY post_likes_insert_own
        ON public.post_likes
        FOR INSERT
        TO authenticated
        WITH CHECK (user_id = (SELECT auth.uid()))
    $p$;

    EXECUTE $p$
      CREATE POLICY post_likes_update_own
        ON public.post_likes
        FOR UPDATE
        TO authenticated
        USING (user_id = (SELECT auth.uid()))
        WITH CHECK (user_id = (SELECT auth.uid()))
    $p$;

    EXECUTE $p$
      CREATE POLICY post_likes_delete_own
        ON public.post_likes
        FOR DELETE
        TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$;
  END IF;
END
$$;

-- 6) strain_cache: remove client write policies (server-managed cache)
DO $$
BEGIN
  IF to_regclass('public.strain_cache') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.strain_cache;';
    EXECUTE 'DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.strain_cache;';
  END IF;
END
$$;

-- 7) audit_events*: remove authenticated insert policies (audit logs are server-only)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname LIKE 'audit_events%'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS audit_events_insert_system_only ON public.%I;', r.relname);
  END LOOP;
END
$$;

-- 8) user_age_status: remove permissive policy and enforce system-managed fields via trigger
DO $$
BEGIN
  IF to_regclass('public.user_age_status') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users and system can manage age status" ON public.user_age_status;';
    EXECUTE 'DROP POLICY IF EXISTS user_age_status_select_own ON public.user_age_status;';
    EXECUTE 'DROP POLICY IF EXISTS user_age_status_insert_own ON public.user_age_status;';
    EXECUTE 'DROP POLICY IF EXISTS user_age_status_update_own ON public.user_age_status;';
    EXECUTE 'DROP POLICY IF EXISTS user_age_status_service_role_all ON public.user_age_status;';

    EXECUTE $p$
      CREATE POLICY user_age_status_select_own
        ON public.user_age_status
        FOR SELECT
        TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$;

    EXECUTE $p$
      CREATE POLICY user_age_status_insert_own
        ON public.user_age_status
        FOR INSERT
        TO authenticated
        WITH CHECK (user_id = (SELECT auth.uid()))
    $p$;

    EXECUTE $p$
      CREATE POLICY user_age_status_update_own
        ON public.user_age_status
        FOR UPDATE
        TO authenticated
        USING (user_id = (SELECT auth.uid()))
        WITH CHECK (user_id = (SELECT auth.uid()))
    $p$;

    EXECUTE $p$
      CREATE POLICY user_age_status_service_role_all
        ON public.user_age_status
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $p$;

    EXECUTE $p$
      CREATE OR REPLACE FUNCTION public.enforce_user_age_status_client_update()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = ''
      AS $fn$
      DECLARE
        v_role text;
      BEGIN
        v_role := auth.role();

        -- Allow internal direct DB sessions (no JWT) and service-role
        IF v_role IS NULL OR v_role = 'service_role' THEN
          RETURN NEW;
        END IF;

        IF TG_OP = 'INSERT' THEN
          IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'user_id must equal auth.uid()';
          END IF;

          -- Clients cannot self-verify or change system-managed status
          IF NEW.is_age_verified IS DISTINCT FROM false THEN
            RAISE EXCEPTION 'is_age_verified is system-managed';
          END IF;
          IF NEW.verified_at IS NOT NULL THEN
            RAISE EXCEPTION 'verified_at is system-managed';
          END IF;
          IF NEW.active_token_id IS NOT NULL THEN
            RAISE EXCEPTION 'active_token_id is system-managed';
          END IF;
          IF NEW.is_minor IS DISTINCT FROM true THEN
            RAISE EXCEPTION 'is_minor is system-managed';
          END IF;
          IF NEW.minor_protections_enabled IS DISTINCT FROM true THEN
            RAISE EXCEPTION 'minor_protections_enabled is system-managed';
          END IF;

          RETURN NEW;
        END IF;

        IF TG_OP = 'UPDATE' THEN
          IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'user_id is immutable';
          END IF;

          IF NEW.is_age_verified IS DISTINCT FROM OLD.is_age_verified THEN
            RAISE EXCEPTION 'is_age_verified is system-managed';
          END IF;
          IF NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
            RAISE EXCEPTION 'verified_at is system-managed';
          END IF;
          IF NEW.active_token_id IS DISTINCT FROM OLD.active_token_id THEN
            RAISE EXCEPTION 'active_token_id is system-managed';
          END IF;
          IF NEW.is_minor IS DISTINCT FROM OLD.is_minor THEN
            RAISE EXCEPTION 'is_minor is system-managed';
          END IF;
          IF NEW.minor_protections_enabled IS DISTINCT FROM OLD.minor_protections_enabled THEN
            RAISE EXCEPTION 'minor_protections_enabled is system-managed';
          END IF;

          -- show_age_restricted_content is user-managed
          RETURN NEW;
        END IF;

        RETURN NEW;
      END;
      $fn$
    $p$;

    EXECUTE 'DROP TRIGGER IF EXISTS trigger_enforce_user_age_status_client_update ON public.user_age_status;';
    EXECUTE $p$
      CREATE TRIGGER trigger_enforce_user_age_status_client_update
        BEFORE INSERT OR UPDATE ON public.user_age_status
        FOR EACH ROW
        EXECUTE FUNCTION public.enforce_user_age_status_client_update()
    $p$;
  END IF;
END
$$;

