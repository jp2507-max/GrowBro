-- Migration: Update notification triggers for automatic community notifications
-- Creates triggers for post replies and likes with collapse_key/thread_id logic

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS post_reply_notification ON post_replies;

-- Update the notify_post_reply function with collapse_key and thread_id
CREATE OR REPLACE FUNCTION notify_post_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user UUID;
  reply_author UUID;
BEGIN
  -- Get the post author
  SELECT user_id INTO target_user FROM posts WHERE id = NEW.post_id;

  -- Get the reply author
  reply_author := NEW.user_id;

  -- Don't notify users about their own replies
  IF target_user = reply_author THEN
    RETURN NEW;
  END IF;

  -- If target user not found, skip notification
  IF target_user IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert notification request with collapse_key and thread_id
  INSERT INTO notification_requests (
    user_id,
    created_by,
    type,
    title,
    body,
    data,
    deep_link,
    created_at,
    processed
  ) VALUES (
    target_user,
    reply_author,
    'community.reply',
    'New reply',
    substring(NEW.content, 1, 100) || 
      CASE WHEN length(NEW.content) > 100 THEN '...' ELSE '' END,
    jsonb_build_object(
      'post_id', NEW.post_id,
      'reply_id', NEW.id,
      'collapse_key', 'post_' || NEW.post_id,
      'thread_id', 'post_' || NEW.post_id
    ),
    'https://growbro.app/post/' || NEW.post_id,
    now(),
    false
  );

  RETURN NEW;
END;
$$;

-- Recreate trigger for post replies
CREATE TRIGGER post_reply_notification
  AFTER INSERT ON post_replies
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_reply();

-- Create function for post likes
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user UUID;
  like_author UUID;
  post_title TEXT;
BEGIN
  -- Get the post author and title
  SELECT user_id, title INTO target_user, post_title 
  FROM posts 
  WHERE id = NEW.post_id;

  -- Get the like author
  like_author := NEW.user_id;

  -- Don't notify users about their own likes
  IF target_user = like_author THEN
    RETURN NEW;
  END IF;

  -- If target user not found, skip notification
  IF target_user IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert notification request with collapse_key and thread_id
  -- Note: Multiple likes on the same post will be collapsed into one notification
  INSERT INTO notification_requests (
    user_id,
    created_by,
    type,
    title,
    body,
    data,
    deep_link,
    created_at,
    processed
  ) VALUES (
    target_user,
    like_author,
    'community.like',
    'New like',
    'Someone liked your post' || 
      CASE WHEN post_title IS NOT NULL THEN ': ' || substring(post_title, 1, 50) ELSE '' END,
    jsonb_build_object(
      'post_id', NEW.post_id,
      'like_id', NEW.id,
      'collapse_key', 'like_' || NEW.post_id,
      'thread_id', 'post_' || NEW.post_id
    ),
    'https://growbro.app/post/' || NEW.post_id,
    now(),
    false
  )
  -- Use ON CONFLICT to prevent duplicate like notifications for the same post
  -- This ensures only one notification per post is queued at a time
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger for post likes
DROP TRIGGER IF EXISTS post_like_notification ON post_likes;
CREATE TRIGGER post_like_notification
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_like();

-- Add unique constraint to prevent duplicate like notifications per post
-- Note: This assumes notification_requests has a unique constraint on (user_id, type, data->>'post_id', processed)
-- If not, add it:
DO $$
BEGIN
  -- Add constraint only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notification_requests_unique_like_per_post'
  ) THEN
    -- Note: This constraint prevents multiple unprocessed like notifications for the same post
    -- It will be removed once we implement proper notification grouping
    ALTER TABLE notification_requests
    ADD CONSTRAINT notification_requests_unique_like_per_post
    EXCLUDE USING btree (
      user_id WITH =,
      type WITH =,
      ((data->>'post_id')::uuid) WITH =,
      processed WITH =
    )
    WHERE (type = 'community.like' AND processed = false);
  END IF;
END;
$$;

-- Add comments documenting the triggers
COMMENT ON FUNCTION notify_post_reply() IS 
'Triggers notification request when a user replies to a post. Uses collapse_key (post_<id>) for Android deduplication and thread_id for iOS grouping. Prevents self-notifications.';

COMMENT ON FUNCTION notify_post_like() IS 
'Triggers notification request when a user likes a post. Uses collapse_key (like_<id>) for Android deduplication and thread_id for iOS grouping. Prevents self-notifications and duplicate notifications for same post.';

COMMENT ON TRIGGER post_reply_notification ON post_replies IS 
'Automatically queues notification request when a post receives a new reply.';

COMMENT ON TRIGGER post_like_notification ON post_likes IS 
'Automatically queues notification request when a post receives a new like. Deduplicates multiple likes on same post.';
