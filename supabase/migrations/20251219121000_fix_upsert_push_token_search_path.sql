-- Migration: Fix upsert_push_token search_path
-- The previous migration (20251217122518) set search_path = '' which breaks
-- the function because it uses unqualified table names like 'push_tokens'.
-- Setting to 'public' still prevents search path injection attacks while
-- allowing the function to find its tables.

ALTER FUNCTION public.upsert_push_token(uuid, text, text, timestamptz) SET search_path = 'public';
