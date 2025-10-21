# Implementation Plan

- [x] 0. Compliance & Privacy Setup (blocking)
  - Run DPIA for moderation + age-verification + geo features; create RoPA entries
  - Define lawful bases and retention schedules for all data processing
  - Draft DSA mapping document covering Art. 16, 17, 20, 21, 22, 23, 24(5), 28
  - Set up feature flags for SoR export & age-verification (ship dark until checks pass)
  - _Requirements: 14.1, 14.4, All DSA compliance requirements_
  - **Status**: ✅ COMPLETE (2025-10-19)

- [x] 1. Set up core project structure and database schema
  - Create database migrations for all moderation entities (reports, decisions, appeals, audit events)
  - Add idempotency keys with unique indexes for report creation, SoR export, notifications
  - Create SoR exporter tables: sor_outbox (pending), sor_submissions (status, EC DB id, attempts)
  - Store content snapshots with hash + WORM semantics and version pointer to exact reported state
  - Add PII tag column for audit rows to simplify Art. 24(5) redaction
  - Implement partitioned tables for SoR exports, audit events, and reports by month
  - Set up separate audit database with WORM storage configuration
  - Create indexes for common query patterns (user lookups, SLA monitoring, trusted flagger queries)
  - **Implement append-only enforcement at DB level via triggers and RLS policies that prevent UPDATE/DELETE for audit and sor tables**
  - **Add per-row content hashing and digital signing with a documented signer key rotation procedure and stored signatures**
  - **Implement monthly partitioning plus a checksum manifest per partition (signed) to detect tampering**
  - **Set up periodic offsite immutable snapshots (object storage with immutability/versioning) and a retention/expiry policy**
  - **Document operational tooling for rehydration, verification, and compliance auditing so engineers can implement and test these mechanisms**
  - _Requirements: 1.5, 2.7, 6.1, 6.6, 14.2_
  - **Status**: ✅ COMPLETE (2025-10-19) - Migrations applied to Supabase

- [x] 2. Implement core data models and validation (Art. 16 & 17 exactness)
  - Create ContentReport interface with mandatory Art. 16 fields: substantiated explanation, exact locator, reporter contact, good-faith declaration
  - Require jurisdiction + optional legalReference for "illegal" track reports
  - Implement StatementOfReasons model including: decision ground (law vs ToS), facts & circumstances, content type, automation usage (detection/decision), territorial scope, redress options
  - Store returned Transparency DB id in StatementOfReasons
  - Build TrustedFlagger and RepeatOffenderRecord models for Art. 22/23 compliance
  - Create server-side validation for Art. 16 fields with actionable error messages
  - _Requirements: 1.3, 1.4, 11.2, 12.1_
  - **Status**: ✅ COMPLETE (2025-10-19) - Zod schemas created with comprehensive validation and tests

- [x] 3. Build Reporting Service with DSA compliance (two-track intake)
  - Implement report intake API with two-track system (illegal vs policy violation)
  - Validate Art. 16 fields server-side; reject incomplete notices with actionable error text
  - Implement duplicate-notice suppression via (content_hash, reporter_id, category) + time window
  - Create content snapshot manager with cryptographic hashing
  - Apply data minimisation: log only security-grade metadata; avoid device fingerprinting by default (needs ePrivacy 5(3) consent)
  - Implement priority classification for trusted flaggers and illegal content
  - _Requirements: 1.1, 1.2, 1.6, 1.8_

- [x] 4. Create content reporting UI components in React Native
  - Build report form with conditional fields based on report type
  - Implement jurisdiction selector for illegal content reports
  - Create good-faith declaration checkbox with legal text
  - Add content locator capture and evidence upload functionality
  - _Requirements: 1.1, 1.2, 1.3_
  - **Status**: ✅ COMPLETE (2025-10-20)

- [x] 5. Implement Moderation Service core functionality (SoR + actions)
  - Create moderation queue management with priority lanes
  - Add trusted-flagger fast lane with badges and SLA metrics
  - Build decision engine with policy catalog integration
  - On any restrictive action, generate SoR and queue EC Transparency DB submission immediately (idempotent and PII-scrubbed)
  - Expand actions to quarantine/downrank/geo-block/rate-limit/time-boxed suspension, each with reason code and duration
  - Implement Statement of Reasons generator with DSA compliance
  - Create action executor for graduated enforcement actions
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_
  - **Status**: ✅ COMPLETE (2025-10-20)

