-- Queue table for notification requests
CREATE TABLE notification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_by UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  deep_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed BOOLEAN DEFAULT false
);

-- Ensure consistent timestamps
ALTER TABLE notification_requests
  ALTER COLUMN created_at SET DEFAULT now();

-- Enable RLS
ALTER TABLE notification_requests ENABLE ROW LEVEL SECURITY;

-- Restrict default access when RLS is enabled
ALTER TABLE notification_requests FORCE ROW LEVEL SECURITY;

-- Allow users to read only their own queued notifications
CREATE POLICY "Users can read own notification requests"
  ON notification_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Allow end users to queue notification requests via triggers
CREATE POLICY "Users can queue notification requests"
  ON notification_requests FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Allow service role to manage notification requests
CREATE POLICY "Service role can manage notification requests"
  ON notification_requests FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Trigger function for community replies
CREATE OR REPLACE FUNCTION notify_post_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_user UUID;
BEGIN
  SELECT user_id INTO target_user FROM posts WHERE id = NEW.post_id;

  IF target_user IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO notification_requests (
    user_id,
    type,
    title,
    body,
    data,
    deep_link,
    created_at,
    created_by
  ) VALUES (
    target_user,
    'community.reply',
    'New reply',
    substring(NEW.content, 1, 100) || '...',
    jsonb_build_object(
      'post_id', NEW.post_id,
      'reply_id', NEW.id
    ),
    'https://growbro.app/post/' || NEW.post_id,
    now(),
    auth.uid()
  );

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS post_reply_notification ON post_replies;
CREATE TRIGGER post_reply_notification
  AFTER INSERT ON post_replies
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_reply();
