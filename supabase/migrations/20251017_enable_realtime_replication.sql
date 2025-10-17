-- Migration: Enable realtime replication for community tables
-- Description: Add posts, post_comments, and post_likes to realtime publication
-- Requirements: 3.1, 3.2 (real-time updates)

-- Enable realtime replication for community tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;

-- Add comments for documentation
COMMENT ON TABLE public.posts IS 'Community posts - realtime enabled for live updates';
COMMENT ON TABLE public.post_comments IS 'Post comments - realtime enabled for live updates';
COMMENT ON TABLE public.post_likes IS 'Post likes - realtime enabled for live updates';
