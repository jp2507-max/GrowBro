# User Profile & Settings Developer Runbook

**Version:** 1.0  
**Last Updated:** November 2025  
**Maintainer:** GrowBro Engineering Team

## Table of Contents

1. [Overview](#overview)
2. [Support Form Rate Limits](#support-form-rate-limits)
3. [Incident Response](#incident-response)
4. [Legal Version Management](#legal-version-management)
5. [Common Operations](#common-operations)
6. [Troubleshooting](#troubleshooting)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Escalation Procedures](#escalation-procedures)

---

## Overview

This runbook provides operational guidance for the User Profile & Settings feature, covering:

- Bug report and feedback submission rate limiting
- Incident response for support tickets
- Legal document version management and re-acceptance flows
- Common operational tasks and troubleshooting

**Related Documentation:**

- Design Doc: `.kiro/specs/24. user-profile-settings-shell/design.md`
- Requirements: `.kiro/specs/24. user-profile-settings-shell/requirements.md`
- Database Schema: `supabase/migrations/[timestamp]_settings_tables.sql`

---

## Support Form Rate Limits

### Bug Report Rate Limiting

**Configuration:**

```typescript
// supabase/functions/bug-reports/index.ts
const RATE_LIMITS = {
  perUser: {
    window: 3600, // 1 hour (in seconds)
    max: 5, // Maximum 5 reports per hour per user
  },
  perIP: {
    window: 3600, // 1 hour
    max: 10, // Maximum 10 reports per hour per IP
  },
  global: {
    window: 60, // 1 minute
    max: 100, // Maximum 100 reports per minute globally
  },
};
```

**Storage:**

Rate limit counters are stored in Redis with TTL:

- Key format: `rate:bug-reports:{userId}` or `rate:bug-reports:ip:{ipAddress}`
- Expires automatically after window period

**Responses:**

```json
// 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "Too many bug reports. Please try again later.",
  "retryAfter": 1800, // seconds until retry allowed
  "limit": 5,
  "window": 3600
}
```

### Feedback Rate Limiting

**Configuration:**

```typescript
// supabase/functions/feedback/index.ts
const RATE_LIMITS = {
  perUser: {
    window: 86400, // 24 hours
    max: 3, // Maximum 3 feedback submissions per day per user
  },
  perIP: {
    window: 86400,
    max: 5, // Maximum 5 feedback submissions per day per IP
  },
};
```

### Adjusting Rate Limits

**When to Adjust:**

- During beta launches (increase limits temporarily)
- If experiencing spam attacks (decrease limits)
- For VIP/premium users (whitelist or increase limits)

**How to Adjust:**

1. **Update Edge Function Configuration:**

   ```bash
   # Edit the rate limit constants
   nano supabase/functions/bug-reports/index.ts

   # Deploy the updated function
   supabase functions deploy bug-reports
   ```

2. **Whitelist Users (Bypass Rate Limits):**

   ```sql
   -- Add user to whitelist table
   INSERT INTO rate_limit_whitelist (user_id, reason, expires_at)
   VALUES ('uuid-here', 'Beta tester', NOW() + INTERVAL '30 days');
   ```

3. **Clear Rate Limit for User (Emergency):**

   ```bash
   # Connect to Redis
   redis-cli

   # Delete rate limit key
   DEL rate:bug-reports:user:UUID_HERE
   DEL rate:feedback:user:UUID_HERE
   ```

### Monitoring Rate Limits

**Metrics to Track:**

- Number of rate limit rejections per hour
- Users hitting rate limits frequently
- Spike in submissions (potential spam)

**Query Rate Limit Hits:**

```sql
-- Find users who hit rate limits today
SELECT
  user_id,
  COUNT(*) as attempts,
  MAX(created_at) as last_attempt
FROM rate_limit_events
WHERE
  created_at >= CURRENT_DATE
  AND exceeded = true
GROUP BY user_id
HAVING COUNT(*) > 5
ORDER BY attempts DESC;
```

---

## Incident Response

### Bug Report Ticket Tracing

**Ticket ID Format:**

```
BUG-{timestamp}-{short-uuid}
Example: BUG-1730764800-a3f5c9
```

**Finding a Ticket in Database:**

```sql
-- By ticket ID
SELECT * FROM bug_reports
WHERE ticket_id = 'BUG-1730764800-a3f5c9';

-- By user and date range
SELECT
  ticket_id,
  title,
  created_at,
  status
FROM bug_reports
WHERE
  user_id = 'uuid-here'
  AND created_at >= '2025-11-01'
ORDER BY created_at DESC;

-- Recent unresolved tickets
SELECT
  ticket_id,
  user_id,
  title,
  severity,
  created_at
FROM bug_reports
WHERE
  status IN ('new', 'in_progress')
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'major' THEN 2
    WHEN 'minor' THEN 3
    ELSE 4
  END,
  created_at DESC;
```

**Retrieving Full Ticket Details:**

```sql
SELECT
  b.ticket_id,
  b.title,
  b.description,
  b.category,
  b.severity,
  b.status,
  b.created_at,
  b.updated_at,
  b.diagnostics,
  b.screenshot_url,
  b.sentry_event_id,
  p.display_name as reporter_name,
  p.email as reporter_email
FROM bug_reports b
LEFT JOIN profiles p ON b.user_id = p.user_id
WHERE b.ticket_id = 'BUG-1730764800-a3f5c9';
```

**Linking to Sentry:**

If `sentry_event_id` is present:

1. **Open Sentry Dashboard:** `https://sentry.io/organizations/growbro/issues/`
2. **Search by Event ID:** Use the filter `id:SENTRY_EVENT_ID_HERE`
3. **Correlate with Bug Report:**
   - Check timestamp match
   - Verify user ID match
   - Review stack trace and breadcrumbs

### Feedback Response Workflow

**Priority Levels:**

1. **Critical (Feature Request - Breaking Issue):**
   - User reports feature completely broken
   - Respond within 4 hours
   - Create Jira ticket immediately

2. **High (Improvement - Major Pain Point):**
   - User reports significant UX issue
   - Respond within 24 hours
   - Add to product backlog review

3. **Medium (Feature Request - Nice to Have):**
   - User suggests new feature or enhancement
   - Respond within 3 business days
   - Add to feature request log

4. **Low (Compliment / General Feedback):**
   - User provides positive feedback
   - Respond within 1 week
   - Log for team morale

**Responding to Feedback:**

```sql
-- Update feedback status and add response
UPDATE feedback
SET
  status = 'responded',
  response = 'Thank you for your feedback! We have added this to our product backlog.',
  responded_at = NOW(),
  responded_by = 'support-team-id'
WHERE id = 'feedback-id-here';

-- Optionally send email notification
INSERT INTO email_queue (
  to_email,
  template,
  data,
  scheduled_for
) VALUES (
  (SELECT email FROM profiles WHERE user_id = 'user-id-here'),
  'feedback_response',
  jsonb_build_object(
    'feedback_id', 'feedback-id-here',
    'response', 'Thank you for your feedback...'
  ),
  NOW()
);
```

### Creating Internal Issues from Tickets

**From Bug Report to Jira:**

```bash
# Script: scripts/bug-to-jira.sh
./scripts/bug-to-jira.sh --ticket-id BUG-1730764800-a3f5c9 --project GROW --type Bug

# This creates a Jira issue with:
# - Title from bug report
# - Description with full details
# - Labels: user-reported, settings
# - Link back to Supabase ticket ID
```

**From Feedback to Feature Request:**

```bash
# Script: scripts/feedback-to-feature.sh
./scripts/feedback-to-feature.sh --feedback-id feedback-uuid --project GROW

# This creates a feature request with:
# - User's suggestion as description
# - Link to original feedback
# - Vote count if multiple users requested
```

---

## Legal Version Management

### Version Format

Legal documents use **semantic versioning**:

```
major.minor.patch
Example: 2.1.3
```

- **Major (2.x.x):** Breaking changes, requires re-acceptance
- **Minor (x.1.x):** Non-breaking additions, prompts acknowledgment
- **Patch (x.x.3):** Typo fixes, no user action required

### Updating Legal Documents

#### Step 1: Update Document Content

```sql
-- Update terms of service
UPDATE legal_documents
SET
  content = 'New terms content here...',
  version = '2.0.0',  -- Increment appropriately
  last_updated = NOW(),
  requires_reacceptance = true  -- Set to true for major versions
WHERE type = 'terms';

-- Update privacy policy
UPDATE legal_documents
SET
  content = 'New privacy policy content...',
  version = '1.5.0',
  last_updated = NOW(),
  requires_reacceptance = false  -- Minor version, no re-acceptance
WHERE type = 'privacy';
```

#### Step 2: Deploy Document Update

```bash
# Apply migration to production
supabase db push

# Verify update
supabase db query "SELECT type, version, requires_reacceptance FROM legal_documents;"
```

#### Step 3: Trigger Re-Acceptance (Major Versions Only)

```sql
-- Find users who need to re-accept
SELECT
  u.id as user_id,
  u.email,
  la.accepted_version as current_version,
  ld.version as latest_version
FROM users u
LEFT JOIN legal_acceptances la ON u.id = la.user_id AND la.document_type = 'terms'
CROSS JOIN legal_documents ld WHERE ld.type = 'terms'
WHERE
  ld.requires_reacceptance = true
  AND (
    la.accepted_version IS NULL
    OR split_part(la.accepted_version, '.', 1)::int < split_part(ld.version, '.', 1)::int
  );

-- Mark users as requiring re-acceptance (handled automatically by app on launch)
-- No manual action needed - app checks on each launch
```

#### Step 4: Monitor Re-Acceptance Progress

```sql
-- Re-acceptance progress for major version
SELECT
  ld.type,
  ld.version as latest_version,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT la.user_id) FILTER (
    WHERE split_part(la.accepted_version, '.', 1)::int = split_part(ld.version, '.', 1)::int
  ) as accepted_count,
  ROUND(
    100.0 * COUNT(DISTINCT la.user_id) FILTER (
      WHERE split_part(la.accepted_version, '.', 1)::int = split_part(ld.version, '.', 1)::int
    ) / NULLIF(COUNT(DISTINCT u.id), 0),
    2
  ) as acceptance_percentage
FROM legal_documents ld
CROSS JOIN users u
LEFT JOIN legal_acceptances la ON u.id = la.user_id AND la.document_type = ld.type
WHERE ld.type = 'terms'
GROUP BY ld.type, ld.version;
```

### Handling Non-Acceptance

**Grace Period (Optional):**

If you want to give users time to accept before blocking:

```sql
-- Add grace period to legal_documents table
ALTER TABLE legal_documents ADD COLUMN grace_period_days INT DEFAULT 0;

-- Set grace period for terms update
UPDATE legal_documents
SET grace_period_days = 7  -- 7 days to accept
WHERE type = 'terms' AND version = '2.0.0';
```

**App Logic:**

- On launch, check if `requires_reacceptance = true`
- If within grace period: show banner, allow app usage
- If grace period expired: block app access until accepted

### Rolling Back Legal Version

**Emergency Rollback (Wrong Content):**

```sql
-- Revert to previous version
UPDATE legal_documents
SET
  content = (SELECT content FROM legal_documents_history WHERE type = 'terms' AND version = '1.9.0'),
  version = '1.9.0',
  last_updated = NOW(),
  requires_reacceptance = false
WHERE type = 'terms';

-- Log rollback event
INSERT INTO legal_version_events (
  document_type,
  from_version,
  to_version,
  action,
  reason,
  performed_by
) VALUES (
  'terms',
  '2.0.0',
  '1.9.0',
  'rollback',
  'Incorrect content deployed',
  'ops-team-id'
);
```

### Legal Document History

**Maintaining Version History:**

```sql
-- Create history entry before updating
INSERT INTO legal_documents_history (
  type,
  version,
  content,
  effective_date,
  deprecated_date
)
SELECT
  type,
  version,
  content,
  last_updated,
  NOW()
FROM legal_documents
WHERE type = 'terms';

-- Then update current document
UPDATE legal_documents SET ...;
```

**Retrieving Historical Version:**

```sql
-- Get all versions of terms of service
SELECT
  version,
  effective_date,
  deprecated_date,
  CASE
    WHEN deprecated_date IS NULL THEN 'Current'
    ELSE 'Historical'
  END as status
FROM legal_documents_history
WHERE type = 'terms'
ORDER BY effective_date DESC;

-- Get content of specific version
SELECT content
FROM legal_documents_history
WHERE type = 'terms' AND version = '1.5.0';
```

---

## Common Operations

### Resetting User Settings

**Reset All Settings for User:**

```sql
-- Start transaction
BEGIN;

-- Delete notification preferences
DELETE FROM notification_preferences WHERE user_id = 'user-id-here';

-- Reset profile to defaults
UPDATE profiles
SET
  display_name = (SELECT email FROM auth.users WHERE id = 'user-id-here'),
  bio = NULL,
  location = NULL,
  avatar_url = NULL,
  show_in_community = true
WHERE user_id = 'user-id-here';

-- Clear privacy consents (will prompt re-consent)
DELETE FROM privacy_consents WHERE user_id = 'user-id-here';

-- Commit
COMMIT;
```

### Manual Sync Retry

**Clear Failed Sync Queue for User:**

```bash
# Connect to app's MMKV storage (requires device access or backup)
# Or use admin API endpoint

curl -X POST https://api.growbro.app/admin/sync/retry \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-here",
    "operation": "profile"  // or "notifications", "legal"
  }'
```

### Exporting User Data

**Generate Data Export Manually:**

```bash
# Run export script
./scripts/generate-user-export.sh --user-id user-id-here --output /tmp/export.zip

# Upload to temporary storage
supabase storage upload exports export-user-id-timestamp.zip /tmp/export.zip

# Generate signed URL (24 hour expiry)
supabase storage sign exports/export-user-id-timestamp.zip 86400
```

### Force Account Deletion (Support Request)

**Skip Grace Period (User Request):**

```sql
-- Find deletion request
SELECT * FROM account_deletion_requests
WHERE user_id = 'user-id-here' AND status = 'pending';

-- Update scheduled_for to now (triggers immediate deletion)
UPDATE account_deletion_requests
SET scheduled_for = NOW()
WHERE user_id = 'user-id-here' AND status = 'pending';

-- Manually trigger deletion job
SELECT cron.unschedule('account_deletion_processor');
SELECT process_account_deletions();  -- Edge function
SELECT cron.schedule('account_deletion_processor', '0 2 * * *', 'SELECT process_account_deletions()');
```

---

## Troubleshooting

### Avatar Upload Failures

**Symptoms:**

- Users report avatar upload stuck at specific progress
- Error: "Upload failed: 413 Payload Too Large"
- Error: "Upload failed: 403 Forbidden"

**Diagnosis:**

```sql
-- Check recent failed uploads
SELECT
  user_id,
  created_at,
  error_message,
  file_size_kb
FROM avatar_upload_logs
WHERE
  status = 'failed'
  AND created_at >= NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;
```

**Resolution:**

1. **413 Payload Too Large:**
   - Check client-side compression is working
   - Verify Supabase Storage bucket size limits
   - Ensure iterative compression loop is not failing

2. **403 Forbidden:**
   - Verify RLS policies on avatars bucket
   - Check user auth token is valid
   - Ensure userId in path matches authenticated user

3. **Stuck at Progress:**
   - Check network connectivity logs
   - Verify expo-image-manipulator is working
   - Test EXIF stripping function

### Sync Queue Stuck

**Symptoms:**

- User reports changes not syncing for hours
- Sync status shows "X items pending"
- Network is available but sync doesn't progress

**Diagnosis:**

```typescript
// Check sync queue state (via admin API or device logs)
{
  pending: 5,
  syncing: 0,
  error: 3,
  lastSyncAt: 1730764800000,  // 2 hours ago
  lastError: "Network request failed"
}
```

**Resolution:**

1. **Check Network Manager:**

   ```typescript
   // Verify isOnline() is detecting network correctly
   const online = await isOnline();
   console.log('Network status:', online);
   ```

2. **Inspect Error Items:**

   ```typescript
   // Log sync queue items with errors
   const queue = await loadQueue();
   const errors = queue.filter((item) => item.status === 'error');
   console.log('Error items:', errors);
   ```

3. **Manual Retry:**

   ```typescript
   // Force retry all failed items
   await retryFailed();
   ```

4. **Clear Queue (Last Resort):**
   ```typescript
   // WARNING: Loses pending changes
   await clearQueue();
   ```

### Legal Re-Acceptance Loop

**Symptoms:**

- User repeatedly shown legal acceptance modal
- Acceptance recorded but modal reappears
- Error: "Already accepted this version"

**Diagnosis:**

```sql
-- Check user's acceptance records
SELECT
  document_type,
  accepted_version,
  accepted_at,
  app_version,
  locale
FROM legal_acceptances
WHERE user_id = 'user-id-here'
ORDER BY accepted_at DESC;

-- Check current document versions
SELECT type, version, requires_reacceptance
FROM legal_documents;
```

**Resolution:**

1. **Version Mismatch:**
   - Ensure app is comparing versions correctly (major.minor.patch)
   - Check for string vs. number comparison bugs
   - Verify semantic versioning logic

2. **Race Condition:**
   - User accepted on device A, device B hasn't synced yet
   - Force sync on device B
   - Implement optimistic acceptance (show accepted immediately)

3. **Database Issue:**
   - Verify RLS policies allow user to read their acceptances
   - Check for write failures during acceptance
   - Inspect Supabase logs for errors

---

## Monitoring & Alerts

### Key Metrics

**Supabase Dashboard:**

- API requests per minute (settings endpoints)
- Database connections (profile/notification queries)
- Storage bandwidth (avatar uploads)
- Edge function invocations (bug reports, feedback)

**Sentry:**

- Error rate in settings screens
- Avatar upload failure rate
- Sync queue failure rate
- Legal acceptance errors

**Custom Metrics (Analytics):**

```typescript
// Track in app analytics
trackEvent('settings.profile.save', {
  success: boolean,
  syncTime: number,
  offline: boolean,
});

trackEvent('settings.avatar.upload', {
  success: boolean,
  duration: number,
  fileSize: number,
  compressionRatio: number,
});

trackEvent('settings.sync.retry', {
  operation: string,
  attemptCount: number,
  success: boolean,
});
```

### Alert Thresholds

**Critical Alerts (PagerDuty):**

- Avatar upload success rate < 90% for 15 minutes
- Sync failure rate > 25% for 10 minutes
- Bug report edge function error rate > 5% for 5 minutes
- Legal acceptance API errors > 10 per minute

**Warning Alerts (Slack):**

- Notification preferences sync queue > 100 items
- Profile sync queue > 50 items per user
- Account deletion requests > 10 per hour (potential spam)
- Legal re-acceptance rate < 50% after 24 hours of major version

### Dashboard Queries

**Sync Health Dashboard:**

```sql
-- Sync queue stats by operation
SELECT
  operation,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'error') as errors,
  AVG(attempts) as avg_attempts,
  MAX(created_at) as latest_item
FROM sync_queue
GROUP BY operation;

-- Users with stuck syncs (>10 pending items)
SELECT
  user_id,
  COUNT(*) as pending_count,
  MAX(created_at) as oldest_item
FROM sync_queue
WHERE status = 'pending'
GROUP BY user_id
HAVING COUNT(*) > 10;
```

**Support Activity Dashboard:**

```sql
-- Bug reports by severity (last 7 days)
SELECT
  severity,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours
FROM bug_reports
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY severity;

-- Feedback by category (last 30 days)
SELECT
  category,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'responded') as responded,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'responded') / COUNT(*), 1) as response_rate_pct
FROM feedback
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY category;
```

---

## Escalation Procedures

### Severity Levels

**P0 (Critical - Immediate Response):**

- Settings completely inaccessible for all users
- Data loss occurring (profile deletions, avatar loss)
- Security breach (unauthorized access to profiles)

**P1 (High - 1 Hour Response):**

- Settings partially broken for >10% of users
- Sync failing for all users
- Legal acceptance blocking all new signups

**P2 (Medium - 4 Hour Response):**

- Feature not working for specific user segment
- Sync delays but eventual success
- Support forms not submitting

**P3 (Low - Next Business Day):**

- UI glitches
- Performance degradation
- Individual user issues

### Escalation Contacts

**On-Call Rotation:**

- Settings Feature: settings-oncall@growbro.app
- Backend/Database: backend-oncall@growbro.app
- Security: security@growbro.app

**Escalation Path:**

1. **P3/P2:** Create Jira ticket, assign to settings team
2. **P1:** Notify on-call engineer (Slack + PagerDuty)
3. **P0:** Page on-call + engineering manager + CTO

### Incident Response Checklist

**When Incident Detected:**

- [ ] Assess severity (P0-P3)
- [ ] Create incident channel (#incident-YYYY-MM-DD-description)
- [ ] Notify relevant on-call engineers
- [ ] Begin logging timeline and actions in incident doc
- [ ] Identify affected users (count, segments)

**During Investigation:**

- [ ] Check Sentry for errors
- [ ] Check Supabase logs and metrics
- [ ] Query database for affected records
- [ ] Review recent deployments (last 24 hours)
- [ ] Test reproduction in staging environment

**Mitigation:**

- [ ] Implement immediate fix or workaround
- [ ] Deploy fix to production
- [ ] Verify fix with affected users
- [ ] Monitor metrics for 1 hour post-fix

**Post-Incident:**

- [ ] Write postmortem document
- [ ] Identify root cause
- [ ] Document prevention measures
- [ ] Create follow-up tasks
- [ ] Share learnings with team

---

## Appendix

### Useful SQL Queries

**Find Users with Incomplete Profiles:**

```sql
SELECT
  u.id,
  u.email,
  p.display_name,
  p.avatar_url IS NULL as missing_avatar,
  p.bio IS NULL as missing_bio
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE
  p.avatar_url IS NULL
  OR p.bio IS NULL
LIMIT 100;
```

**Audit Privacy Consent Changes:**

```sql
SELECT
  pc.user_id,
  pc.consent_type,
  pc.granted,
  pc.updated_at,
  p.display_name
FROM privacy_consents pc
JOIN profiles p ON pc.user_id = p.user_id
WHERE pc.updated_at >= NOW() - INTERVAL '7 days'
ORDER BY pc.updated_at DESC;
```

**Account Deletion Grace Period Expiring Soon:**

```sql
SELECT
  adr.request_id,
  adr.user_id,
  p.email,
  adr.scheduled_for,
  adr.scheduled_for - NOW() as time_remaining
FROM account_deletion_requests adr
JOIN auth.users p ON adr.user_id = p.id
WHERE
  adr.status = 'pending'
  AND adr.scheduled_for BETWEEN NOW() AND NOW() + INTERVAL '7 days'
ORDER BY adr.scheduled_for;
```

### Contact Information

**Engineering:**

- Settings Team: settings-team@growbro.app
- Backend Team: backend-team@growbro.app

**Operations:**

- DevOps: devops@growbro.app
- On-Call: oncall@growbro.app

**Product:**

- Product Manager: pm-settings@growbro.app
- Design: design@growbro.app

**Support:**

- User Support: support@growbro.app
- Internal Support Slack: #eng-support

---

_End of Runbook_

_For updates or corrections, please submit a PR to this document._
