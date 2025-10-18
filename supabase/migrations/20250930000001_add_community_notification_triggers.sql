-- Migration: Add community notification triggers for post comments and likes
-- This migration creates database triggers that automatically send push notifications
-- when users comment on or like posts.

-- Create function to send notification on post comment
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id UUID;
  comment_preview TEXT;
  post_body TEXT;
BEGIN
  -- Get the post author's user ID and body
  SELECT user_id, body INTO post_author_id, post_body
  FROM posts
  WHERE id = NEW.post_id;

  -- Don't send notification if user is commenting on their own post
  IF post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Truncate comment content to 100 chars for preview
  comment_preview := LEFT(NEW.body, 100);
  IF LENGTH(NEW.body) > 100 THEN
    comment_preview := comment_preview || '...';
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
        'title', 'New comment on your post',
        'body', comment_preview,
        'deepLink', 'growbro://post/' || NEW.post_id::text || '/comment/' || NEW.id::text,
        'metadata', jsonb_build_object(
          'postId', NEW.post_id::text,
          'commentId', NEW.id::text,
          'commentAuthor', NEW.user_id::text
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
  post_body TEXT;
  like_count INTEGER;
BEGIN
  -- Get the post author's user ID
  SELECT user_id, body INTO post_author_id, post_body
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
  -- Uses collapse_key/thread-id per post for deduplication (rate limiting: max 1 per post per 5 min)
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

-- Create trigger for post comments
-- Fires after a new comment is inserted
DROP TRIGGER IF EXISTS trigger_notify_post_comment ON post_comments;
CREATE TRIGGER trigger_notify_post_comment
  AFTER INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_comment();

-- Create trigger for post likes
-- Fires after a new like is inserted
DROP TRIGGER IF EXISTS trigger_notify_post_like ON post_likes;
CREATE TRIGGER trigger_notify_post_like
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_like();

-- Add indexes for efficient post author lookups
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION notify_post_comment() TO authenticated;
GRANT EXECUTE ON FUNCTION notify_post_like() TO authenticated;

COMMENT ON FUNCTION notify_post_comment() IS 'Sends push notification to post author when someone comments';
COMMENT ON FUNCTION notify_post_like() IS 'Sends push notification to post author when someone likes their post';
