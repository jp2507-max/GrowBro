-- Migration: Add triggers to maintain cached counters on posts table
-- Description: Ensures like_count and comment_count stay consistent with post_likes and post_comments
-- Requirements: 1.5, 1.6 (data consistency)

-- Function to increment like count
CREATE OR REPLACE FUNCTION increment_like_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts
  SET like_count = like_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement like count
CREATE OR REPLACE FUNCTION decrement_like_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts
  SET like_count = GREATEST(like_count - 1, 0)
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle comment count changes
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;

  -- Handle UPDATE (soft delete case)
  IF TG_OP = 'UPDATE' THEN
    -- If comment was soft deleted (deleted_at set when it wasn't before)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      UPDATE public.posts
      SET comment_count = GREATEST(comment_count - 1, 0)
      WHERE id = NEW.post_id;
    END IF;

    -- If comment was restored (deleted_at cleared when it was set before)
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
      UPDATE public.posts
      SET comment_count = comment_count + 1
      WHERE id = NEW.post_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for post_likes table
DROP TRIGGER IF EXISTS trigger_increment_like_count ON public.post_likes;
CREATE TRIGGER trigger_increment_like_count
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION increment_like_count();

DROP TRIGGER IF EXISTS trigger_decrement_like_count ON public.post_likes;
CREATE TRIGGER trigger_decrement_like_count
  AFTER DELETE ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_like_count();

-- Triggers for post_comments table
DROP TRIGGER IF EXISTS trigger_update_comment_count ON public.post_comments;
CREATE TRIGGER trigger_update_comment_count
  AFTER INSERT OR UPDATE OR DELETE ON public.post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_count();

-- Add comments for documentation
COMMENT ON FUNCTION increment_like_count() IS 'Increments like_count on posts table when a like is added';
COMMENT ON FUNCTION decrement_like_count() IS 'Decrements like_count on posts table when a like is removed, ensuring non-negative count';
COMMENT ON FUNCTION update_comment_count() IS 'Maintains comment_count on posts table for INSERT/DELETE and soft delete/restore operations';
COMMENT ON TRIGGER trigger_increment_like_count ON public.post_likes IS 'Triggers like count increment on new likes';
COMMENT ON TRIGGER trigger_decrement_like_count ON public.post_likes IS 'Triggers like count decrement on like removal';
COMMENT ON TRIGGER trigger_update_comment_count ON public.post_comments IS 'Triggers comment count maintenance on comment changes';
