# Community Feed Deployment Checklist

**Feature**: Community Feed Improvements (Spec 17)  
**Target Release**: TBD  
**Deployment Type**: Phased Rollout

---

## Pre-Deployment Checklist

### 1. Code Quality & Testing

- [ ] All TypeScript type errors resolved (`pnpm tsc --noEmit`)
- [ ] ESLint passes with no errors (`pnpm lint`)
- [ ] All unit tests pass (`pnpm test`)
- [ ] E2E test suite passes (`.maestro/community/community-test-suite.yaml`)
- [ ] Performance tests meet requirements (P50 < 1.5s, P95 < 3s)
- [ ] Load testing completed with 1000+ posts
- [ ] Memory leak testing completed (no leaks detected)
- [ ] Security review completed (RLS policies validated)

### 2. Database Migrations

#### Migration Order (MUST follow this sequence)

1. **Migration 1**: Add moderation columns to `posts` table

   ```sql
   -- 20250920000001_add_posts_moderation_columns.sql
   ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMPTZ;
   ALTER TABLE posts ADD COLUMN hidden_at TIMESTAMPTZ;
   ALTER TABLE posts ADD COLUMN moderation_reason TEXT;
   ALTER TABLE posts ADD COLUMN undo_expires_at TIMESTAMPTZ;
   ```

   - [ ] Applied to staging
   - [ ] Applied to production
   - [ ] Verified schema changes

2. **Migration 2**: Add columns to `post_comments` table

   ```sql
   -- 20250920000002_add_post_comments_columns.sql
   ALTER TABLE post_comments ADD COLUMN hidden_at TIMESTAMPTZ;
   ALTER TABLE post_comments ADD COLUMN undo_expires_at TIMESTAMPTZ;
   ```

   - [ ] Applied to staging
   - [ ] Applied to production
   - [ ] Verified schema changes

3. **Migration 3**: Create `post_likes` table

   ```sql
   -- 20250920000003_create_post_likes.sql
   CREATE TABLE post_likes (...);
   -- Includes UNIQUE(post_id, user_id) constraint
   ```

   - [ ] Applied to staging
   - [ ] Applied to production
   - [ ] Verified UNIQUE constraint

4. **Migration 4**: Create `reports` and `moderation_audit` tables

   ```sql
   -- 20250920000004_create_moderation_tables.sql
   CREATE TABLE reports (...);
   CREATE TABLE moderation_audit (...);
   ```

   - [ ] Applied to staging
   - [ ] Applied to production
   - [ ] Verified tables created

5. **Migration 5**: Create `idempotency_keys` table

   ```sql
   -- 20250920000005_create_idempotency_keys.sql
   CREATE TABLE idempotency_keys (...);
   ```

   - [ ] Applied to staging
   - [ ] Applied to production
   - [ ] Verified TTL logic

6. **Migration 6**: Add performance indexes

   ```sql
   -- 20250920000006_add_performance_indexes.sql
   CREATE INDEX idx_posts_visible ON posts (created_at DESC)
     WHERE deleted_at IS NULL AND hidden_at IS NULL;
   -- ... other indexes
   ```

   - [ ] Applied to staging
   - [ ] Applied to production
   - [ ] Verified query performance improvement

7. **Migration 7**: Create RLS policies

   ```sql
   -- 20250920000007_create_rls_policies.sql
   -- Policies for posts, post_comments, post_likes, idempotency_keys
   ```

   - [ ] Applied to staging
   - [ ] Applied to production
   - [ ] Verified access control (integration tests)

8. **Migration 8**: Create `moddatetime` triggers

   ```sql
   -- 20250920000008_create_moddatetime_triggers.sql
   CREATE TRIGGER tg_posts_updated_at ...
   CREATE TRIGGER tg_comments_updated_at ...
   ```

   - [ ] Applied to staging
   - [ ] Applied to production
   - [ ] Verified `updated_at` auto-updates

9. **Migration 9**: Enable realtime replication

   ```sql
   -- 20250920000009_enable_realtime.sql
   ALTER PUBLICATION supabase_realtime ADD TABLE posts, post_comments, post_likes;
   ```

   - [ ] Applied to staging
   - [ ] Applied to production
   - [ ] Verified realtime events flow

