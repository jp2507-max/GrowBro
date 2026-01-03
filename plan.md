# Community Screen – Production-Ready Plan (incl. Discovery MVP)

This plan is written so another coding agent can implement the next branch end-to-end with minimal guesswork.

Applied Cursor rules (repo): `product.mdc` (offline-first + safety/moderation), `projectrules.mdc` (TypeScript/Expo + i18n/a11y), `structure.mdc` (project layout).

---

## 0) Goals / Definition of Done

### Primary goal

Make the **Community** tab production-ready: reliable, consistent, offline-capable, moderated, and discoverable.

### “Done” checklist (must hit)

- Feed list + post detail are **data-consistent** (likes/comments counts & “liked” state stay in sync across screens).
- Offline actions (like/unlike/comment/delete/undo) are **queued and drained automatically** on reconnect.
- Realtime updates (or fallback polling) keep the feed reasonably fresh without manual refresh.
- Push notification deep links land on the correct screen (post and comment deep link formats supported).
- Discovery MVP: **search + sort + a couple filters** shipped without “week-long” scope.
- i18n (EN/DE) and a11y for all new UI strings/interactions.

### Non-goals (explicitly not in this branch)

- Following graph (follow users/topics), groups, DMs, complex ranking algorithms, “recommended for you”.
- Rich post composer beyond what exists (e.g. multi-image posts, link previews) unless already implemented.

---

## 1) Current State (what exists in the repo)

### Screens

- Community feed tab: `src/app/(app)/community.tsx`
- Post detail (comments + moderation actions): `src/app/feed/[id].tsx`
- User profile: `src/app/community/[user-id].tsx`
- Post composer: `src/app/feed/add-post.tsx` (also routed via `src/app/(modals)/add-post.tsx`)

### API / Data (important inconsistencies)

- Feed list uses REST-ish Axios query: `src/api/posts/use-posts-infinite.ts` (query key `['posts-infinite']`)
- Likes/unlikes/comments use Supabase direct: `src/api/community/*` (query keys like `['posts']`, `['comments']`)
- Post detail uses Supabase community query: `src/api/community` (not `src/api/posts/use-post.ts`)

### Offline / Realtime primitives exist but aren’t wired

- Outbox processor + reconnection handler: `src/lib/community/outbox-processor.ts`, `src/lib/community/reconnection-handler.ts`
- Realtime manager + hook: `src/lib/community/realtime-manager.ts`, `src/lib/community/use-community-feed-realtime.ts`

### Moderation / compliance

- Report/block/mute UI exists on post detail: `src/components/moderation-actions.tsx`
- DB migrations cover posts/comments/likes/moderation/storage/push triggers: `supabase/migrations/*`

### Known production blockers (from audit)

1. Cache/key mismatch: feed reads `['posts-infinite']` while like/unlike and realtime adapters mutate `['posts']`.
2. Reconnection/outbox draining isn’t started anywhere → offline queue may never flush automatically.
3. Push deep link mismatch: DB trigger uses `growbro://post/<postId>/comment/<commentId>` but app only aliases `growbro://post/:id` → comment notifications won’t land correctly.

---

## 2) Architecture Decision for This Branch (make it consistent)

### Decision A (recommended): Community uses Supabase “community” API for reads

**Unify community feed + post detail + user posts on `src/api/community`** so:

- One backend source of truth (Supabase tables + edge functions for signed URLs).
- Consistent fields (like_count/comment_count/user_has_liked/is_age_restricted/media variants).

Concretely:

- Create a `useCommunityPostsInfinite` hook in `src/api/community/` similar to `src/api/posts/use-posts-infinite.ts` but calling `getCommunityApiClient().getPosts(...)`.
- Update `src/app/(app)/community.tsx` to use the new community hook instead of `usePostsInfinite` from `src/api/posts`.

### Decision B (fallback): Keep REST feed, but fix all caches

Only choose this if there’s a strong reason the REST endpoints must remain canonical. It requires updating optimistic updates/realtime/reconnect to target the infinite query cache shape, which is more complex.

This plan assumes **Decision A**.

---

## 3) Work Breakdown (PR-sized chunks)

### PR 1 — Data/Cache Unification (P0)

**Objective:** the feed list, post detail, and user profile reflect consistent post state.

#### Tasks

1. Add canonical query key helpers
   - Add `src/lib/community/query-keys.ts` (or similar) exporting functions like:
     - `communityPostsInfiniteKey(params)`
     - `communityPostKey(postId)`
     - `communityCommentsKey(postId, cursor, limit)`
     - `communityUserPostsKey(userId, limit)`
   - Replace ad-hoc keys in:
     - `src/api/community/index.ts`
     - `src/api/community/use-like-post.ts`
     - `src/api/community/use-unlike-post.ts`
     - `src/app/feed/[id].tsx`
     - `src/app/community/[user-id].tsx`