- [x] 6. Build Moderator Console web interface
  - Create queue dashboard with SLA monitoring and visual indicators
  - Add SoR Preview (user-facing copy) + Redacted SoR Preview (EC submission) side-by-side
  - Show policy catalog links and prior similar decisions; surface conflict-of-interest warnings
  - Build policy catalog deep-links with contextual guidance
  - Add trusted flagger dashboard with quality analytics
  - _Requirements: 2.1, 2.2, 2.3, 11.1_
  - **Status**: ✅ COMPLETE (2025-10-20)
    - ✅ TypeScript types for moderator roles, permissions, queue management
    - ✅ Queue management API service with priority sorting and filtering
    - ✅ React Query hooks for queue operations
    - ✅ SLA calculation and monitoring utilities
    - ✅ Visual indicator mappings for SLA status
    - ✅ SoR preview service foundation
    - ✅ Policy catalog integration (service + hooks)
    - ✅ Similar decisions retrieval and COI detection
    - ✅ Trusted flagger analytics service and hooks
    - ✅ Queue dashboard UI components:
      - src/app/(moderator)/\_layout.tsx - Protected moderator layout with auth guard
      - src/app/(moderator)/queue/index.tsx - Main queue screen
      - src/components/moderation/sla-badge.tsx - SLA status indicator with animations
      - src/components/moderation/priority-badge.tsx - Priority level badge
      - src/components/moderation/queue-item.tsx - Individual report card component
      - src/components/moderation/queue-filters.tsx - Priority filter controls
      - src/components/moderation/queue-list.tsx - FlashList queue renderer
    - ✅ SoR preview UI components:
      - src/components/moderation/sor-preview-panels.tsx - Side-by-side user-facing and redacted SoR with validation
    - ✅ Flagger analytics UI:
      - src/components/moderation/flagger-analytics-dashboard.tsx - Trusted flagger performance metrics dashboard
    - ✅ Report detail UI:
      - src/components/moderation/report-detail-view.tsx - Comprehensive report view with similar decisions, policy links, and COI warnings
    - ✅ Documentation: docs/moderator-console-setup.md

- [x] 7. Implement DSA Transparency Database integration (Art. 24(5))
  - Use batch API (1–100 SoRs per call) with idempotency by decision_id; fall back to single-submit.
    Enforce deterministic PII scrub with golden tests before enqueue.
  - Implement DLQ, exponential backoff, circuit breaker; track p95 time-to-submit as SLI
  - Enforce no personal data in payloads; run deterministic PII scrub before send
  - Create SoR export queue with circuit breaker pattern
  - Build PII scrubbing pipeline for Art. 24(5) compliance
  - Implement Commission DB API client with retry logic
  - Create dead letter queue handling for failed submissions
  - _Requirements: 3.4, 6.4, 6.5_

- [x] 8. Build Appeals Service with human review workflow (Art. 20) + ODS (Art. 21)
  - Guarantee human review, non-discrimination, free of charge; rotate reviewer (not the original moderator)
  - Create appeal intake system with eligibility validation
  - Implement reviewer assignment with conflict-of-interest prevention
  - Build decision reversal engine for upheld appeals
  - Add optional ODS escalation and store outcomes for transparency metrics
  - Create ODS integration for external dispute resolution
  - _Requirements: 4.1, 4.2, 4.5, 4.8, 13.1_
  - **Status**: ✅ COMPLETE (2025-10-20) - **ALL TODOs IMPLEMENTED**
    - ✅ Appeals Service core with eligibility validation (`src/lib/moderation/appeals-service.ts`)
    - ✅ ODS Integration for Art. 21 external dispute resolution (`src/lib/moderation/ods-integration.ts`)
    - ✅ Appeals API endpoints (`src/api/moderation/appeals.ts`)
    - ✅ React Native UI components:
      - `src/components/moderation/appeal-submission-form.tsx` - with evidence URL management
      - `src/components/moderation/appeal-status-tracker.tsx`
    - ✅ Comprehensive test suite (`src/lib/moderation/appeals-service.test.ts`)
    - ✅ All tests passing (23/23 tests)
    - ✅ TypeScript compilation successful
    - ✅ **NEW**: Audit logging service (`src/lib/moderation/appeals-audit.ts`)
    - ✅ **NEW**: Notification service (`src/lib/moderation/appeals-notifications.ts`)
    - ✅ **IMPLEMENTED**: All Supabase database operations (8 query/update functions)
    - ✅ **IMPLEMENTED**: Notification integration for all appeal lifecycle events
    - ✅ **IMPLEMENTED**: Audit logging for all appeal actions
    - ✅ **IMPLEMENTED**: Evidence URL management with add/remove functionality (max 5 URLs)
    - ⚠️ Note: Function length warnings in UI components (acceptable for complex forms)
    - 📝 Production: Create `ods_bodies` and `ods_escalations` table migrations
    - 📝 Production: Integrate with content/account restoration services
    - 📝 Production: Replace console.log metrics with actual metrics service

