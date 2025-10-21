# Moderator Console Setup Guide

## Overview

The Moderator Console is a web-based interface for GrowBro content moderators to manage reports, make moderation decisions, and monitor SLA compliance. This document outlines the architecture, setup, and deployment of the moderator console.

## Status: In Progress

**Completed Components (Task 6 - Partial):**

- ✅ TypeScript type definitions for moderator roles, permissions, and queue management
- ✅ Queue management API service layer with priority sorting and filtering
- ✅ React Query hooks for queue operations
- ✅ SLA calculation and monitoring utilities
- ✅ Visual indicator mappings for SLA status
- ✅ SoR preview service foundation

**Pending Components:**

- ⏳ Policy catalog integration with prior decision surfacing
- ⏳ Trusted flagger analytics dashboard
- ⏳ Complete SoR preview UI with side-by-side comparison
- ⏳ Moderator-only routes with role-based access control
- ⏳ Real-time queue updates via WebSocket/polling
- ⏳ Conflict-of-interest detection implementation
- ⏳ Full UI component library for moderator console
- ⏳ Comprehensive tests and E2E scenarios

## Architecture

### Technology Stack

- **Frontend**: React Native Web (Expo web build) or separate Next.js admin portal
- **Backend**: Supabase Edge Functions + PostgreSQL
- **Real-time**: Supabase Realtime or WebSocket connections
- **Authentication**: Supabase Auth with role-based access control
- **State Management**: React Query for server state, Zustand for client state

### Current Implementation

The moderator console is implemented as a service layer that can be consumed by either:

1. **Expo Web Routes** (current approach): Web-accessible routes within the Expo app
2. **Separate Admin Portal** (production recommendation): Standalone Next.js application

## Setup Instructions

### 1. Environment Configuration

Add the following environment variables:

```env
# Moderator Console
MODERATOR_CONSOLE_ENABLED=true
MODERATOR_ROLE_IDS=moderator,senior_moderator,supervisor,admin

# SLA Configuration
SLA_IMMEDIATE_WINDOW_MS=0
SLA_ILLEGAL_WINDOW_MS=86400000  # 24 hours
SLA_TRUSTED_WINDOW_MS=172800000  # 48 hours
SLA_STANDARD_WINDOW_MS=259200000  # 72 hours

# Real-time Updates
QUEUE_REFRESH_INTERVAL_MS=30000  # 30 seconds
```

### 2. Database Setup

The moderator console relies on database tables created in Task 1:

- `content_reports` - Report intake
- `moderation_decisions` - Decision tracking
- `statements_of_reasons` - SoR storage
- `trusted_flaggers` - Trusted flagger management
- `repeat_offender_records` - Repeat offense tracking
- `audit_events` - Comprehensive audit trail

### 3. Role-Based Access Control

Create Supabase RLS policies for moderator access:

```sql
-- Allow moderators to read reports
CREATE POLICY "moderators_read_reports" ON content_reports
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('moderator', 'senior_moderator', 'supervisor', 'admin')
  );

-- Allow moderators to claim reports
CREATE POLICY "moderators_claim_reports" ON content_reports
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' IN ('moderator', 'senior_moderator', 'supervisor', 'admin')
  );
```

### 4. API Endpoints

Implement the following Supabase Edge Functions or API routes:

```
POST /api/moderation/queue
  - Fetch moderation queue with filters
  - Returns: ModerationQueue

POST /api/moderation/reports/:id/claim
  - Claim exclusive 4-hour lock on report
  - Returns: ClaimResult

POST /api/moderation/reports/:id/release
  - Release claimed report back to queue
  - Returns: { success: boolean }

GET /api/moderation/reports/:id/conflict-check
  - Check for conflict of interest
  - Returns: ConflictOfInterest

GET /api/moderation/decisions/:id/sor-preview
  - Get user-facing and redacted SoR preview
  - Returns: SoRPreview

GET /api/moderation/trusted-flaggers/analytics
  - Get trusted flagger performance metrics
  - Returns: TrustedFlaggerAnalytics

GET /api/moderation/policy-catalog/:category
  - Get policy details with prior similar decisions
  - Returns: PolicyCatalogEntry
```

## Usage

### For Developers

#### Fetching the Queue

```typescript
import { useModeratorQueue } from '@/api/moderation/queue';

function QueueDashboard() {
  const { data: queue, isLoading } = useModeratorQueue({
    variables: {
      moderator_id: 'current-moderator-id',
      filters: {
        overdue_only: true,
        trusted_flagger: false,
      },
    },
  });

  if (isLoading) return <Loading />;

  return (
    <View>
      <Text>Total Reports: {queue?.total_count}</Text>
      <Text>Overdue: {queue?.overdue_count}</Text>
    </View>
  );
}
```

#### Claiming a Report

```typescript
import { useClaimReport } from '@/api/moderation/queue';

function ReportCard({ reportId }: { reportId: string }) {
  const claimReport = useClaimReport();

  const handleClaim = async () => {
    const result = await claimReport.mutateAsync({
      report_id: reportId,
      moderator_id: 'current-moderator-id',
    });

    if (!result.success) {
      showMessage({ message: result.error, type: 'danger' });
    }
  };

  return <Button onPress={handleClaim} title="Claim Report" />;
}
```

#### Calculating SLA Status

