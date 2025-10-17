# RLS Policy Testing Guide

## Overview

This document provides test cases to verify Row Level Security policies for the community feed tables.

## Test Prerequisites

### Test Users Setup

Create three test users with different roles:

```sql
-- Note: These INSERT commands are examples. In practice, users are created via Supabase Auth.
-- After creating users through Auth, update their roles as shown below.

-- Regular user (no special roles)
-- user_id: '11111111-1111-1111-1111-111111111111'
-- email: test_user@example.com

-- Moderator user
-- user_id: '22222222-2222-2222-2222-222222222222'
-- email: test_moderator@example.com
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{roles}',
  '["moderator"]'::jsonb
)
WHERE id = '22222222-2222-2222-2222-222222222222';

-- Admin user
-- user_id: '33333333-3333-3333-3333-333333333333'
-- email: test_admin@example.com
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{roles}',
  '["admin"]'::jsonb
)
WHERE id = '33333333-3333-3333-3333-333333333333';
```

### Test Data Setup

Create test posts and comments:

```sql
-- Create a post by regular user
INSERT INTO public.posts (id, user_id, content)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Test post by regular user'
);

-- Create a post by moderator (for ownership tests)
INSERT INTO public.posts (id, user_id, content)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-222222222222',
  'Test post by moderator'
);

-- Create a comment by regular user
INSERT INTO public.post_comments (id, post_id, user_id, content)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Test comment by regular user'
);
```

## Test Cases

### 1. Posts Table - Regular User Tests

#### Test 1.1: Regular user can read non-deleted posts

**Requirement:** 10.2

```sql
-- As regular user (11111111-1111-1111-1111-111111111111)
SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

SELECT * FROM public.posts
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: Success - returns 1 row
```

#### Test 1.2: Regular user can insert their own post

**Requirement:** 10.2

```sql
-- As regular user
INSERT INTO public.posts (user_id, content)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'New post by regular user'
);

-- Expected: Success
```

#### Test 1.3: Regular user cannot insert post for another user

**Requirement:** 10.2

```sql
-- As regular user (11111111-1111-1111-1111-111111111111)
INSERT INTO public.posts (user_id, content)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'Trying to impersonate moderator'
);

-- Expected: Error - "new row violates row-level security policy"
```

#### Test 1.4: Regular user can update their own post

**Requirement:** 10.2

```sql
-- As regular user
UPDATE public.posts
SET content = 'Updated content'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: Success
```

#### Test 1.5: Regular user cannot update another user's post

**Requirement:** 10.2

```sql
-- As regular user (11111111-1111-1111-1111-111111111111)
UPDATE public.posts
SET content = 'Trying to update moderator post'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

-- Expected: Error - no rows updated (USING clause fails)
```

#### Test 1.6: Regular user cannot set moderation fields

**Requirement:** 10.2, 10.3

```sql
-- As regular user
UPDATE public.posts
SET hidden_at = now(), moderation_reason = 'Spam'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: Error - "new row violates row-level security policy" (WITH CHECK fails)
```

#### Test 1.7: Regular user can delete their own post

**Requirement:** 10.2

```sql
-- As regular user
DELETE FROM public.posts
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: Success (soft delete via trigger or application logic)
```

### 2. Posts Table - Moderator Tests

#### Test 2.1: Moderator can read all posts

**Requirement:** 10.2

```sql
-- As moderator (22222222-2222-2222-2222-222222222222)
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SET request.jwt.claim.app_metadata = '{"roles": ["moderator"]}'::jsonb;

SELECT * FROM public.posts;

-- Expected: Success - returns all non-deleted, non-hidden posts
```

#### Test 2.2: Moderator can hide any post

**Requirement:** 10.3

```sql
-- As moderator
UPDATE public.posts
SET hidden_at = now(), moderation_reason = 'Inappropriate content'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: Success
```

#### Test 2.3: Moderator cannot update non-moderation fields via moderation policy

**Requirement:** 10.3

