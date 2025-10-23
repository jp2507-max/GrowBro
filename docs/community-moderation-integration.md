# Community Moderation Integration Guide

## Overview

This document describes how the DSA-compliant moderation system integrates with existing GrowBro community features.

## Integration Points

### 1. Content Reporting (Requirement 1.1)

#### Post Reporting

Posts can be reported using the `ModeratedPostCard` component, which wraps the existing `PostCard` with reporting functionality:

```tsx
import { ModeratedPostCard } from '@/components/community';

<ModeratedPostCard
  post={post}
  isAgeVerified={isAgeVerified}
  onDelete={handleDelete}
  onVerifyPress={handleVerifyPress}
/>;
```

Features:

- Report button visible to all authenticated users
- DSA Art. 16 compliant reporting modal
- Two-track system (illegal vs. policy violation)
- Automatic content locator generation

#### Comment Reporting

Comments can be reported using the `ModeratedCommentItem` component:

```tsx
import { ModeratedCommentItem } from '@/components/community';

<ModeratedCommentItem
  comment={comment}
  status="processed"
  onRetry={handleRetry}
  onCancel={handleCancel}
/>;
```

Features:

- Inline report button for processed comments
- Same DSA-compliant reporting flow as posts
- Prevents reporting of pending/failed comments

### 2. Age-Gating Integration (Requirement 8.7)

#### Authentication Flow Integration

Age verification is automatically integrated with the authentication flow using the `useIntegratedAgeVerification` hook:

```tsx
import { useIntegratedAgeVerification } from '@/lib/moderation/use-integrated-age-verification';

const {
  isAgeVerified,
  isLoading,
  requiresVerification,
  verifyAge,
  checkVerificationStatus,
} = useIntegratedAgeVerification();
```

Features:

- Automatic age verification status check on authentication
- Seamless integration with existing auth system
- Privacy-preserving verification (no raw ID storage)
- Reusable verification tokens

#### Content Filtering

Age-restricted content is automatically filtered in feeds:

```tsx
import { IntegratedFeed } from '@/components/community';

<IntegratedFeed
  posts={posts}
  isLoading={isLoading}
  onRefresh={handleRefresh}
  onEndReached={handleLoadMore}
  onDelete={handleDelete}
/>;
```

Features:

- Automatic age-gating enforcement
- Placeholder for age-restricted content
- Verification prompt for unverified users
- Safer defaults for minors

### 3. Moderation Decision Application

#### Content Visibility Control

Moderation decisions automatically affect content visibility:

```tsx
import { communityIntegration } from '@/lib/moderation/community-integration';

// Check if content should be visible
const visibility = await communityIntegration.checkContentVisibility(
  contentId,
  'post'
);

if (!visibility.visible) {
  // Show appropriate message based on reason
  console.log(visibility.reason); // 'removed', 'quarantined', 'age_restricted', 'geo_blocked'
  console.log(visibility.message); // User-friendly message
}
```

Features:

- Automatic visibility checks for all content
- Multiple restriction types (removal, quarantine, age, geo)
- Appeal information for removed content
- Graceful degradation on errors

#### Applying Moderation Decisions

Moderation decisions are applied through the integration service:

```tsx
import { communityIntegration } from '@/lib/moderation/community-integration';

await communityIntegration.applyModerationDecision(decision, contentId, 'post');
```

Features:

- Updates content moderation status
- Applies geo-restrictions if specified
- Flags age-restricted content
- Integrates with audit logging

### 4. Geo-Restriction Integration (Requirement 9.4)

#### Location Detection

User location is automatically detected using IP geolocation:

```tsx
import { useIntegratedGeoRestrictions } from '@/lib/moderation/use-integrated-geo-restrictions';

const {
  userCountry,
  userRegion,
  isLoading,
  checkContentAvailability,
  refreshLocation,
} = useIntegratedGeoRestrictions();
```

Features:

- Privacy-first IP-based geolocation (default)
- No GPS tracking without explicit consent
- Automatic content availability checks
- Location refresh capability

#### Content Filtering

Geo-restricted content is automatically filtered:

