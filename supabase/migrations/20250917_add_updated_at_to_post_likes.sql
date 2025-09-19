-- Add updated_at column to post_likes table for LWW pattern consistency
ALTER TABLE post_likes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Create moddatetime trigger for post_likes to update updated_at on row changes
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON post_likes
  FOR EACH ROW EXECUTE PROCEDURE extensions.moddatetime(updated_at);