```sql
-- As moderator (trying to use moderation policy to update content)
UPDATE public.posts
SET content = 'Modified by moderator'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: Depends on implementation - either uses owner policy (if mod owns post) or fails
-- Moderator policy should only allow setting hidden_at/moderation_reason
```

#### Test 2.4: Moderator can update with both role claim and app_metadata

**Requirement:** 10.3

```sql
-- Test with role in top-level JWT claim
SET request.jwt.claim.role = 'moderator';

UPDATE public.posts
SET hidden_at = now(), moderation_reason = 'Test'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: Success

-- Test with role in app_metadata
SET request.jwt.claim.role = null;
SET request.jwt.claim.app_metadata = '{"roles": ["moderator"]}'::jsonb;

UPDATE public.posts
SET hidden_at = null, moderation_reason = null
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Expected: Success
```

### 3. Post Comments Table Tests

#### Test 3.1: User can insert their own comment

**Requirement:** 10.2

```sql
-- As regular user
INSERT INTO public.post_comments (post_id, user_id, content)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'My comment'
);

-- Expected: Success
```

#### Test 3.2: User cannot set hidden_at on their own comment

**Requirement:** 10.2

```sql
-- As regular user
UPDATE public.post_comments
SET hidden_at = now()
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Expected: Error - "new row violates row-level security policy" (WITH CHECK fails)
```

#### Test 3.3: Moderator can hide comments

**Requirement:** 10.3

```sql
-- As moderator
UPDATE public.post_comments
SET hidden_at = now()
WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- Expected: Success
```

### 4. Post Likes Table Tests

#### Test 4.1: User can insert like for themselves

**Requirement:** 10.1

```sql
-- As regular user
INSERT INTO public.post_likes (post_id, user_id)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111'
);

-- Expected: Success
```

#### Test 4.2: User cannot insert like for another user

**Requirement:** 10.1

```sql
-- As regular user (11111111-1111-1111-1111-111111111111)
INSERT INTO public.post_likes (post_id, user_id)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-222222222222'
);

-- Expected: Error - "new row violates row-level security policy"
```

#### Test 4.3: UNIQUE constraint prevents duplicate likes

**Requirement:** 10.1

```sql
-- As regular user (after Test 4.1)
INSERT INTO public.post_likes (post_id, user_id)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111'
);

-- Expected: Error - "duplicate key value violates unique constraint"
```

#### Test 4.4: User can delete their own like

**Requirement:** 10.1

```sql
-- As regular user
DELETE FROM public.post_likes
WHERE post_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND user_id = '11111111-1111-1111-1111-111111111111';

-- Expected: Success
```

### 5. Idempotency Keys Table Tests

#### Test 5.1: User can insert their own idempotency key

**Requirement:** 10.4

```sql
-- As regular user
INSERT INTO public.idempotency_keys (
  user_id, idempotency_key, request_path, request_method, expires_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'test-key-123',
  '/api/posts',
  'POST',
  now() + interval '24 hours'
);

-- Expected: Success
```

#### Test 5.2: User can only see their own idempotency keys

**Requirement:** 10.4

```sql
-- As regular user
SELECT * FROM public.idempotency_keys
WHERE user_id = '22222222-2222-2222-2222-222222222222';

-- Expected: Success but returns 0 rows (filtered by RLS)
```

#### Test 5.3: Service role can manage all idempotency keys

**Requirement:** 10.4

```sql
-- As service role
SET ROLE service_role;

SELECT * FROM public.idempotency_keys;

-- Expected: Success - returns all keys across all users

DELETE FROM public.idempotency_keys
WHERE expires_at < now();

-- Expected: Success - deletes expired keys for all users
```

### 6. Reports Table Tests

#### Test 6.1: User can report content

**Requirement:** 7.5

```sql
-- As regular user
INSERT INTO public.reports (reporter_id, content_type, content_id, reason)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'post',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Spam'
);

-- Expected: Success
```

#### Test 6.2: User can view their own reports

