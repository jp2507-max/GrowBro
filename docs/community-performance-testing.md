# Community Feed Performance Testing Guide

## Overview

This document outlines the performance testing strategy for the Community Feed feature to validate that it meets the requirements specified in the design document.

## Performance Requirements

### Latency Targets

- **P50 real-time latency**: < 1.5s (event received → UI updated)
- **P95 real-time latency**: < 3s
- **Mutation failure rate**: < 2% per day

### Load Targets

- **Feed capacity**: 1000+ posts without performance degradation
- **Comments per post**: Up to 50 paginated comments
- **Concurrent users**: Multiple devices viewing same content

## Test Scenarios

### 1. Large Dataset Rendering Performance

**Objective**: Verify FlashList handles 1000+ posts without frame drops

**Setup**:

```bash
# Create test database with 1000+ posts
pnpm run test:seed-community --posts=1000 --comments=50
```

**Test Steps**:

1. Launch app and navigate to community feed
2. Monitor FPS counter (should maintain 60fps)
3. Scroll through entire feed (5+ screen heights)
4. Check memory usage (should not exceed 300MB)
5. Verify no memory leaks after scrolling

**Success Criteria**:

- FPS stays above 55fps during scroll
- Memory usage stable (no continuous growth)
- No app crashes or freezes
- Initial load time < 2s

### 2. Real-Time Event Latency

**Objective**: Measure P50/P95 latency for real-time updates

**Setup**:

```typescript
// Add performance tracking in realtime manager
const trackEventLatency = (commitTimestamp: string) => {
  const eventTime = new Date(commitTimestamp).getTime();
  const uiUpdateTime = Date.now();
  const latency = uiUpdateTime - eventTime;

  Sentry.metrics.distribution('realtime.event.latency', latency, {
    unit: 'millisecond',
    tags: { event_type: 'post_update' },
  });
};
```

**Test Steps**:

1. Set up 2 devices viewing same feed
2. Device A: Like/unlike posts, add comments
3. Device B: Measure time until UI updates
4. Repeat 100+ times
5. Calculate P50 and P95 latencies

**Success Criteria**:

- P50 latency < 1.5s
- P95 latency < 3s
- No missed events
- Proper deduplication (no duplicate updates)

### 3. Offline Queue Performance

**Objective**: Test outbox behavior under heavy load

**Test Steps**:

1. Enable airplane mode
2. Perform 50+ actions (likes, comments)
3. Verify all actions queued
4. Restore connectivity
5. Monitor sync completion time

**Success Criteria**:

- All actions successfully queued
- Sync completes within 10s for 50 actions
- No duplicate actions executed
- Proper idempotency key handling
- Failure rate < 2%

### 4. Optimistic UI Performance

**Objective**: Verify immediate UI feedback with rollback capability

**Test Steps**:

1. Perform like/unlike rapidly (10 taps/second)
2. Monitor UI responsiveness
3. Simulate network failures
4. Verify proper rollback

**Success Criteria**:

- UI updates within 100ms of tap
- No UI flicker during updates
- Proper rollback on failure
- Toast notifications shown for errors

### 5. Memory Leak Detection

**Objective**: Ensure no memory leaks during extended usage

**Setup**:

```bash
# Run with memory profiling
pnpm run test:memory-profile
```

**Test Steps**:

1. Navigate to community feed
2. Perform 500+ actions:
   - Scroll through feed
   - Like/unlike posts
   - Open/close post details
   - Add comments
3. Monitor memory usage over 10 minutes
4. Check for retained objects

**Success Criteria**:

- Memory usage stabilizes (no continuous growth)
- Garbage collection reduces memory after actions
- No leaked listeners or subscriptions
- Proper cleanup on component unmount

### 6. Concurrent Modifications

**Objective**: Test conflict resolution with multiple devices

**Test Steps**:

1. Set up 3 devices with same user account
2. Simultaneously like same post from all devices
3. Verify final state is consistent
4. Check for duplicate likes

**Success Criteria**:

- No duplicate likes created
- Consistent final state across devices
- Proper UNIQUE constraint enforcement
- 409 conflicts resolved correctly

## Automated Performance Tests

### Jest Performance Tests

```typescript
// src/lib/community/__tests__/performance.test.ts

describe('Community Feed Performance', () => {
  it('should render 1000 posts without frame drops', async () => {
    const posts = generateMockPosts(1000);
    const { getByTestId } = render(<CommunityFeed posts={posts} />);

    // Monitor render time
    const startTime = performance.now();
    const list = getByTestId('community-screen');
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(2000);
  });

  it('should handle rapid like toggles without UI issues', async () => {
    const { getByTestId } = render(<PostCard post={mockPost} />);
    const likeButton = getByTestId('like-button-1');

    // Simulate 20 rapid taps
    for (let i = 0; i < 20; i++) {
      fireEvent.press(likeButton);
      await waitFor(() => expect(likeButton).toBeEnabled(), { timeout: 100 });
    }

    // Verify final state is consistent
    expect(likeButton).toHaveAccessibilityState({ checked: true });
  });

  it('should process outbox queue efficiently', async () => {
    const outbox = new OutboxProcessor();
    const actions = Array.from({ length: 50 }, (_, i) => ({
      id: `action-${i}`,
      op: 'LIKE',
      payload: { postId: `post-${i}` },
    }));

    const startTime = performance.now();
    await outbox.processQueue(actions);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(10000); // < 10s for 50 actions
  });
});
```

## Monitoring Setup

### Sentry Performance Monitoring

```typescript
// Add to src/lib/analytics/sentry.ts

Sentry.metrics.distribution('community.feed.load_time', loadTime, {
  unit: 'millisecond',
  tags: { posts_count: posts.length },
});

Sentry.metrics.distribution('community.realtime.latency', latency, {
  unit: 'millisecond',
  tags: { event_type: 'post_update' },
});

Sentry.metrics.increment('community.mutation.failure', 1, {
  tags: { operation: 'like_post', reason: error.message },
});

Sentry.metrics.gauge('community.outbox.depth', outboxSize, {
  tags: { status: 'pending' },
});
```

### Alert Thresholds

Create Sentry alerts for:

- P95 latency > 3s (hourly)
- Mutation failure rate > 2% (daily)
- Outbox depth > 50 items (immediate)
- Memory usage > 400MB (immediate)

## Load Testing with Artillery

```yaml
# artillery-community-feed.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 300
      arrivalRate: 10
      name: 'Ramp up'
    - duration: 600
      arrivalRate: 50
      name: 'Sustained load'

scenarios:
  - name: 'Community Feed Load Test'
    flow:
      - get:
          url: '/api/posts?limit=30'
      - think: 2
      - post:
          url: '/api/posts/{{ postId }}/likes'
          json:
            idempotency_key: '{{ $randomUUID }}'
      - think: 1
      - post:
          url: '/api/posts/{{ postId }}/comments'
          json:
            body: 'Load test comment'
            idempotency_key: '{{ $randomUUID }}'
```

Run load test:

```bash
artillery run artillery-community-feed.yml --output load-test-results.json
artillery report load-test-results.json
```

## Test Execution Schedule

- **Pre-commit**: Unit performance tests (< 30s)
- **Pre-release**: Full E2E suite + load tests (< 15min)
- **Weekly**: Extended load testing (1hr+)
- **Production**: Continuous monitoring with Sentry

## Reporting

Generate performance report:

```bash
pnpm run test:performance --report
```

Report includes:

- P50/P95/P99 latencies
- Memory usage statistics
- FPS measurements
- Mutation success rates
- Outbox queue metrics