```tsx
// IntegratedFeed automatically filters geo-restricted content
<IntegratedFeed posts={posts} />
```

Features:

- Automatic geo-restriction enforcement
- User notification of blocked content count
- Regional availability information
- SoR integration for geo-blocks

## Component Architecture

### Component Hierarchy

```
IntegratedFeed
├── ModeratedPostCard
│   ├── AgeGatedPostCard
│   │   ├── PostCard (existing)
│   │   └── AgeRestrictedContentPlaceholder
│   └── ReportContentModal
└── CommunityFooterLoader
```

### Service Layer

```
CommunityIntegrationService
├── ContentVisibilityStatus
├── ModeratedPost/Comment
├── AgeVerificationService
├── GeoLocationService
└── ContentAgeGatingEngine
```

## Usage Examples

### Example 1: Basic Feed with Moderation

```tsx
import { IntegratedFeed } from '@/components/community';
import { usePosts } from '@/api/community';

function CommunityFeed() {
  const { data, isLoading, refetch, fetchNextPage } = usePosts();

  return (
    <IntegratedFeed
      posts={data?.pages.flatMap((p) => p.posts) ?? []}
      isLoading={isLoading}
      onRefresh={refetch}
      onEndReached={fetchNextPage}
    />
  );
}
```

### Example 2: Custom Post Card with Reporting

```tsx
import { ModeratedPostCard } from '@/components/community';
import { useIntegratedAgeVerification } from '@/lib/moderation/use-integrated-age-verification';

function CustomPostCard({ post }) {
  const { isAgeVerified, verifyAge } = useIntegratedAgeVerification();

  return (
    <ModeratedPostCard
      post={post}
      isAgeVerified={isAgeVerified}
      onVerifyPress={verifyAge}
    />
  );
}
```

### Example 3: Manual Content Visibility Check

```tsx
import { communityIntegration } from '@/lib/moderation/community-integration';

async function checkPostVisibility(postId: string) {
  const visibility = await communityIntegration.checkContentVisibility(
    postId,
    'post'
  );

  if (!visibility.visible) {
    switch (visibility.reason) {
      case 'removed':
        return 'This post has been removed';
      case 'age_restricted':
        return 'Age verification required';
      case 'geo_blocked':
        return 'Not available in your region';
      default:
        return 'Content unavailable';
    }
  }

  return 'Content visible';
}
```

## Database Schema Updates

### Posts Table

```sql
ALTER TABLE posts ADD COLUMN moderation_status TEXT DEFAULT 'active';
ALTER TABLE posts ADD COLUMN is_age_restricted BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN geo_restrictions TEXT[];
ALTER TABLE posts ADD COLUMN moderation_decision_id UUID;
ALTER TABLE posts ADD COLUMN can_appeal BOOLEAN DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN appeal_deadline TIMESTAMPTZ;
```

### Comments Table

```sql
ALTER TABLE comments ADD COLUMN moderation_status TEXT DEFAULT 'active';
ALTER TABLE comments ADD COLUMN moderation_decision_id UUID;
ALTER TABLE comments ADD COLUMN can_appeal BOOLEAN DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN appeal_deadline TIMESTAMPTZ;
```

## API Integration

### Reporting Endpoint

```typescript
POST /api/moderation/reports
{
  "contentId": "post-123",
  "contentType": "post",
  "reportType": "illegal" | "policy_violation",
  "jurisdiction": "DE", // Required for illegal reports
  "legalReference": "DE StGB §130", // Required for illegal reports
  "explanation": "Detailed explanation...",
  "reporterEmail": "reporter@example.com",
  "goodFaithDeclaration": true,
  "contentLocator": "growbro://feed/post-123"
}
```

### Content Visibility Endpoint

```typescript
GET /api/moderation/content/:contentId/visibility
Response: {
  "visible": boolean,
  "reason": "removed" | "quarantined" | "age_restricted" | "geo_blocked",
  "message": string,
  "canAppeal": boolean,
  "appealDeadline": string
}
```

## Testing

### Unit Tests

