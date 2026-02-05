-- Create config table for environment-specific settings
-- This replaces the need for database-level parameters which require superuser privileges

CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Insert default API URL (update this value for each environment)
INSERT INTO public.app_config (key, value)
VALUES ('supabase_api_url', 'https://mgbekkpswaizzthgefbc.supabase.co')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Helper function to get config value
CREATE OR REPLACE FUNCTION public.get_config(config_key text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT value FROM public.app_config WHERE key = config_key LIMIT 1;
$$;

COMMENT ON TABLE public.app_config IS 'Environment-specific configuration values';
COMMENT ON FUNCTION public.get_config(text) IS 'Retrieve a configuration value by key';