- [ ] 9. Implement Age Verification Service (Art. 28 + 2025 blueprint)
  - Replace "ID/credit card" with privacy-preserving over-18 attribute per EU Age-Verification Blueprint
  - Design one-time verification → reusable age token; keep raw ID out of storage
  - Note minors' protection guidelines (Jul 14, 2025); integrate safety-by-design defaults (stricter visibility, no profiling)
  - Avoid device fingerprinting as enforcement fallback unless explicit consent (ePrivacy 5(3))
  - Create privacy-preserving age attribute verification system
  - Build one-time verification token manager for reusable credentials
  - Implement content age-gating engine with safety-by-design principles
  - _Requirements: 8.1, 8.2, 8.6_

- [ ] 10. Build Geo-Location Service with privacy compliance (minimise by design)
  - Default to IP geolocation; request GPS only with consent and clear benefit
  - Avoid proxy/VPN fingerprinting without ePrivacy-compliant consent
  - When applying geo-blocks, include scope in SoR and author-facing "where/why" explainer
  - Implement IP geolocation engine as default location detection
  - Create GPS location service with explicit consent requirements
  - Build regional content filter with dynamic rule updates
  - Implement geo-restriction notifications with SoR integration
  - _Requirements: 9.1, 9.2, 9.3, 9.7_

- [ ] 11. Create comprehensive Audit Service
  - Implement append-only (WORM) with per-event signatures and optional hash chain; partition by month
  - Add "SoR submission trail" view for legal (payload hash, timestamp, EC DB id)
  - Implement immutable event logger with cryptographic signatures
  - Build audit trail query engine for compliance reporting
  - Create data retention manager with GDPR compliance
  - Implement access control logging for audit trail access
  - _Requirements: 6.1, 6.2, 6.6, 14.1, 14.3_

- [ ] 12. Implement SLA monitoring and alerting system
  - Keep internal hour targets, but expose "act expeditiously" language for illegal content; define hot lanes (self-harm/CSAM: immediate)
  - Track false-positive rate, appeal reversal rate, trusted-flagger handling time, SoR submission latency
  - Create real-time SLA compliance monitoring with automated alerts
  - Build escalation system for approaching deadlines (75%, 90% thresholds)
  - Implement performance metrics tracking (response times, false positives)
  - Create compliance violation logging and incident reporting
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 13. Build Trusted Flagger management system
  - Create trusted flagger registration and certification workflow
  - Implement quality analytics and performance tracking
  - Build priority intake lane with distinct visual badges
  - Create periodic review and revocation procedures
  - _Requirements: 11.1, 11.2, 11.3, 11.5_

- [ ] 14. Implement repeat offender detection and graduated enforcement
  - Create violation tracking system with pattern detection
  - Build graduated enforcement engine (warnings → suspensions → bans)
  - Implement manifestly unfounded reporter tracking
  - Create appeal paths for repeat offender status
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 15. Build Transparency Service for reporting
  - Create annual transparency report generator with DSA metrics
  - Implement real-time metrics dashboard for supervisors
  - Build structured export formats for authority requests
  - Create ODS case tracking and outcome reporting
  - _Requirements: 6.3, 6.5, 13.2, 13.7_