```typescript
// Test age-gating integration
describe('useIntegratedAgeVerification', () => {
  it('should check age verification status on mount', async () => {
    const { result } = renderHook(() => useIntegratedAgeVerification());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAgeVerified).toBeDefined();
  });
});

// Test geo-restrictions integration
describe('useIntegratedGeoRestrictions', () => {
  it('should detect user location on mount', async () => {
    const { result } = renderHook(() => useIntegratedGeoRestrictions());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.userCountry).toBeDefined();
  });
});
```

### Integration Tests

```typescript
// Test full reporting flow
describe('Content Reporting Integration', () => {
  it('should submit report and update content status', async () => {
    const { user } = setup(<ModeratedPostCard post={mockPost} />);

    // Open report modal
    await user.press(screen.getByTestId('report-button'));

    // Fill form
    await user.type(screen.getByTestId('explanation-input'), 'Test report');
    await user.press(screen.getByTestId('good-faith-checkbox'));

    // Submit
    await user.press(screen.getByTestId('report-submit-btn'));

    // Verify success
    expect(screen.getByText(/report submitted/i)).toBeOnTheScreen();
  });
});
```

## Performance Considerations

### Optimization Strategies

1. **Lazy Loading**: Report modals are only rendered when needed
2. **Memoization**: Content visibility checks are cached
3. **Batch Processing**: Multiple content items checked in parallel
4. **Graceful Degradation**: Errors don't block content display

### Caching

```typescript
// Content visibility results are cached for 5 minutes
const VISIBILITY_CACHE_TTL = 5 * 60 * 1000;

// Location detection results are cached for 1 hour
const LOCATION_CACHE_TTL = 60 * 60 * 1000;
```

## Privacy & Compliance

### Data Minimization

- Only necessary data collected for reporting
- IP-based geolocation preferred over GPS
- No device fingerprinting without consent
- Age verification without raw ID storage

### GDPR Compliance

- User consent for GPS location
- Data retention policies enforced
- Right to access/delete supported
- Privacy notices displayed

### DSA Compliance

- Art. 16: Notice-and-Action mandatory fields
- Art. 17: Statement of Reasons generation
- Art. 20: Internal appeals process
- Art. 28: Age verification for minors

## Troubleshooting

### Common Issues

1. **Reports not submitting**
   - Check authentication status
   - Verify network connectivity
   - Check for manifestly unfounded reporter status

2. **Age-gating not working**
   - Verify age verification service is running
   - Check database schema for age_verification_tokens table
   - Ensure user is authenticated

3. **Geo-restrictions not applied**
   - Verify IP geolocation service is accessible
   - Check geo_restrictions table exists
   - Ensure location detection is enabled

### Debug Mode

Enable debug logging:

```typescript
// In development
localStorage.setItem('DEBUG_MODERATION', 'true');

// Logs will show:
// - Content visibility checks
// - Age verification status
// - Geo-restriction decisions
// - Report submissions
```

## Migration Guide

### Updating Existing Feeds

Replace existing `PostCard` usage with `ModeratedPostCard`:

```diff
- import { PostCard } from '@/components/community';
+ import { ModeratedPostCard } from '@/components/community';
+ import { useIntegratedAgeVerification } from '@/lib/moderation/use-integrated-age-verification';

function Feed() {
+  const { isAgeVerified, verifyAge } = useIntegratedAgeVerification();

  return (
-    <PostCard post={post} />
+    <ModeratedPostCard
+      post={post}
+      isAgeVerified={isAgeVerified}
+      onVerifyPress={verifyAge}
+    />
  );
}
```

### Updating Comment Lists

Replace `CommentItem` with `ModeratedCommentItem`:

```diff
- import { CommentItem } from '@/components/community';
+ import { ModeratedCommentItem } from '@/components/community';

- <CommentItem comment={comment} />
+ <ModeratedCommentItem comment={comment} />
```

## Future Enhancements

1. **Real-time Moderation Updates**: WebSocket integration for live moderation status
2. **Advanced Filtering**: User-customizable content filters
3. **Moderation Analytics**: Dashboard for moderation metrics
4. **AI-Assisted Reporting**: Automatic violation detection
5. **Multi-language Support**: Localized reporting forms
