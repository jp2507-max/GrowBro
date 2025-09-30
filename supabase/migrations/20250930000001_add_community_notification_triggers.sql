-- Migration: Add community notification triggers for post replies and likes
-- This migration creates database triggers that automatically send push notifications
-- when users reply to or like posts.

-- Create function to send notification on post reply
CREATE OR REPLACE FUNCTION notify_post_reply()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id UUID;
  reply_preview TEXT;
  post_title TEXT;
BEGIN
  -- Get the post author's user ID and title
  SELECT user_id, title INTO post_author_id, post_title
  FROM posts
  WHERE id = NEW.post_id;

  -- Don't send notification if user is replying to their own post
  IF post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Truncate reply content to 100 chars for preview
  reply_preview := LEFT(NEW.content, 100);
  IF LENGTH(NEW.content) > 100 THEN
    reply_preview := reply_preview || '...';
  END IF;

  -- Call Edge Function to send push notification
  -- The Edge Function will handle user preferences, token retrieval, and delivery
  PERFORM
    net.http_post(
      url := current_setting('app.settings.edge_function_url') || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'userId', post_author_id::text,
        'type', 'community.reply',
        'title', 'New reply to your post',
        'body', reply_preview,
        'deepLink', 'growbro://post/' || NEW.post_id::text,
        'metadata', jsonb_build_object(
          'postId', NEW.post_id::text,
          'replyId', NEW.id::text,
          'replyAuthor', NEW.user_id::text
        )
      )::text
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to send notification on post like
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id UUID;
  post_title TEXT;
  like_count INTEGER;
BEGIN
  -- Get the post author's user ID
  SELECT user_id, title INTO post_author_id, post_title
  FROM posts
  WHERE id = NEW.post_id;

  -- Don't send notification if user is liking their own post
  IF post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get current like count for this post
  SELECT COUNT(*) INTO like_count
  FROM post_likes
  WHERE post_id = NEW.post_id;

  -- Call Edge Function to send push notification
  -- Uses collapse_key/thread-id per post for deduplication
  PERFORM
    net.http_post(
      url := current_setting('app.settings.edge_function_url') || '/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'userId', post_author_id::text,
        'type', 'community.like',
        'title', 'Someone liked your post',
        'body', CASE
          WHEN like_count = 1 THEN '1 person liked your post'
          ELSE like_count::text || ' people liked your post'
        END,
        'deepLink', 'growbro://post/' || NEW.post_id::text,
        'collapseKey', 'like_' || NEW.post_id::text,
        'threadId', 'post_' || NEW.post_id::text,
        'metadata', jsonb_build_object(
          'postId', NEW.post_id::text,
          'likeCount', like_count
        )
      )::text
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for post replies
-- Fires after a new reply is inserted
DROP TRIGGER IF EXISTS trigger_notify_post_reply ON post_replies;
CREATE TRIGGER trigger_notify_post_reply
  AFTER INSERT ON post_replies
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_reply();

-- Create trigger for post likes
-- Fires after a new like is inserted
DROP TRIGGER IF EXISTS trigger_notify_post_like ON post_likes;
CREATE TRIGGER trigger_notify_post_like
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_like();

-- Add indexes for efficient post author lookups
CREATE INDEX IF NOT EXISTS idx_post_replies_post_id ON post_replies(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_post_reply() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_post_like() TO authenticated;

COMMENT ON FUNCTION notify_post_reply() IS 'Sends push notification to post author when someone replies';
COMMENT ON FUNCTION notify_post_like() IS 'Sends push notification to post author when someone likes their post';
