-- Migration: Fix analytics functions to use schema-qualified table names and correct table reference
-- Required for search_path = '' security fix applied in 20251217122518_fix_function_search_path_security.sql
-- Affected functions: check_delivery_rate_threshold, get_delivery_rate

-- Recreate get_delivery_rate with schema-qualified table name
CREATE OR REPLACE FUNCTION public.get_delivery_rate(p_notification_type TEXT, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  notification_type TEXT,
  days_analyzed INTEGER,
  attempted INTEGER,
  sent INTEGER,
  delivery_rate_percent NUMERIC
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_notification_type AS notification_type,
    p_days AS days_analyzed,
    COUNT(*)::INTEGER AS attempted,
    COUNT(*) FILTER (WHERE status IN ('sent', 'delivered'))::INTEGER AS sent,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) / NULLIF(COUNT(*), 0),
      2
    ) AS delivery_rate_percent
  FROM public.push_notification_queue
  WHERE type = p_notification_type
    AND created_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$;

COMMENT ON FUNCTION public.get_delivery_rate(TEXT, INTEGER) IS 
'Calculates delivery rate (sent/attempted) for a specific notification type over N days. Use for monitoring and alerting.';

-- Recreate check_delivery_rate_threshold with schema-qualified table name
CREATE OR REPLACE FUNCTION public.check_delivery_rate_threshold(p_threshold NUMERIC DEFAULT 95.0)
RETURNS TABLE (
  notification_type TEXT,
  delivery_rate_percent NUMERIC,
  alert_message TEXT
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    type AS notification_type,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) / NULLIF(COUNT(*), 0),
      2
    ) AS delivery_rate_percent,
    'Delivery rate below threshold (' || p_threshold || '%)' AS alert_message
  FROM public.push_notification_queue
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY type
  HAVING ROUND(
    100.0 * COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) / NULLIF(COUNT(*), 0),
    2
  ) < p_threshold;
END;
$$;

COMMENT ON FUNCTION public.check_delivery_rate_threshold(NUMERIC) IS 
'Returns notification types with delivery rates below threshold (default 95%) in last 24 hours. Use for automated alerting.';
