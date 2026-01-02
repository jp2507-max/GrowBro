-- Migration: Create analytics views for notification delivery and engagement metrics
-- These views provide delivery rates, engagement rates, and opt-in rates by notification type

-- View: Daily notification delivery stats by type
CREATE OR REPLACE VIEW notification_delivery_stats AS
SELECT
  DATE(created_at) AS date,
  type,
  platform,
  COUNT(*) AS attempted,
  COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) AS sent,
  COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE status = 'opened') AS opened,
  -- Delivery rate: sent / attempted (not true device delivery, just Expo acceptance)
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) / NULLIF(COUNT(*), 0),
    2
  ) AS delivery_rate_percent,
  -- Engagement rate: opened / delivered
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE status = 'opened') / NULLIF(COUNT(*) FILTER (WHERE status = 'delivered'), 0),
    2
  ) AS engagement_rate_percent
FROM push_notification_queue
GROUP BY DATE(created_at), type, platform
ORDER BY date DESC, type, platform;

COMMENT ON VIEW notification_delivery_stats IS 
'Daily notification delivery and engagement statistics by type and platform. Delivery rate represents Expo acceptance (sent/attempted), not true device delivery. Use for monitoring and alerting when delivery_rate_percent < 95%.';

-- View: Current opt-in rates by notification type
CREATE OR REPLACE VIEW notification_opt_in_rates AS
SELECT
  'community.interactions' AS notification_type,
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE community_interactions = true) AS opted_in,
  COUNT(*) FILTER (WHERE community_interactions = false) AS opted_out,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE community_interactions = true) / NULLIF(COUNT(*), 0),
    2
  ) AS opt_in_rate_percent
FROM notification_preferences
UNION ALL
SELECT
  'community.likes' AS notification_type,
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE community_likes = true) AS opted_in,
  COUNT(*) FILTER (WHERE community_likes = false) AS opted_out,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE community_likes = true) / NULLIF(COUNT(*), 0),
    2
  ) AS opt_in_rate_percent
FROM notification_preferences
UNION ALL
SELECT
  'cultivation.reminders' AS notification_type,
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE cultivation_reminders = true) AS opted_in,
  COUNT(*) FILTER (WHERE cultivation_reminders = false) AS opted_out,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE cultivation_reminders = true) / NULLIF(COUNT(*), 0),
    2
  ) AS opt_in_rate_percent
FROM notification_preferences
UNION ALL
SELECT
  'system.updates' AS notification_type,
  COUNT(*) AS total_users,
  COUNT(*) FILTER (WHERE system_updates = true) AS opted_in,
  COUNT(*) FILTER (WHERE system_updates = false) AS opted_out,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE system_updates = true) / NULLIF(COUNT(*), 0),
    2
  ) AS opt_in_rate_percent
FROM notification_preferences;

COMMENT ON VIEW notification_opt_in_rates IS 
'Current opt-in/opt-out rates by notification type across all users with preferences set. Use for product analytics and A/B testing.';

-- View: Recent delivery failures for alerting
CREATE OR REPLACE VIEW notification_delivery_failures AS
SELECT
  id,
  user_id,
  message_id,
  type,
  platform,
  device_token,
  error_message,
  created_at,
  updated_at
FROM push_notification_queue
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

COMMENT ON VIEW notification_delivery_failures IS 
'Recent notification delivery failures (last 24 hours). Use for debugging and monitoring DeviceNotRegistered errors.';

-- View: Notification engagement by message_id (for correlation tracking)
CREATE OR REPLACE VIEW notification_engagement_tracking AS
SELECT
  nq.message_id,
  nq.type,
  nq.platform,
  nq.user_id,
  nq.created_at AS sent_at,
  nq.updated_at AS opened_at,
  nq.status,
  EXTRACT(EPOCH FROM (nq.updated_at - nq.created_at)) AS time_to_open_seconds
FROM push_notification_queue nq
WHERE nq.status = 'opened'
ORDER BY nq.updated_at DESC;

COMMENT ON VIEW notification_engagement_tracking IS 
'Tracks notification open events with message_id correlation. Client records open events; this view shows time-to-open metrics.';

-- Function: Calculate delivery rate for a specific notification type
CREATE OR REPLACE FUNCTION get_delivery_rate(p_notification_type TEXT, p_days INTEGER DEFAULT 7)
RETURNS TABLE (
  notification_type TEXT,
  days_analyzed INTEGER,
  attempted INTEGER,
  sent INTEGER,
  delivery_rate_percent NUMERIC
) AS $$
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
  FROM push_notification_queue
  WHERE type = p_notification_type
    AND created_at > NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_delivery_rate(TEXT, INTEGER) IS 
'Calculates delivery rate (sent/attempted) for a specific notification type over N days. Use for monitoring and alerting.';

-- Function: Alert if delivery rate falls below threshold
CREATE OR REPLACE FUNCTION check_delivery_rate_threshold(p_threshold NUMERIC DEFAULT 95.0)
RETURNS TABLE (
  notification_type TEXT,
  delivery_rate_percent NUMERIC,
  alert_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    type AS notification_type,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) / NULLIF(COUNT(*), 0),
      2
    ) AS delivery_rate_percent,
    'Delivery rate below threshold (' || p_threshold || '%)' AS alert_message
  FROM push_notification_queue
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY type
  HAVING ROUND(
    100.0 * COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) / NULLIF(COUNT(*), 0),
    2
  ) < p_threshold;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_delivery_rate_threshold(NUMERIC) IS 
'Returns notification types with delivery rates below threshold (default 95%) in last 24 hours. Use for automated alerting.';

-- Grant permissions to authenticated users for read-only views
GRANT SELECT ON notification_delivery_stats TO authenticated;
GRANT SELECT ON notification_opt_in_rates TO authenticated;
GRANT SELECT ON notification_engagement_tracking TO authenticated;

-- Grant permissions to service role for all analytics functions
GRANT SELECT ON notification_delivery_failures TO service_role;
GRANT EXECUTE ON FUNCTION get_delivery_rate(TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION check_delivery_rate_threshold(NUMERIC) TO service_role;
