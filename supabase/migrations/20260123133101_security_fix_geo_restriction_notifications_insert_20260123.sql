-- Security: restrict geo_restriction_notifications inserts to service-role
-- Rule: supabase-postgres-best-practices/security-rls-basics

DO $$
BEGIN
  IF to_regclass('public.geo_restriction_notifications') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS \"System can insert notifications\" ON public.geo_restriction_notifications;';

    EXECUTE $p$
      CREATE POLICY "System can insert notifications"
        ON public.geo_restriction_notifications
        FOR INSERT
        TO service_role
        WITH CHECK ((SELECT auth.role()) = 'service_role')
    $p$;
  END IF;
END
$$;

