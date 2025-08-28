-- Ensure UPDATE RLS policies on post_comments enforce ownership with WITH CHECK
-- This migration is idempotent and will:
-- 1) Add WITH CHECK (auth.uid() = user_id) to any existing UPDATE policy on public.post_comments
--    that lacks a WITH CHECK clause.
-- 2) If no UPDATE policy exists, create one that restricts both USING and WITH CHECK
--    to the row owner (auth.uid() = user_id) for role "authenticated".

BEGIN;

-- 1) Add missing WITH CHECK to existing UPDATE policies (if any)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'post_comments'
      AND cmd = 'UPDATE'
      AND with_check IS NULL
  LOOP
    EXECUTE format(
      'ALTER POLICY %I ON public.post_comments WITH CHECK (auth.uid() = user_id)',
      r.policyname
    );
  END LOOP;
END $$;

-- 2) If there are no UPDATE policies at all, create a safe default one
DO $$
DECLARE
  update_policy_count INT;
BEGIN
  SELECT COUNT(*) INTO update_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'post_comments'
    AND cmd = 'UPDATE';

  IF update_policy_count = 0 THEN
    -- Create a narrowly-scoped policy for authenticated users to update ONLY their own rows
    CREATE POLICY post_comments_update_own
      ON public.post_comments
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

COMMIT;