**Requirement:** 7.5

```sql
-- As regular user
SELECT * FROM public.reports
WHERE reporter_id = '11111111-1111-1111-1111-111111111111';

-- Expected: Success - returns user's own reports
```

#### Test 6.3: User cannot view other users' reports

**Requirement:** 10.2

```sql
-- As regular user (11111111-1111-1111-1111-111111111111)
SELECT * FROM public.reports
WHERE reporter_id = '22222222-2222-2222-2222-222222222222';

-- Expected: Success but returns 0 rows (filtered by RLS)
```

#### Test 6.4: Moderator can view all reports

**Requirement:** 7.8

```sql
-- As moderator
SELECT * FROM public.reports;

-- Expected: Success - returns all reports
```

#### Test 6.5: Moderator can update report status

**Requirement:** 7.8

```sql
-- As moderator
UPDATE public.reports
SET status = 'reviewed'
WHERE id = (SELECT id FROM public.reports LIMIT 1);

-- Expected: Success
```

### 7. Moderation Audit Table Tests

#### Test 7.1: Regular user cannot view audit logs

**Requirement:** 7.7

```sql
-- As regular user
SELECT * FROM public.moderation_audit;

-- Expected: Success but returns 0 rows (filtered by RLS)
```

#### Test 7.2: Moderator can view audit logs

**Requirement:** 7.7

```sql
-- As moderator
SELECT * FROM public.moderation_audit;

-- Expected: Success - returns all audit entries
```

#### Test 7.3: Moderator can create audit log entries

**Requirement:** 7.7

```sql
-- As moderator
INSERT INTO public.moderation_audit (
  moderator_id, content_type, content_id, action, reason
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'post',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'hide',
  'Inappropriate content'
);

-- Expected: Success
```

## Automated Testing Approach

For integration tests, use the Supabase JavaScript client with test users:

```typescript
import { createClient } from '@supabase/supabase-js';

describe('RLS Policies', () => {
  const regularUserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${REGULAR_USER_JWT}` } },
  });

  const moderatorClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${MODERATOR_JWT}` } },
  });

  it('should allow users to read their own posts', async () => {
    const { data, error } = await regularUserClient
      .from('posts')
      .select('*')
      .eq('user_id', REGULAR_USER_ID);

    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('should prevent users from setting moderation fields', async () => {
    const { error } = await regularUserClient
      .from('posts')
      .update({ hidden_at: new Date().toISOString() })
      .eq('id', TEST_POST_ID);

    expect(error).toBeDefined();
    expect(error.code).toBe('42501'); // RLS violation
  });

  it('should allow moderators to hide posts', async () => {
    const { error } = await moderatorClient
      .from('posts')
      .update({
        hidden_at: new Date().toISOString(),
        moderation_reason: 'Test moderation',
      })
      .eq('id', TEST_POST_ID);

    expect(error).toBeNull();
  });
});
```

## Checklist

Use this checklist to verify all RLS requirements:

- [ ] Regular user can read non-deleted posts
- [ ] Regular user can create/update/delete own posts
- [ ] Regular user cannot modify other users' posts
- [ ] Regular user cannot set hidden_at or moderation_reason
- [ ] Moderator can set hidden_at and moderation_reason on any post
- [ ] Moderator can view all reports
- [ ] User can only see own idempotency keys
- [ ] Service role can delete expired idempotency keys across all users
- [ ] Deleted and hidden posts are filtered from SELECT queries
- [ ] UNIQUE constraint enforced for post_likes (post_id, user_id)
- [ ] Users can only manage their own likes
- [ ] Reports can be created by any user
- [ ] Audit logs can only be viewed by moderators/admins

## Notes

- JWT claims can be set in tests using the Supabase client or by modifying the `request.jwt.claim` session variables in SQL
- Service role bypasses RLS entirely - use with caution
- All policies use the `authenticated` role, so anonymous users have no access
- App metadata roles are stored in `auth.users.raw_app_meta_data` and exposed via JWT
