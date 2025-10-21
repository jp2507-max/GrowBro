# Moderation API

This directory contains the API layer for the GrowBro moderation system, implementing DSA-compliant content moderation workflows.

## Structure

```
src/api/moderation/
├── queue.ts                  # React Query hooks for queue management
├── queue-service.ts          # Queue service layer with business logic
├── policy-catalog.ts         # Policy catalog hooks
├── similar-decisions.ts      # Similar decisions and COI hooks
├── trusted-flaggers.ts       # Trusted flagger analytics hooks
└── README.md                # This file
```

## Features

### Queue Management (`queue.ts`, `queue-service.ts`)

- **useModeratorQueue**: Fetch moderation queue with filters and auto-refresh
- **useClaimReport**: Claim exclusive 4-hour lock on a report
- **useReleaseReport**: Release claimed report back to queue
- **useQueueMetrics**: Get real-time queue metrics and SLA compliance

#### Service Functions

- `getModeratorQueue()`: Fetch queue with priority sorting
- `claimReport()`: Claim report with COI check
- `releaseReport()`: Release report back to pool
- `calculateSLAStatus()`: Determine SLA status indicator
- `sortQueueByPriority()`: Sort reports by priority (immediate > illegal > trusted > standard)
- `filterQueue()`: Apply filters to queue items
- `groupReportsByContent()`: Aggregate duplicate reports by content hash
- `getAggregatedReport()`: Get primary report with aggregated count

## Usage Examples

### Fetching Queue

```typescript
import { useModeratorQueue } from '@/api/moderation/queue';

function QueueDashboard({ moderatorId }: { moderatorId: string }) {
  const { data: queue, isLoading } = useModeratorQueue({
    variables: {
      moderator_id: moderatorId,
      filters: {
        overdue_only: true,
        priority_min: 50,
      },
    },
  });

  if (isLoading) return <Loading />;

  return (
    <View>
      <Text>Total: {queue?.total_count}</Text>
      <Text>Overdue: {queue?.overdue_count}</Text>
    </View>
  );
}
```

### Claiming Report

```typescript
import { useClaimReport } from '@/api/moderation/queue';

function ReportCard({ reportId, moderatorId }: Props) {
  const claimReport = useClaimReport();

  const handleClaim = async () => {
    const result = await claimReport.mutateAsync({
      report_id: reportId,
      moderator_id: moderatorId,
    });

    if (!result.success) {
      showMessage({ message: result.error, type: 'danger' });
      return;
    }

    if (result.conflict_of_interest?.has_conflict) {
      showMessage({
        message: `COI detected: ${result.conflict_of_interest.reasons.join(', ')}`,
        type: 'warning',
      });
    }
  };

  return <Button onPress={handleClaim}>Claim</Button>;
}
```

### Queue Metrics

```typescript
import { useQueueMetrics } from '@/api/moderation/queue';

function QueueStats({ moderatorId }: { moderatorId: string }) {
  const { totalReports, overdueCount, averageAgeHours } = useQueueMetrics(moderatorId);

  return (
    <View>
      <Stat label="Total" value={totalReports} />
      <Stat label="Overdue" value={overdueCount} type="danger" />
      <Stat label="Avg Age" value={`${averageAgeHours}h`} />
    </View>
  );
}
```

## API Endpoints

These React Query hooks expect the following backend endpoints:

- `POST /api/moderation/queue` - Fetch queue with filters
- `POST /api/moderation/reports/:id/claim` - Claim report
- `POST /api/moderation/reports/:id/release` - Release report
- `GET /api/moderation/reports/:id/conflict-check` - Check COI

## Configuration

Auto-refresh interval for queue (default 30 seconds):

```typescript
// In queue.ts
refetchInterval: 30000, // 30 seconds
staleTime: 10000, // 10 seconds
```

## Requirements Implemented

- **Req 2.1**: Priority-sorted queue with trusted flagger lane
- **Req 2.2**: Queue shows report age, category, reporter count (partial)
- **Req 2.3**: SLA status calculation and visual indicators
- **Req 11.1**: Trusted flagger identification and priority

## Additional Features

### Policy Catalog (`policy-catalog.ts`)

- `usePolicyCatalogEntry`: Fetch single policy by category
- `useAllPolicies`: Get all policy entries
- `useSearchPolicies`: Search policies by keywords
- `usePoliciesByJurisdiction`: Filter policies by jurisdiction
- `usePolicyGuidance`: Get evidence requirements and guidelines
- `usePolicyOptions`: Formatted options for dropdowns

### Similar Decisions (`similar-decisions.ts`)

- `useSimilarDecisions`: Find similar prior decisions for context
- `useConflictOfInterest`: Check COI before claiming
- `useModeratorConsistency`: Get moderator performance metrics
- `useUserViolationPattern`: Analyze user's violation history

### Trusted Flaggers (`trusted-flaggers.ts`)

- `useTrustedFlaggerAnalytics`: Overall analytics dashboard data
- `useTrustedFlaggerMetrics`: Individual flagger performance
- `useTrustedFlaggers`: List all flaggers with status filter
- `useTrustedFlaggerSummary`: Summary statistics for dashboard

## TODO

- [ ] Implement actual Supabase queries (replace fetch stubs)
- [ ] Add WebSocket/Realtime for instant updates
- [ ] Add pagination for large queues
- [ ] Implement queue item caching strategy
- [ ] Add optimistic updates for claim/release
- [ ] Create queue event audit trail
- [ ] Add vector similarity search for prior decisions
- [ ] Implement ML-based content similarity scoring

## Related

- Types: `src/types/moderation.ts`
- Services: `src/lib/moderation/` (policy-catalog, similar-decisions, conflict-of-interest, trusted-flagger-analytics)
- SLA Utilities: `src/lib/moderation/sla-calculator.ts`
- UI Components: `src/components/moderation/` (pending)
- Documentation: `docs/moderator-console-setup.md`
