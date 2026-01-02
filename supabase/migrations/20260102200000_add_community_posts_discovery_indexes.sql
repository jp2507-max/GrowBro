-- Support top-post sorting on visible posts
create index if not exists idx_posts_visible_like_count_created_at
  on public.posts (like_count desc, created_at desc)
  where deleted_at is null and hidden_at is null;

-- Speed up photos-only filter with recency ordering
create index if not exists idx_posts_visible_media_created_at
  on public.posts (created_at desc)
  where deleted_at is null
    and hidden_at is null
    and (
      media_uri is not null
      or media_resized_uri is not null
      or media_thumbnail_uri is not null
    );

-- idx_comments_post_visible covers post_id lookups for visible comments
drop index if exists public.idx_comments_post;