10. **Migration 10**: Create notification triggers

    ```sql
    -- 20250930000001_add_community_notification_triggers.sql
    CREATE FUNCTION notify_post_reply() ...
    CREATE TRIGGER tg_notify_post_reply ...
    ```

    - [ ] Applied to staging
    - [ ] Applied to production
    - [ ] Verified notifications sent

#### Migration Verification

- [ ] Run migration validation queries

  ```sql
  -- Verify all tables exist
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('posts', 'post_comments', 'post_likes', 'reports',
                     'moderation_audit', 'idempotency_keys');

  -- Verify indexes
  SELECT indexname FROM pg_indexes WHERE schemaname = 'public';

  -- Verify RLS is enabled
  SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
  ```

- [ ] Test RLS policies with different user roles
- [ ] Verify no breaking changes to existing queries
- [ ] Check for migration performance impact (< 1s per migration)

### 3. Edge Functions Deployment

Deploy in order:

1. [ ] `_shared/` utility functions
2. [ ] `like-post` - POST /like-post
3. [ ] `unlike-post` - DELETE /unlike-post
4. [ ] `create-comment` - POST /create-comment
5. [ ] `delete-post` - DELETE /delete-post
6. [ ] `undo-delete-post` - POST /undo-delete-post
7. [ ] `delete-comment` - DELETE /delete-comment
8. [ ] `undo-delete-comment` - POST /undo-delete-comment
9. [ ] `send-push-notification` - Called by DB triggers
10. [ ] `cleanup-idempotency-keys` - Cron job (every 6 hours)
11. [ ] `cleanup-expired-undo` - Cron job (every hour)

#### Edge Function Verification

- [ ] All functions deployed successfully
- [ ] Environment variables set (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, etc.)
- [ ] Cron jobs scheduled correctly
- [ ] Test each endpoint with sample requests
- [ ] Verify idempotency key handling
- [ ] Check error handling and logging

### 4. Frontend Build & Deploy

- [ ] Update environment variables

  ```bash
  SUPABASE_URL=https://mgbekkpswaizzthgefbc.supabase.co
  SUPABASE_ANON_KEY=<key>
  ```

- [ ] Build mobile app

  ```bash
  pnpm run build:preview
  ```

- [ ] Verify build artifacts
  - [ ] iOS build successful
  - [ ] Android build successful
  - [ ] No build errors or warnings

- [ ] Submit to app stores (if required)
  - [ ] iOS TestFlight build uploaded
  - [ ] Android internal testing track uploaded

### 5. Monitoring & Observability

#### Sentry Configuration

- [ ] Create Sentry project for community feature
- [ ] Configure performance monitoring

  ```typescript
  Sentry.metrics.distribution('community.feed.load_time', ...);
  Sentry.metrics.distribution('community.realtime.latency', ...);
  Sentry.metrics.increment('community.mutation.failure', ...);
  Sentry.metrics.gauge('community.outbox.depth', ...);
  ```

- [ ] Set up alert rules:
  - [ ] P95 latency > 3s (hourly check)
  - [ ] Mutation failure rate > 2% (daily check)
  - [ ] Outbox depth > 50 (immediate alert)
  - [ ] Memory usage > 400MB (immediate alert)
  - [ ] Edge Function errors > 5% (15min window)

#### Supabase Monitoring

- [ ] Enable query performance insights
- [ ] Set up table size alerts (idempotency_keys table)
- [ ] Monitor realtime connection count
- [ ] Track Edge Function invocation counts

#### Custom Dashboards

- [ ] Create Grafana/Sentry dashboard with:
  - Feed load time (P50, P95, P99)
  - Real-time event latency
  - Mutation success/failure rates
  - Outbox queue depth over time
  - User engagement metrics (likes/comments per hour)

### 6. Feature Flags (Optional)

If using feature flags:

- [ ] Create `community_feed_enabled` flag (default: `false`)
- [ ] Create `community_realtime_enabled` flag (default: `false`)
- [ ] Create `community_notifications_enabled` flag (default: `false`)

- [ ] Test flag toggling in staging
- [ ] Verify graceful degradation when flags are off

---

## Deployment Procedure

### Phase 1: Staging Deployment (Day 1)

1. [ ] Apply all database migrations to staging
2. [ ] Deploy Edge Functions to staging
3. [ ] Deploy mobile app to staging environment
4. [ ] Run full E2E test suite
5. [ ] Perform manual QA testing
   - [ ] Create posts
   - [ ] Like/unlike posts
   - [ ] Add comments
   - [ ] Test offline mode
   - [ ] Test delete + undo
   - [ ] Navigate to profiles