2. Create `useCommunityPostsInfinite`
   - New file: `src/api/community/use-posts-infinite.ts`
   - Use `createInfiniteQuery` (react-query-kit) and fetch via `getCommunityApiClient().getPosts(cursor, limit)`.
   - Ensure page param uses `created_at` cursor already returned by `getPosts`.
   - Key must be distinct (avoid collisions with legacy `['posts']`).

3. Update Community tab to use community infinite hook
   - Edit `src/app/(app)/community.tsx`:
     - Replace `usePostsInfinite` import from `@/api` with new `@/api/community/use-posts-infinite`.
     - Ensure types match (post type: prefer `src/api/community/types.ts`).
     - Verify existing age-gating (`useAgeGatedFeed`) still works with returned post fields.

4. Update like/unlike optimistic updates to patch the correct caches
   - Edit `src/api/community/use-like-post.ts` and `src/api/community/use-unlike-post.ts`:
     - Update optimistic cache writes to target the new infinite feed key and (optionally) post detail key.
     - Avoid the current `queryClient.setQueryData(['posts'], ...)` mismatch.
   - Add a shared helper in `src/lib/community/cache-updaters.ts`:
     - `updatePostInInfiniteFeed(queryClient, { matchPostId, updater })`
     - `updatePostInUserPosts(queryClient, userId, updater)` (optional)
     - `updateSinglePost(queryClient, postId, updater)` (post detail screen)

#### Acceptance criteria

- Liking/unliking immediately updates the post card in the community list.
- Navigating into the post detail shows consistent like state/count.

#### Tests

- Add unit tests for cache updater helpers (fast, deterministic).
- Add one integration-style test (if existing patterns allow) that renders community feed, triggers like, asserts count changes.

---

### PR 2 — Wire Offline Queue Draining + Realtime (P0)

**Objective:** offline actions reliably sync and realtime keeps feed fresh.

#### Tasks

1. Start reconnection handler at an appropriate lifecycle point
   - Recommended location: `src/app/(app)/_layout.tsx` or a top-level hook called once.
   - Create a small hook `src/lib/community/use-community-sync.ts`:
     - Gets `queryClient` via `useQueryClient()`.
     - Uses `database` from `@/lib/watermelon`.
     - Calls `getReconnectionHandler(database, queryClient).start()` in a `useEffect`.
     - Cleans up with `.stop()` on unmount.
   - Attach that hook in a component that mounts for authenticated users (tab layout is fine).

2. Wire realtime to invalidate/update the same caches as PR1
   - Update `src/lib/community/use-community-feed-realtime.ts`:
     - Align cache adapters and invalidations to the **new community query keys**.
     - If using “invalidate” instead of “upsert”, ensure invalidations include:
       - community infinite feed key
       - post detail key
       - comments key when relevant
   - Call `useCommunityFeedRealtime()` from:
     - `src/app/(app)/community.tsx` (global feed subscription), and
     - `src/app/feed/[id].tsx` (post-scoped subscription for comments/likes on that post), if desired.

3. Minimal outbox status UI
   - Add a small banner component (e.g. `src/components/community/outbox-banner.tsx`) that:
     - polls `outboxProcessor.getStatus()` every 1–2s while screen focused
     - shows “Sending…” when pending > 0
     - shows “Failed to send · Retry” when failed > 0
   - Insert near the top of the community list header (below `OfflineIndicator`).

#### Acceptance criteria

- If you like/unlike/comment while offline, it queues and then automatically flushes when reconnecting.
- When another client likes/comments, the feed updates (or refetches) without manual pull-to-refresh.

#### Notes

- `src/api/common/api-provider.tsx` says “React Query for reads only; WatermelonDB for writes”.
  - This branch can keep the existing “queue to Watermelon + attempt immediate API call” approach, but ensure it doesn’t rely on React Query mutation persistence.

---

### PR 3 — Push Deep Links (P0) + Comment Targeting (P1)

**Objective:** push notifications land users on the intended post/comment.

#### Tasks

1. Support the existing trigger deep link format
   - DB trigger uses: `growbro://post/<postId>/comment/<commentId>`
   - Add route file:
     - `src/app/post/[id]/comment/[comment-id].tsx`
     - It should read params and redirect to `/feed/${id}?commentId=${commentId}` (same pattern as `src/app/post/[id].tsx`).
   - Keep current deep link alias `src/app/post/[id].tsx` as-is.

2. (Optional) Improve comment targeting on `src/app/feed/[id].tsx`
   - Current code logs a placeholder when `commentId` exists.
   - MVP option: highlight the comment element once comments are loaded:
     - Add `highlightedCommentId?: string` prop to `CommentList`
     - Apply a temporary background style on the matched comment
   - Stretch: implement scroll-to-comment by measuring comment layout (more work).

#### Acceptance criteria

- Opening a comment notification navigates to the correct post screen and makes it clear which comment was targeted (at least via highlight).

---

### PR 4 — Discovery MVP (Search + Sort + Filters) (P1, bounded scope)

