# Implementation Plan

- [ ] 1. Set up core Sentry SDK integration with production-grade configuration

  - Install @sentry/react-native with Expo plugin following official Expo Sentry guide
  - Configure Sentry.init with reactNavigationIntegration({ enableTimeToInitialDisplay: true })
  - Set up environment-specific configuration with proper release, dist, and environment from Expo env vars
  - Lock Sentry organization to EU region (Frankfurt) for GDPR compliance - cannot be changed later
  - Create integration smoke test to verify SDK initialization and basic error capture
  - _Requirements: 1.2, 1.3, 6.1, 8.4_

- [ ] 2. Implement comprehensive error tracking with Hermes symbolication
- [ ] 2.1 Configure Debug IDs and source map upload for Hermes

  - Enable Metro Debug ID plugin for resilient Hermes symbolication across EAS builds
  - Set up automatic source map upload with Debug IDs via sentry-expo-upload-sourcemaps
  - Create Hermes checklist: Metro plugin present, Debug ID in logs, CLI --wait verification
  - Implement CI check to verify Debug ID injection in bundle (grep "Bundle Debug ID")
  - _Requirements: 6.1, 6.2_

- [ ] 2.2 Configure native symbolication for iOS and Android

  - Set up iOS dSYM upload via Xcode build phases with automatic processing
  - Configure Android ProGuard/R8 mapping upload via Sentry Android Gradle Plugin
  - Add CI verification that native symbols are uploaded and processed
  - Fail build on missing symbolication artifacts with clear error messages
  - _Requirements: 6.1, 6.2_

- [ ] 2.3 Add enhanced debugging context and breadcrumbs

  - Implement navigation breadcrumbs for screen transitions and deep linking
  - Add network state, connectivity, and battery status breadcrumbs
  - Create custom tags: user_tier, device_tier, offline_queue_len, playbook_id, ai_model_version
  - Implement beforeBreadcrumb filtering to reduce noise and focus on actionable data
  - _Requirements: 6.4_

- [ ] 3. Set up performance monitoring with Mobile Vitals and SLO tracking
- [ ] 3.1 Configure comprehensive performance transactions

  - Implement app startup tracking with SLO comments: // SLO: TTID p95 ≤ 2s on mid-tier Android
  - Add navigation performance monitoring with p90/p95 targets per device tier
  - Create sync operation performance tracking (pull/push) with distributed tracing
  - Implement AI assessment performance monitoring with image I/O and inference timing
  - _Requirements: 3.1, 3.6_

- [ ] 3.2 Enable Mobile Vitals with platform-aware thresholds

  - Configure slow frames (>16.7ms at 60Hz) and frozen frames (>700ms) tracking
  - Enable Frames Delay tracking for more actionable performance insights
  - Set up profiling with 0.1 sample rate for function-level hotspot analysis
  - Implement WatermelonDB query performance tracking with custom instrumentation
  - _Requirements: 3.1, 3.5, 8.1_

- [ ] 4. Implement Session Replay with privacy-first defaults
- [ ] 4.1 Configure Session Replay with aggressive privacy masking

  - Enable Session Replay with replaysSessionSampleRate=0.05 and replaysOnErrorSampleRate=1.0
  - Implement aggressive masking for all text inputs and images by default
  - Create explicit blocklist for auth, payments, and profile screens
  - Configure sendDefaultPii=false and validate masking before production deployment
  - _Requirements: 4.1, 4.2, 8.4_

- [ ] 4.2 Set up privacy compliance and data residency

  - Configure org-wide server-side PII scrubbing rules and Advanced Scrubbing
  - Create privacy checklist for auth, payments, profile screens with QA validation
  - Implement surgical allowlists for non-sensitive screens only when needed
  - Document that EU region cannot be changed later - include in org setup runbook
  - _Requirements: 4.4, 8.4_

- [ ] 5. Create CI/CD quality gates with strict validation
- [ ] 5.1 Implement build-time prerequisite validation

  - Create script to validate Sentry configuration (DSN, environment, release, dist)
  - Add Metro plugin presence check and Debug ID verification in CI logs
  - Implement source map and symbol upload verification with sentry-cli --wait
  - Run sentry-cli sourcemaps explain against known event fixture to prove symbolication
  - _Requirements: 2.1, 2.2, 2.5_

- [ ] 5.2 Add pre-deployment health validation with SLO alignment

  - Create script to query Sentry Sessions API for previous release health metrics
  - Implement SLO validation: crash-free sessions ≥ 99.9%, users ≥ 99.95%
  - Add ANR rate validation against Android Vitals 0.47% DAU bad-behavior threshold
  - Block deployment promotion when previous release fails SLO requirements
  - _Requirements: 2.5, 2.6, 8.1_

- [ ] 5.3 Set up staged rollout auto-pause with Play Console integration

  - Implement Play Developer API integration to update userFraction or halt releases
  - Create auto-pause logic when SLOs breached for ≥30min at >10% adoption
  - Add dry-run script for rollout pause procedures before production use
  - Create incident automation with Sentry Release page links and context
  - _Requirements: 1.4, 1.5_

- [ ] 6. Implement comprehensive alerting with noise reduction
- [ ] 6.1 Configure Sentry metric alerts for SLO monitoring

  - Create metric alerts for crash-free sessions/users, ANR rate, slow/frozen frames
  - Set up performance alerts for cold start p95 and frames delay thresholds
  - Configure alert routing: critical to PagerDuty/Opsgenie, others to Slack/email
  - Document 5-minute escalation ladder from primary to secondary on-call
  - _Requirements: 7.1, 7.2, 8.1_