6. [ ] Load test with 1000+ posts
7. [ ] Monitor for 24 hours

**Go/No-Go Decision Point**: All tests pass + no critical errors

### Phase 2: Production Migration (Day 2-3)

**Before migration window:**

- [ ] Schedule maintenance window (low-traffic period)
- [ ] Notify users of potential downtime
- [ ] Prepare rollback scripts
- [ ] Backup production database

**During migration (estimated 15-30 minutes):**

1. [ ] Begin maintenance mode (optional)
2. [ ] Run database migrations (follow exact order above)
3. [ ] Deploy Edge Functions
4. [ ] Verify migrations applied successfully
5. [ ] Run smoke tests
6. [ ] End maintenance mode

**Post-migration:**

- [ ] Monitor error rates for 2 hours
- [ ] Check migration logs
- [ ] Verify no breaking changes to existing features
- [ ] Test basic community operations manually

### Phase 3: Phased Mobile App Rollout (Day 4-10)

#### 10% Rollout (Days 4-5)

- [ ] Release to 10% of iOS users (TestFlight or App Store)
- [ ] Release to 10% of Android users (Internal Testing)
- [ ] Monitor metrics:
  - [ ] Crash rate < 0.5%
  - [ ] P95 latency < 3s
  - [ ] Mutation failure rate < 2%
- [ ] Collect user feedback
- [ ] Address critical issues

**Go/No-Go Decision Point**: Metrics within thresholds + no P0 bugs

#### 50% Rollout (Days 6-7)

- [ ] Increase to 50% of users
- [ ] Monitor same metrics
- [ ] Check outbox queue depth
- [ ] Verify real-time performance at scale

**Go/No-Go Decision Point**: Metrics stable + no new critical issues

#### 100% Rollout (Days 8-10)

- [ ] Release to all users
- [ ] Continue monitoring for 48 hours
- [ ] Address any edge cases
- [ ] Collect feedback and create backlog items

---

## Post-Deployment Verification

### Smoke Tests

Execute within 1 hour of production deployment:

1. **Feed Loading**
   - [ ] Open community tab
   - [ ] Verify posts load within 2 seconds
   - [ ] Check pagination works

2. **Interactions**
   - [ ] Like a post (verify count updates)
   - [ ] Unlike a post (verify count updates)
   - [ ] Add a comment (verify appears immediately)

3. **Real-Time**
   - [ ] Open post on 2 devices
   - [ ] Like from device A
   - [ ] Verify update appears on device B within 3s

4. **Offline**
   - [ ] Enable airplane mode
   - [ ] Like a post (verify queued)
   - [ ] Disable airplane mode
   - [ ] Verify action syncs automatically

5. **Delete + Undo**
   - [ ] Create a test post
   - [ ] Delete post
   - [ ] Verify undo snackbar appears
   - [ ] Tap undo
   - [ ] Verify post restored

### Metrics to Monitor (First 48 Hours)

#### Critical Metrics (Alert Immediately)

- [ ] App crash rate < 0.5%
- [ ] Edge Function error rate < 5%
- [ ] P95 latency < 3s
- [ ] Mutation failure rate < 2%

#### Important Metrics (Review Daily)

- [ ] Real-time connection success rate > 95%
- [ ] Outbox queue depth < 50
- [ ] Comment creation success rate > 98%
- [ ] Like operation success rate > 99%

#### Performance Metrics

- [ ] Feed load time P50 < 1.5s
- [ ] Feed load time P95 < 3s
- [ ] Memory usage < 300MB
- [ ] No memory leaks detected

### Health Checks

Run automated health checks every 15 minutes:

```bash
# Edge Function health
curl https://mgbekkpswaizzthgefbc.supabase.co/functions/v1/like-post -H "Authorization: Bearer <key>"
# Expected: 400 (missing idempotency key)

# Database health
psql -c "SELECT COUNT(*) FROM posts WHERE created_at > now() - interval '1 hour';"

# Realtime health
curl https://mgbekkpswaizzthgefbc.supabase.co/realtime/v1/websocket
# Expected: 101 Switching Protocols
```

---

## Rollback Procedures

### Severity Levels

**P0 - Critical (Immediate Rollback)**

- App crashes > 2%
- Data loss or corruption
- Complete feature failure

**P1 - High (Rollback within 2 hours)**