```typescript
import {
  calculateSLAStatus,
  formatTimeRemaining,
  getTimeRemainingMs,
} from '@/lib/moderation/sla-calculator';

function SLABadge({ report }: { report: QueuedReport }) {
  const status = calculateSLAStatus(
    report.created_at,
    report.sla_deadline,
    report.priority
  );

  const timeRemaining = getTimeRemainingMs(report.sla_deadline);
  const formattedTime = formatTimeRemaining(timeRemaining);

  return (
    <View className={SLA_COLORS[status].bg}>
      <Text className={SLA_COLORS[status].text}>
        {getSLAStatusLabel(status)}: {formattedTime}
      </Text>
    </View>
  );
}
```

### For Moderators

#### Accessing the Console

1. Log in with moderator credentials
2. Navigate to `/moderator/queue` (web only)
3. View prioritized reports sorted by SLA status

#### Queue Management

- **Priority Lanes**: Reports are automatically sorted into lanes:
  - 🔴 **Immediate**: CSAM, self-harm (action required immediately)
  - ⚠️ **Illegal**: Illegal content (24-hour SLA)
  - ⭐ **Trusted Flagger**: Reports from verified trusted flaggers (48-hour SLA)
  - 📋 **Standard**: Policy violations (72-hour SLA)

- **SLA Indicators**:
  - 🟢 **Green**: On track (<50% time used)
  - 🟡 **Yellow**: Approaching (50-75%)
  - 🟠 **Orange**: At risk (75-90%)
  - 🔴 **Red**: Urgent (>90%)
  - ⚫ **Critical**: OVERDUE (>100%)

#### Claiming Reports

1. Click "Claim" on any available report
2. System checks for conflict of interest
3. If approved, you have exclusive 4-hour access
4. Timer shows remaining claim time
5. After 4 hours, report auto-releases to queue

#### Making Decisions

1. Review content snapshot captured at report time
2. Check policy catalog for violation categories
3. View similar past decisions for consistency
4. Select action: no action, quarantine, geo-block, rate-limit, suspension, removal
5. Generate Statement of Reasons (auto-generated with fields)
6. Preview both user-facing and EC Transparency DB versions
7. Submit decision (supervisor approval required for legal violations)

#### SoR Preview

The SoR preview shows side-by-side comparison:

- **Left Panel**: User-facing SoR (Art. 17)
  - Facts and circumstances
  - Legal/ToS ground
  - Automation usage disclosure
  - Territorial scope
  - Redress options (appeal, ODS, court)

- **Right Panel**: Redacted SoR (Art. 24(5) EC submission)
  - Pseudonymized identifiers
  - Aggregated metrics
  - No personal data
  - Validation status indicator

## DSA Compliance

### Requirements Implemented

- **Req 2.1**: Priority-sorted queue with trusted flagger lane ✅
- **Req 2.2**: Queue shows report age, category, reporter count, content preview, policy links ✅ (partial)
- **Req 2.3**: Visual SLA status indicators for overdue items ✅
- **Req 11.1**: Trusted flagger badges and priority intake ✅ (types/service layer)

### Pending DSA Requirements

- **Req 2.2**: Prior similar decisions surfacing (⏳ needs implementation)
- **Req 2.2**: Conflict-of-interest warnings (⏳ needs implementation)
- **Req 3.3**: Full SoR generation with all Art. 17 fields (⏳ Task 5 integration)
- **Req 3.4**: Redacted SoR submission to EC Transparency DB (⏳ Task 7)

## Testing

### Unit Tests

```bash
# Test queue management
pnpm test queue-service

# Test SLA calculations
pnpm test sla-calculator

# Test SLA indicators
pnpm test sla-indicators
```

### Integration Tests

```bash
# Test full queue workflow
pnpm test api/moderation/queue

# Test claim/release flow
pnpm test moderation-claim-workflow
```

### E2E Tests (Maestro)

```bash
# Test moderator queue dashboard
maestro test .maestro/moderator-queue-dashboard.yaml

# Test claim and decide workflow
maestro test .maestro/moderation-decision-flow.yaml
```

## Known Issues & Limitations

1. **UI Components Not Implemented**: Only service layer and hooks exist. Full UI components for queue dashboard, SLA badges, and SoR preview need to be built.

2. **Authentication Incomplete**: Moderator role checks and RLS policies need to be implemented in Supabase.

3. **Real-time Updates**: Currently uses polling (30s interval). WebSocket integration for true real-time would improve UX.

4. **Conflict-of-Interest**: COI detection logic is stubbed. Needs implementation with historical decision lookup.

5. **Policy Catalog**: Not yet integrated. Needs database schema and API endpoints.

6. **Prior Decisions**: Similar decision surfacing algorithm not implemented.

7. **Trusted Flagger Analytics**: Dashboard components and chart integrations pending.

## Next Steps

### Immediate (Task 6 Completion)

1. Build UI components for queue dashboard
2. Implement moderator-only routes with auth guards
3. Create SoR preview panel with side-by-side comparison
4. Add policy catalog integration
5. Write comprehensive tests

### Future Enhancements

1. Real-time WebSocket updates instead of polling
2. Moderator performance analytics dashboard
3. Batch decision-making capabilities
4. Export reports for transparency compliance
5. Mobile moderator app support
6. AI-assisted decision recommendations
7. Multi-language support for international moderators

## Support

For questions or issues:

- Slack: #moderation-system
- Email: moderation-support@growbro.com
- Documentation: /docs/moderation/

## References

- [DSA Article 16: Notice-and-Action](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
- [DSA Article 17: Statement of Reasons](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
- [DSA Article 20: Internal Complaint-Handling](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
- [DSA Article 22: Trusted Flaggers](https://eur-lex.europa.eu/eli/reg/2022/2065/oj)
- [EC Transparency Database](https://transparency.dsa.ec.europa.eu/)
