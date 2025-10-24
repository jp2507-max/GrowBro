# Moderation API Documentation

## Overview

The GrowBro Moderation API provides a comprehensive set of endpoints and hooks for implementing DSA-compliant content moderation workflows. This API is built on React Query for efficient data fetching and caching, with full TypeScript support.

## Architecture

The moderation system is organized into several key components:

- **Queue Management**: Priority-sorted moderation queues with SLA tracking
- **Content Moderation**: Decision making and action execution
- **Appeals Process**: User appeals against moderation decisions
- **Audit & Compliance**: Complete audit trails and reporting
- **Trusted Flaggers**: Priority handling for trusted community members

## API Reference

For detailed API documentation including all available hooks, functions, and usage examples, see:

**📋 [Moderation API Reference](../src/api/moderation/README.md)**

This comprehensive documentation includes:

### Core Hooks

- `useModeratorQueue` - Fetch and manage moderation queues
- `useClaimReport` - Claim reports for moderation
- `useReleaseReport` - Release claimed reports
- `useQueueMetrics` - Real-time queue statistics

### Policy Management

- `usePolicyCatalogEntry` - Single policy details
- `useAllPolicies` - Complete policy catalog
- `useSearchPolicies` - Policy search functionality

### Decision Support

- `useSimilarDecisions` - Find similar prior decisions
- `useConflictOfInterest` - COI checking before claims
- `useModeratorConsistency` - Performance metrics

### Appeals & Oversight

- `useAppealsQueue` - Appeals management
- `useTrustedFlaggerAnalytics` - Analytics dashboard

## Backend Endpoints

The React Query hooks expect the following Supabase Edge Functions:

### Queue Management

```
POST /api/moderation/queue          # Fetch queue with filters
POST /api/moderation/reports/:id/claim    # Claim report
POST /api/moderation/reports/:id/release  # Release report
GET  /api/moderation/reports/:id/conflict-check  # COI check
```

### Content Moderation

```
POST /api/moderation/execute-action  # Execute moderation action
POST /api/moderation/reports/:id/snapshot  # Create content snapshot
```

### Appeals

```
POST /api/moderation/appeals         # Submit appeal
GET  /api/moderation/appeals/:id     # Get appeal details
POST /api/moderation/appeals/:id/decide  # Decide on appeal
```

## Data Types

All TypeScript types are defined in `src/types/moderation.ts`:

- `ModerationReport` - Report structure
- `ModerationAction` - Action types and metadata
- `Appeal` - Appeal workflow data
- `QueueMetrics` - Queue statistics
- `PolicyEntry` - Policy catalog entries

## Configuration

### Queue Settings

```typescript
// Auto-refresh interval (default: 30 seconds)
refetchInterval: 30000;
staleTime: 10000;
```

### SLA Configuration

- Immediate reports: 1 hour
- Illegal content: 24 hours
- Standard reports: 7 days

## Security & Compliance

### Row Level Security

- Moderators can only access assigned content
- Users can only see their own reports/appeals
- Audit trails are immutable

### Audit Logging

- All moderation actions are logged
- Complete decision history maintained
- Compliance reporting capabilities

## Performance Considerations

- Real-time queue updates via Supabase subscriptions
- Optimistic updates for better UX
- Strategic caching with React Query
- Indexed database queries for performance

## Testing

Unit tests for moderation API components are located in:

- `src/api/moderation/__tests__/`
- `src/lib/moderation/__tests__/`

## Related Documentation

- [Moderator Console Setup](../moderator-console-setup.md)
- [Community Moderation Integration](../community-moderation-integration.md)
- [DSA Compliance Mapping](../../compliance/dsa-compliance-mapping.json)
- [Content Moderation Audit](../../compliance/lia-content-moderation.md)
