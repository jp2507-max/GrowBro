-- Add index to support dedupe queries in notification trigger functions.
CREATE INDEX IF NOT EXISTS notification_requests_dedupe_idx 
ON public.notification_requests (user_id, type, created_at) 
WHERE processed IS NOT TRUE;