**Objective:** add discovery without “week-long” scope.

#### UX scope (MVP)

- Search bar at top of Community feed.
- Sort: `Newest` (default), `Top (7d)` (by `like_count`, tie-breaker `created_at`).
- Filters: `Photos only`, `My posts` (optional if quick).
- No “following/topics/groups” in this branch.

#### Backend/query approach

- Prefer server-side filtering via Supabase query builder (fast enough, simplest).
- Add DB index to keep ILIKE performant as data grows:
  - `pg_trgm` + partial GIN index on `posts.body` (and `posts.title` if title exists in schema).

#### Tasks

1. DB migration for search performance
   - New migration: `supabase/migrations/<timestamp>_add_posts_search_indexes.sql`
   - SQL sketch:
     - `create extension if not exists pg_trgm;`
     - `create index if not exists idx_posts_body_trgm on public.posts using gin (body gin_trgm_ops) where deleted_at is null and hidden_at is null;`
     - (optional) same for `title` if column exists.

2. Extend community client to support discovery params
   - Edit `src/api/community/client.ts`:
     - Add a method `getPostsDiscover({ query, cursor, limit, sort, photosOnly, mineOnly })`
     - Build query:
       - baseline: visible posts only (already enforced by RLS, but keep `.is('deleted_at', null)` / `.is('hidden_at', null)`)
       - search: `.or('body.ilike.%q%,title.ilike.%q%')` (only include title if column exists)
       - photos only: filter where any media uri is not null
       - mine only: `eq('user_id', auth.uid())` (requires session)
       - sort:
         - newest: `order('created_at', { ascending: false })`
         - top7d: `gte('created_at', nowMinus7dIso)` then `order('like_count', { ascending: false })` then `order('created_at', { ascending: false })`
     - Reuse existing signed-URL batch logic (`generateSignedUrls`) so media still renders correctly.

3. New discovery-aware infinite hook
   - Edit/extend `src/api/community/use-posts-infinite.ts` to accept variables:
     - `query?: string`
     - `sort?: 'new' | 'top_7d'`
     - `photosOnly?: boolean`
     - `mineOnly?: boolean`
     - `limit?: number`
   - Key must include variables so caches don’t collide across different searches.

4. UI changes on Community screen
   - Edit `src/app/(app)/community.tsx`:
     - Add a search input (reuse patterns from `src/components/inventory/inventory-search-bar.tsx` or implement a small `CommunitySearchBar`).
     - Debounce search to 150–300ms.
     - Add a filter/sort bottom sheet using `Modal` like inventory search screen.
     - Ensure age gating still applies to results (`useAgeGatedFeed.filterPosts`).
     - Track analytics events (optional): `community_search`, `community_sort_change`.

5. i18n/a11y
   - Add translation keys for:
     - search placeholder, clear, sort labels, filter labels, empty results.
   - Ensure controls have accessibility labels/hints.

#### Acceptance criteria

- User can search posts by body (and title if present) and see results quickly.
- “Top (7d)” shows different ordering than “Newest” when likes exist.
- Photos-only filter reduces results to media posts.

---

### PR 5 — Polish + QA Gate (P1)

#### Tasks

- Replace any remaining hardcoded English strings in community UI (including Like/Unlike labels) with `translate(...)`.
- Verify age-gated and geo-restricted behaviors still apply in discovery flows.
- Add/adjust tests:
  - Deep link redirect test for `/post/:id/comment/:commentId`
  - Cache updater unit tests
  - Discovery query builder unit test (sort + filter correctness)
- Manual QA checklist (see below).

---

## 4) Manual QA Checklist (run before merging)

### Feed + detail consistency

- Like a post in feed → count updates immediately.
- Open the same post detail → like state and count match.
- Unlike from detail → feed updates.

### Offline

- Go offline.
- Like/unlike/comment → UI reflects optimistic state and shows a “sending” banner.
- Go online → queue drains, banner disappears, state matches server.

### Realtime

- With two clients, create/like/comment from one → other updates or refetches without manual refresh.

### Push deep links

- Simulate open URL:
  - `growbro://post/<postId>`
  - `growbro://post/<postId>/comment/<commentId>`
- Verify both land on `/feed/[id]` and comment targeting is visible (highlight or scroll).

### Discovery

- Search for a unique phrase in a post → it appears.
- Sort “Top (7d)” → liked posts bubble up.
- Photos-only filter → hides text-only posts.

### Compliance

- Age-gate prompt still appears when required.
- Report/block/mute still reachable from post detail.

---

## 5) Open Questions (answer before implementation starts)

1. Should discovery search include usernames (profiles.username) or only post text (body/title)?
   - MVP recommendation: post text only (fastest).
2. Should “Top” be likes only, or likes + comments weighting?
   - MVP recommendation: likes only.
3. Do we want discovery to be global-only, or add a “My posts” filter in the same UI?
   - MVP recommendation: include “My posts” toggle if trivial (requires session).
