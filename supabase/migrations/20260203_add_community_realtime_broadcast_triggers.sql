-- Migration: Switch community feed from postgres_changes to Broadcast
-- This is more reliable and performant for production apps

-- Helper function to broadcast post changes
CREATE OR REPLACE FUNCTION broadcast_post_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  payload jsonb;
  event_type text;
BEGIN
  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'INSERT';
    payload := jsonb_build_object(
      'eventType', event_type,
      'new', row_to_json(NEW)::jsonb,
      'old', null,
      'commit_timestamp', now()
    );
  ELSIF TG_OP = 'UPDATE' THEN
    event_type := 'UPDATE';
    payload := jsonb_build_object(
      'eventType', event_type,
      'new', row_to_json(NEW)::jsonb,
      'old', row_to_json(OLD)::jsonb,
      'commit_timestamp', now()
    );
  ELSIF TG_OP = 'DELETE' THEN
    event_type := 'DELETE';
    payload := jsonb_build_object(
      'eventType', event_type,
      'new', null,
      'old', row_to_json(OLD)::jsonb,
      'commit_timestamp', now()
    );
  END IF;

  -- Send to global feed channel (public - anyone can subscribe)
  PERFORM realtime.send(
    payload,
    'post_change',
    'community-feed-global',
    false  -- public channel
  );

  -- Also send to post-specific channel for detail views
  PERFORM realtime.send(
    payload,
    'post_change',
    'community-feed-post-' || COALESCE(NEW.id, OLD.id)::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Helper function to broadcast comment changes
CREATE OR REPLACE FUNCTION broadcast_comment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  payload jsonb;
  event_type text;
  post_id uuid;
BEGIN
  -- Get post_id from NEW or OLD
  post_id := COALESCE(NEW.post_id, OLD.post_id);

  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'INSERT';
    payload := jsonb_build_object(
      'eventType', event_type,
      'new', row_to_json(NEW)::jsonb,
      'old', null,
      'commit_timestamp', now()
    );
  ELSIF TG_OP = 'UPDATE' THEN
    event_type := 'UPDATE';
    payload := jsonb_build_object(
      'eventType', event_type,
      'new', row_to_json(NEW)::jsonb,
      'old', row_to_json(OLD)::jsonb,
      'commit_timestamp', now()
    );
  ELSIF TG_OP = 'DELETE' THEN
    event_type := 'DELETE';
    payload := jsonb_build_object(
      'eventType', event_type,
      'new', null,
      'old', row_to_json(OLD)::jsonb,
      'commit_timestamp', now()
    );
  END IF;

  -- Send to post-specific channel only (comments are post-scoped)
  PERFORM realtime.send(
    payload,
    'comment_change',
    'community-feed-post-' || post_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Helper function to broadcast like changes
CREATE OR REPLACE FUNCTION broadcast_like_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  payload jsonb;
  event_type text;
  post_id uuid;
BEGIN
  -- Get post_id from NEW or OLD
  post_id := COALESCE(NEW.post_id, OLD.post_id);

  -- Determine event type
  IF TG_OP = 'INSERT' THEN
    event_type := 'INSERT';
    payload := jsonb_build_object(
      'eventType', event_type,
      'new', row_to_json(NEW)::jsonb,
      'old', null,
      'commit_timestamp', now()
    );
  ELSIF TG_OP = 'DELETE' THEN
    event_type := 'DELETE';
    payload := jsonb_build_object(
      'eventType', event_type,
      'new', null,
      'old', row_to_json(OLD)::jsonb,
      'commit_timestamp', now()
    );
  END IF;

  -- Send to post-specific channel only (likes are post-scoped)
  PERFORM realtime.send(
    payload,
    'like_change',
    'community-feed-post-' || post_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers on posts table
DROP TRIGGER IF EXISTS broadcast_post_insert ON posts;
CREATE TRIGGER broadcast_post_insert
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_post_change();

DROP TRIGGER IF EXISTS broadcast_post_update ON posts;
CREATE TRIGGER broadcast_post_update
  AFTER UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_post_change();

DROP TRIGGER IF EXISTS broadcast_post_delete ON posts;
CREATE TRIGGER broadcast_post_delete
  AFTER DELETE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_post_change();

-- Create triggers on post_comments table
DROP TRIGGER IF EXISTS broadcast_comment_insert ON post_comments;
CREATE TRIGGER broadcast_comment_insert
  AFTER INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_comment_change();

DROP TRIGGER IF EXISTS broadcast_comment_update ON post_comments;
CREATE TRIGGER broadcast_comment_update
  AFTER UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_comment_change();

DROP TRIGGER IF EXISTS broadcast_comment_delete ON post_comments;
CREATE TRIGGER broadcast_comment_delete
  AFTER DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_comment_change();

-- Create triggers on post_likes table
DROP TRIGGER IF EXISTS broadcast_like_insert ON post_likes;
CREATE TRIGGER broadcast_like_insert
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_like_change();

DROP TRIGGER IF EXISTS broadcast_like_delete ON post_likes;
CREATE TRIGGER broadcast_like_delete
  AFTER DELETE ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_like_change();