- Mutation failure rate > 5%
- P95 latency > 5s
- Real-time completely broken

**P2 - Medium (Fix Forward)**

- Minor UI issues
- Non-critical error rates elevated
- Performance slightly degraded

### Rollback Steps

#### Mobile App Rollback

1. [ ] Halt phased rollout in app store consoles
2. [ ] Revert to previous app version

   ```bash
   # iOS
   eas submit --platform ios --id <previous-build-id>

   # Android
   eas submit --platform android --id <previous-build-id>
   ```

3. [ ] Notify users of rollback
4. [ ] Monitor crash rates return to baseline

#### Edge Function Rollback

1. [ ] Identify failing function(s)
2. [ ] Redeploy previous version from git
   ```bash
   git checkout <previous-commit>
   supabase functions deploy <function-name>
   ```
3. [ ] Verify error rates drop
4. [ ] Update monitoring alerts

#### Database Rollback (USE WITH EXTREME CAUTION)

**Only if critical data corruption detected:**

1. [ ] Stop all Edge Functions
2. [ ] Enable maintenance mode
3. [ ] Restore from backup
   ```bash
   pg_restore -d production -C <backup-file>
   ```
4. [ ] Reapply safe migrations only
5. [ ] Verify data integrity
6. [ ] Resume operations

**Warning**: Database rollback will lose recent user data. Only use as last resort.

---

## Communication Plan

### Internal Communication

**Before Deployment:**

- [ ] Notify engineering team 48h in advance
- [ ] Brief customer support on new features
- [ ] Prepare FAQ for support team

**During Deployment:**

- [ ] Post updates in #deployments channel
- [ ] Update status page if downtime expected

**After Deployment:**

- [ ] Send deployment summary to stakeholders
- [ ] Schedule retrospective meeting

### User Communication

**Announcement:**

- [ ] In-app banner: "New Community Features Available!"
- [ ] Email newsletter highlighting improvements
- [ ] Social media posts showcasing features

**Support:**

- [ ] Update help center articles
- [ ] Prepare support team with common issues
- [ ] Monitor support tickets for patterns

---

## Success Criteria

Deployment is considered successful when:

- [ ] All migrations applied without errors
- [ ] All Edge Functions deployed and operational
- [ ] 100% of users on new app version
- [ ] Crash rate < 0.5% (no increase from baseline)
- [ ] P95 latency < 3s consistently
- [ ] Mutation failure rate < 2%
- [ ] No P0 or P1 bugs reported
- [ ] User feedback positive (> 80% sentiment)
- [ ] No rollbacks required

---

## Post-Deployment Tasks

### Week 1

- [ ] Monitor metrics daily
- [ ] Address any P2 bugs
- [ ] Collect user feedback
- [ ] Optimize slow queries if any
- [ ] Review and tune alert thresholds

### Week 2-4

- [ ] Analyze user engagement metrics
- [ ] Identify performance optimization opportunities
- [ ] Plan follow-up improvements based on feedback
- [ ] Update documentation based on learnings
- [ ] Conduct deployment retrospective

### Ongoing

- [ ] Weekly review of error logs
- [ ] Monthly performance review
- [ ] Quarterly feature usage analysis
- [ ] Continuous monitoring of KPIs

---

## Sign-Off

**Deployment Lead**: **\*\***\_\_\_\_**\*\*** Date: \***\*\_\_\*\***  
**Database Admin**: **\*\*\*\***\_**\*\*\*\*** Date: \***\*\_\_\*\***  
**QA Lead**: ****\*\*****\_\_\_****\*\***** Date: \***\*\_\_\*\***  
**Product Owner**: **\*\*\*\***\_**\*\*\*\*** Date: \***\*\_\_\*\***

---

## Appendix

### Useful Commands

```bash
# Check migration status
supabase migration list

# Apply specific migration
supabase migration apply --file 20250920000001_add_posts_moderation_columns.sql

# Deploy Edge Function
supabase functions deploy like-post

# Run E2E tests
maestro test .maestro/community/community-test-suite.yaml

# Check Sentry errors
sentry-cli issues list --project=growbro

# Monitor database performance
psql -c "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"
```

### Emergency Contacts

- **On-Call Engineer**: [Slack @engineer]
- **Database Admin**: [Slack @dba]
- **Product Owner**: [Slack @product]
- **Supabase Support**: support@supabase.com