- [ ] 16. Implement notification system for users and moderators
  - Deliver Statement of Reasons to users with mandatory fields (facts & circumstances, ground in law/ToS, automation used, redress options) within minutes; log delivery
  - Submit redacted SoR to EC DB "without undue delay"
  - Create user notification system for moderation decisions
  - Build moderator alert system for SLA breaches and escalations
  - Implement Statement of Reasons delivery to users within 15 minutes
  - Create appeal deadline notifications and status updates
  - _Requirements: 3.5, 4.1, 5.2_

- [ ] 17. Build content age-gating enforcement in feed surfaces
  - Implement age-restricted content filtering in community feeds
  - Create age verification flow integration for unverified users
  - Build content tagging system for age-sensitive material
  - Implement safer defaults for minors with no profiling ads
  - _Requirements: 8.2, 8.3, 8.5, 8.7_

- [ ] 18. Create comprehensive error handling and resilience
  - Implement circuit breaker patterns for external service failures
  - Build retry mechanisms with exponential backoff
  - Create graceful degradation for non-critical functions
  - Implement manual fallback procedures for SLA-critical operations
  - _Requirements: 10.3, 10.4, 10.6_

- [ ] 19. Build data privacy and retention compliance
  - Implement GDPR data minimization with documented legal basis
  - Create automated data retention and deletion workflows
  - Build user data access and export functionality
  - Implement privacy notice delivery and consent management
  - _Requirements: 14.1, 14.2, 14.4, 14.5_

- [ ] 20. Implement comprehensive testing suite
  - Contract tests against Transparency DB API; assert schema & 4xx/5xx handling
  - Misuse tests (repeat infringers, manifestly unfounded reporters → suspensions)
  - Age-verification tests (no raw ID persists; token replay prevention) per blueprint
  - ePrivacy tests: GPS only after consent; no fingerprinting without consent
  - Create unit tests for all service layers with DSA compliance validation
  - Build integration tests for end-to-end workflows
  - Implement performance tests for 10,000+ concurrent operations
  - Create security tests for authentication, authorization, and audit integrity
  - _Requirements: All requirements validation_

- [ ] 21. Build monitoring and observability
  - Implement real-time performance monitoring with SLA dashboards
  - Create error tracking and alerting for compliance violations
  - Build audit trail integrity monitoring with automated verification
  - Implement capacity planning metrics for scaling decisions
  - _Requirements: 5.5, 6.6, 10.5_

- [ ] 22. Create deployment and configuration management
  - Set up environment-specific configurations for development, staging, production
  - Implement secure credential management for external service integrations
  - Create database migration and rollback procedures
  - Build health check endpoints for all services
  - _Requirements: 10.7_

- [ ] 23. Integrate with existing GrowBro community features
  - Connect reporting system to existing post and comment components
  - Integrate age-gating with current user authentication flow
  - Wire moderation decisions to content visibility controls
  - Connect geo-restrictions to existing location-based features
  - _Requirements: 1.1, 8.7, 9.4_

- [ ] 24. Implement final compliance validation and documentation
  - Validate all DSA article requirements against implementation
  - Create compliance documentation for legal review
  - Build operator runbooks for incident response
  - Conduct final security audit and penetration testing
  - _Requirements: All DSA compliance requirements_

## Additional Implementation Notes

### SoR Outbox Table (Postgres)

```sql
CREATE TABLE sor_outbox (
  id UUID PRIMARY KEY,
  decision_id UUID NOT NULL,
  payload JSONB NOT NULL,          -- already redacted
  attempt_count INT DEFAULT 0,
  last_error TEXT,
  status TEXT CHECK (status IN ('pending','sent','failed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX ON sor_outbox(decision_id);
```

### User-facing SoR Fields Checklist (Art. 17)

- Facts & circumstances
- Ground: law (with reference) or Terms/Guidelines
- Whether automation was used (detection/decision)
- Action taken & scope (incl. geo scope)
- Redress: internal complaint (Art. 20), ODS (Art. 21), court

### DSA Compliance References

- **Art. 16**: Notice-and-Action mandatory fields
- **Art. 17**: Statement of Reasons to users
- **Art. 20**: Internal complaint handling
- **Art. 21**: Out-of-court dispute settlement
- **Art. 22**: Trusted flaggers priority lane
- **Art. 23**: Measures against misuse
- **Art. 24(5)**: SoR submission to Commission Transparency Database
- **Art. 28**: Protection of minors with age verification
