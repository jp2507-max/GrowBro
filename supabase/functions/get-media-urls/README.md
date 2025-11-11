# get-media-urls

Edge Function to generate signed URLs for community post media.

## Purpose

This function solves a critical security/functionality issue: the `community-posts` storage bucket uses RLS policies that restrict users to only access their own folders (where `foldername[1] = auth.uid()`). While this correctly enforces upload/delete restrictions, it prevents users from generating signed URLs for media in other users' posts that are visible in the feed.

## Security Model

### Access Control

- **Requires authentication**: Only authenticated users can call this function
- **No post ownership validation**: Assumes the caller has already verified post visibility via posts table RLS
- **Service-role key usage**: Uses service-role client to bypass storage RLS and generate signed URLs
- **Time-limited URLs**: Signed URLs expire after 7 days (maximum allowed by Supabase)

### Why This Is Secure

1. **Posts table RLS enforces visibility**: Before calling this function, clients fetch posts via the `posts` table, which already has RLS policies preventing access to deleted/hidden content
2. **Path validation**: Function validates path format to prevent directory traversal attacks
3. **No data leakage**: Function only returns signed URLs; it doesn't expose file contents or metadata
4. **Time-limited access**: URLs expire after 7 days, requiring re-authentication
5. **Requires exact paths**: Attacker would need to know the exact userId/contentHash/variant combination

### Trust Assumptions

- **Client respects post visibility**: We trust that clients only request URLs for posts they've already fetched via proper RLS-protected queries
- **Storage paths are opaque**: contentHash is a SHA-256 hash; guessing valid paths is computationally infeasible
- **Feed-level security is sufficient**: If a post appears in the feed, its media should be accessible

## Request Format

```typescript
POST / get - media - urls;
Authorization: Bearer <
  user - jwt >
  {
    paths: [
      'userId/contentHash/original.jpg',
      'userId/contentHash/resized.jpg',
      'userId/contentHash/thumbnail.jpg',
    ],
  };
```

## Response Format

```typescript
{
  "urls": {
    "userId/contentHash/original.jpg": "https://supabase.co/storage/v1/object/sign/...",
    "userId/contentHash/resized.jpg": "https://supabase.co/storage/v1/object/sign/...",
    "userId/contentHash/thumbnail.jpg": "https://supabase.co/storage/v1/object/sign/..."
  }
}
```

## Error Handling

- **Invalid paths**: Skipped silently; only valid paths appear in response
- **Storage errors**: Individual failures return original path as fallback
- **Authentication failure**: Returns 401
- **Empty request**: Returns 400

## Performance Optimization

- Batch processing: Generates signed URLs for multiple paths in parallel
- Efficient validation: Single pass through paths with early rejection
- Fallback behavior: Returns original path on error to avoid breaking UI

## Usage Example

```typescript
// In CommunityApiClient
const mediaPaths = posts
  .flatMap((post) => [
    post.media_uri,
    post.media_resized_uri,
    post.media_thumbnail_uri,
  ])
  .filter(Boolean);

const signedUrlMap = await this.generateSignedUrls(mediaPaths);

// Map posts with signed URLs
const postsWithUrls = posts.map((post) => ({
  ...post,
  media_uri: signedUrlMap[post.media_uri] ?? post.media_uri,
  // ... other variants
}));
```

## Related Files

- **Migration**: `supabase/migrations/20251108_create_community_posts_bucket.sql` - Defines RLS policies that necessitate this function
- **Client**: `src/api/community/client.ts` - Uses this function to generate signed URLs for feed posts
- **Upload**: `supabase/functions/create-post/index.ts` - Handles media upload and storage path generation

## Alternative Approaches Considered

1. **Public bucket**: Would expose all media without authentication ❌
2. **Relaxed RLS policies**: Would allow users to read any file ❌
3. **Per-post permissions**: Too complex and slow for feed pagination ❌
4. **Client-side workarounds**: Can't bypass RLS without service-role key ❌

This function provides the best balance of security and functionality.