- [ ] 6.2 Set up issue alerts with intelligent grouping

  - Configure issue alerts for error bursts, regressions, and new issues
  - Implement Sentry grouping and fingerprint tuning to reduce alert noise
  - Create weekly alert hygiene process for threshold tuning and rule consolidation
  - Set up non-critical issue routing to Slack and email with appropriate context
  - _Requirements: 7.3, 7.4_

- [ ] 7. Create synthetic monitoring with Maestro and Sentry Monitors
- [ ] 7.1 Develop minimal, stable Maestro test flows

  - Create App Start resilience probe: Launch → Authentication → Agenda render
  - Implement Offline Sync flow: Toggle offline → Create task → Sync verification
  - Build AI Assessment flow: Camera access → Photo capture → Analysis result
  - Add stable testIDs, fixture accounts, and deterministic seeds for reliability
  - _Requirements: 5.1, 5.5_

- [ ] 7.2 Integrate Maestro with Sentry Cron Monitors as single source of truth

  - Set up Maestro Cloud execution: staging every 15min, production hourly
  - Implement Sentry Cron Monitor check-ins with pass/fail status and duration
  - Add failure artifact collection (screenshots, logs) linked to Sentry alerts
  - Configure 1 retry policy before alerting to reduce false positives
  - _Requirements: 5.2, 5.3, 5.4_

- [ ] 8. Set up distributed tracing for end-to-end visibility
- [ ] 8.1 Configure mobile-to-backend trace propagation

  - Implement Sentry trace header propagation (sentry-trace, baggage) to API calls
  - Configure tracePropagationTargets for Supabase/Edge Function domains to avoid CORS
  - Set up Supabase Edge Functions to accept and continue traces from mobile
  - Create integration test asserting span correlation across mobile and backend
  - _Requirements: 3.2, 3.4_

- [ ] 8.2 Validate distributed tracing on native platforms

  - Verify iOS/Android SDKs attach headers by default with target whitelisting
  - Test trace propagation across native networking and React Native bridge
  - Ensure trace headers appear on incoming backend requests with proper correlation
  - Document distributed tracing setup and troubleshooting procedures
  - _Requirements: 3.2, 3.4_

- [ ] 9. Implement release health monitoring with EAS integration
- [ ] 9.1 Create automated release health tracking

  - Set up automatic release creation with EAS build metadata and commit association
  - Implement session tracking with crash-free metrics calculation and trending
  - Create adoption rate monitoring for staged rollouts with real-time updates
  - Build release health dashboard integrated with EAS dashboard for unified view
  - _Requirements: 1.1, 1.6, 8.1_

- [ ] 9.2 Configure SLO tracking and reporting dashboards

  - Create Release Health dashboard with crash-free metrics, ANR, frames delay, TTID/TTFD
  - Implement SLO dashboard with owner assignments and action thresholds per tile
  - Set up automated SLO reporting for stakeholders with trend analysis
  - Add device-tiered performance targets with clear success criteria in code comments
  - _Requirements: 8.1, 8.5_

- [ ] 10. Optimize sampling and quota management for cost control
- [ ] 10.1 Implement environment-specific sampling with cost awareness

  - Configure production sampling: tracesSampleRate=0.2, profilesSampleRate=0.1, replaysSessionSampleRate=0.05
  - Set up staging with higher sampling for comprehensive testing and debugging
  - Implement dynamic sampling during incidents to prevent quota burn
  - Create quota monitoring with budget alerts and usage trend analysis
  - _Requirements: 8.3_

- [ ] 10.2 Add intelligent spike protection and retention policies

  - Configure Sentry rate limits and spike protection for incident scenarios
  - Implement intelligent sampling based on error rates, traffic patterns, and criticality
  - Create cost monitoring dashboard with budget alerts and optimization recommendations
  - Optimize retention policies for different data types (errors, performance, replay)
  - _Requirements: 8.3_

- [ ] 11. Create comprehensive testing and validation suite
- [ ] 11.1 Write unit tests for monitoring components

  - Test Sentry SDK initialization with all configuration options and error scenarios
  - Create tests for error capture, context attachment, and breadcrumb functionality
  - Test performance transaction creation, timing accuracy, and tag attachment
  - Validate privacy masking, PII scrubbing, and compliance features
  - _Requirements: All requirements validation_

- [ ] 11.2 Implement integration tests for end-to-end monitoring flows

  - Test complete error reporting flow from app crash to Sentry alert delivery
  - Validate performance data collection, processing, and alerting workflows
  - Test session replay capture, privacy masking, and artifact availability
  - Verify CI quality gates, deployment blocking, and rollout pause functionality
  - _Requirements: All requirements validation_

- [ ] 12. Set up operational documentation and incident response
- [ ] 12.1 Create comprehensive runbooks for incident response

  - Document alert investigation procedures with Sentry navigation (Release, Issues, Performance, Replay)
  - Create rollout pause and rollback procedures with Play Console API integration
  - Write post-incident analysis templates with root cause analysis framework
  - Document escalation procedures, contact information, and communication protocols
  - _Requirements: 7.5_

- [ ] 12.2 Create monitoring configuration and troubleshooting documentation
  - Document all Sentry configuration options, rationale, and environment differences
  - Create troubleshooting guides for symbolication, performance, and alerting issues
  - Write deployment and release process documentation with quality gate explanations
  - Document SLO definitions, measurement procedures, and threshold rationale
  - _Requirements: All requirements documentation_
