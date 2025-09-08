# Implementation Plan

- [ ] 1. Set up core consent management infrastructure

  - Create ConsentService with granular purpose controls and GDPR-compliant storage
  - Implement consent state management with version tracking and audit logging
  - _Requirements: 1.1, 1.3, 1.5, 7.4_

- [ ] 1.1 Create ConsentService core interface and storage

  - Write ConsentService class with getConsents(), hasConsent(), setConsent(), withdrawConsent() methods
  - Implement secure consent storage using AsyncStorage/MMKV with encryption
  - Create ConsentState interface with telemetry, experiments, aiTraining, crashDiagnostics toggles
  - _Requirements: 1.1, 1.3, 7.4_

- [ ] 1.2 Implement consent metadata and audit logging

  - Create ConsentMetadata interface without IP address storage (data minimization)
  - Implement ConsentAuditLog with purpose, UI surface, policy version, timestamp tracking
  - Write consent lifecycle event logging (grants/withdrawals) for compliance auditing
  - _Requirements: 1.3, 7.4_

- [ ] 1.3 Create consent validation and lawful basis mapping

  - Implement lawfulBasisByPurpose map (telemetry: consent, experiments: consent, aiTraining: consent, crashDiagnostics: consent - default to consent for mobile SDKs)
  - Write validation logic for consent requirements and legal basis mapping
  - Create consent change detection to trigger re-consent only on purpose/lawful-basis change (not copy edits)
  - _Requirements: 1.6, 3.6, 7.1, 7.2_

- [ ] 1.4 Build consent proof logging system

  - Create consent proof log exporter (purpose, timestamp, policy version, UI surface)
  - Implement audit trail without IP storage (data minimisation compliance)
  - Write consent lifecycle tracking for regulatory evidence
  - _Requirements: 1.3, 7.4_

- [ ] 2. Implement SDK gating and initialization control

  - Create SDKGate service to block unauthorized SDK initialization and network calls
  - Implement deferred SDK loading based on consent status
  - Build SDK inventory management with transparency features
  - _Requirements: 1.4, 1.5, 7.3_

- [ ] 2.1 Create SDKGate core functionality with strict pre-consent blocking

  - Write SDKGate class with initializeSDK() as no-op until consent true, blockSDK(), isSDKAllowed() methods
  - Implement startup SDK audit that asserts "0 initialised without consent" for CNIL compliance
  - Create SDK status tracking and lifecycle management with consent-based gating
  - _Requirements: 1.4, 7.3_

- [ ] 2.2 Build SDK inventory and transparency system

  - Create SDKInventoryItem interface with name, purpose, region, DPA link tracking
  - Implement public SDK inventory endpoint (/legal/processors.json) for transparency
  - Write SDK status monitoring and consent re-checking on app start
  - _Requirements: 6.6, 7.3_

- [ ] 2.3 Implement network request interception safety net

  - Create network request filtering as backup to SDK initialization blocking
  - Write request validation against consent status before allowing network calls
  - Block background retries and cached beacons until consent flips to true
  - _Requirements: 1.4, 1.5_

- [ ] 3. Create privacy-compliant telemetry system

  - Implement TelemetryClient with strict schema validation and data minimization
  - Build telemetry queue management with offline support and consent-aware processing
  - Create pseudonymous ID rotation and PII prevention mechanisms
  - _Requirements: 4.2, 4.3, 4.5_

- [ ] 3.1 Build TelemetryClient with strict schema validation

  - Write TelemetryClient class with track(), identify(), flush(), clearQueue() methods
  - Implement strict TelemetryValue type (number, boolean, Date only - remove generic string, allow enums only via zod)
  - Create Zod schema validation to drop non-conforming events automatically
  - _Requirements: 4.2, 4.3_

- [ ] 3.2 Implement telemetry queue and privacy controls

  - Create local telemetry queue with offline caching and backoff mechanisms
  - Implement pseudonymous ID rotation with daily salt for privacy protection
  - Add burst rate-limit (e.g., 10/min/source) and sampling (e.g., 25%) toggled by remote config
  - _Requirements: 4.2, 4.5_

- [ ] 3.3 Create telemetry consent integration

  - Integrate TelemetryClient with ConsentService for real-time consent checking
  - Implement immediate queue clearing on consent withdrawal
  - Write consent-aware event processing with purpose validation
  - _Requirements: 2.2, 2.4, 4.5_

- [ ] 4. Build automated data retention and lifecycle management

  - Implement RetentionWorker with automated data purging and aggregation
  - Create retention policy enforcement with concrete time windows
  - Build deletion cascade validation across all data stores
  - _Requirements: 4.1, 4.2, 4.6, 5.6_

- [ ] 4.1 Create RetentionWorker with verifiable purge reporting

  - Write RetentionWorker class with processRetention() and automated scheduling
  - Implement DEFAULT_RETENTION policies (90d telemetry→aggregate, 180d crash logs, 1d inference images, 365d training images)
  - Emit PurgeReport object each run (counts by DataType + purpose + duration) and fail CI if report is stale >48h
  - _Requirements: 4.1, 4.2, 4.6_

- [ ] 4.2 Implement data aggregation and anonymization

  - Write telemetry data aggregation logic for raw→aggregated transformation after 90 days
  - Implement crash log anonymization with PII stripping after 180 days
  - Create data bucketing and statistical aggregation for privacy protection
  - _Requirements: 4.2, 4.6_

- [ ] 4.3 Build deletion cascade validation with tamper-evident audit

  - Implement cascading deletion across WatermelonDB, file system, and cloud storage
  - Write deletion verification with audit logging and success/failure tracking
  - Add tamper-evident audit (hash chain over job entries) for regulator-friendly evidence
  - _Requirements: 5.6, 2.3, 2.4_

- [ ] 5. Create consent UI components with GDPR compliance

  - Build ConsentModal with equal prominence for Accept/Reject all options
  - Implement PrivacySettings with granular toggle controls and impact explanations
  - Create multilingual legal text display (EN/DE) with plain language explanations
  - _Requirements: 1.2, 3.1, 3.2, 6.1, 6.2, 6.3_

- [ ] 5.1 Build ConsentModal with EDPB-compliant equal prominence design

  - Create ConsentModal component with "Reject all" button visually equal to "Accept all"
  - Implement independent toggles for telemetry, experiments, AI training, crash diagnostics
  - Add "What changes when off?" explanation per toggle for user clarity
  - _Requirements: 1.1, 1.2, 3.3, 3.4_

- [ ] 5.2 Create PrivacySettings with one-click withdrawal

  - Build PrivacySettings component with current consent status display
  - Implement one-click withdrawal in Settings (no friction) with immediate effect
  - Create data export and account deletion request interfaces with GDPR timeline compliance
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 5.3 Implement multilingual legal text with transparency requirements

  - Create legal text management with EN/DE language support based on device locale
  - Surface lawful basis, retention, recipients, transfers in plain EN/DE per Arts. 13/14
  - Version legal texts and only re-prompt on material change (not copy edits)
  - _Requirements: 3.1, 3.2, 3.5, 3.6_

- [ ] 6. Integrate vendor SDKs with GDPR compliance

  - Configure Supabase with EU region and DPA compliance
  - Set up Sentry with EU data residency and PII scrubbing
  - Implement consent-aware SDK initialization and configuration
  - _Requirements: 5.1, 5.3, 7.5, 7.6_

- [ ] 6.1 Configure Supabase for GDPR compliance

  - Set up Supabase client with EU region (eu-west-1) configuration
  - Implement DPA reference storage and SCC 2021/914 module documentation
  - Create Supabase integration with consent-aware data processing and RLS policies
  - _Requirements: 5.1, 5.3, 7.5_

- [ ] 6.2 Configure Sentry with strict consent-based initialization

  - Initialize Sentry with enabled: consents.crashDiagnostics, sendDefaultPii: false
  - Configure beforeSend PII scrubbing and enable EU data residency
  - Implement ReactNativeTracing only when consents.telemetry is true
  - _Requirements: 5.1, 5.3, 7.5, 7.6_

- [ ] 6.3 Create processor transparency with SCC/TIA validation

  - Build DPA Manager persisting SCC module IDs (2021/914) and TIA references per processor
  - Implement /legal/processors.json publishing name, purpose, region, DPA link, SCC/TIA for transparency
  - Block release if any non-EEA processor lacks SCC/TIA documentation
  - _Requirements: 5.1, 5.4, 6.6_

- [ ] 7. Implement AI image processing with consent separation

  - Separate AI diagnosis from AI training data flows with different consent requirements
  - Create ephemeral inference image handling with 24-hour auto-purge
  - Build training image consent management with one-tap deletion capability
  - _Requirements: 2.4, 4.4, 4.6_

- [ ] 7.1 Create AI diagnosis with ephemeral image processing

  - Implement AI diagnosis functionality that works without training consent
  - Use pre-signed URLs with short TTL for inference uploads with default purge ≤24h
  - Write inference result processing without persistent image storage
  - _Requirements: 4.4, 4.6_

- [ ] 7.2 Build AI training image consent system with deletion receipts

  - Create training bucket tagged with consent_version for audit trail
  - Implement training image collection only with explicit aiTraining consent
  - Write one-tap purge that removes blobs + DB rows and returns deletion receipt
  - _Requirements: 2.4, 4.4_

- [ ] 7.3 Integrate AI services with consent validation

  - Connect AI image processing with ConsentService for real-time consent checking
  - Implement consent-aware image flow routing (diagnosis vs training)
  - Create AI service consent withdrawal handling with immediate data purging
  - _Requirements: 2.4, 4.4_

- [ ] 8. Build compliance monitoring and audit system

  - Implement DPIA artifact management with CI validation
  - Create ROPA (Records of Processing Activities) auto-generation from code annotations
  - Build compliance validation and audit logging for regulatory requirements
  - _Requirements: 5.4, 5.5, 7.4, 7.6_

- [ ] 8.1 Create DPIA management with release blocking

  - Implement DPIA artifact storage with version and AI model version tracking
  - Block release if DPIA not signed for the current AI model version
  - Create DPIA mitigation tracking and implementation validation
  - _Requirements: 5.5_

- [ ] 8.2 Build ROPA auto-generation from code annotations

  - Create code annotation system for purpose, lawful basis, data categories, recipients, retention
  - Emit Article-30 CSV/JSON from code annotations (purpose, basis, data categories, recipients, retention)
  - Write ROPA validation and compliance checking for Article 30 requirements
  - _Requirements: 5.4, 7.6_

- [ ] 8.3 Implement append-only audit logging with integrity

  - Create append-only AuditLog with integrity hash and export capability
  - Write audit log validation and integrity checking for regulatory compliance
  - Implement audit log export functionality for compliance reporting
  - _Requirements: 7.4, 5.6_

- [ ] 9. Create data subject rights (DSR) endpoints

  - Build data export functionality with comprehensive user data collection
  - Implement account deletion with cascading data removal validation
  - Create consent withdrawal propagation to external processors
  - _Requirements: 6.4, 6.5, 2.3, 5.6_

- [ ] 9.1 Build data export system with in-app delivery

  - Create /dsr/export endpoint with job ID tracking and GDPR timeline compliance (≤30 days)
  - Export delivers in-app download (avoid email PII risks), includes evidence (consents, audit logs, retention reports)
  - Write data export formatting and delivery with audit logging
  - _Requirements: 6.4_

- [ ] 9.2 Implement account deletion system

  - Create /dsr/delete endpoint with cascading deletion across WatermelonDB, file system, cloud storage
  - Write deletion validation and verification with comprehensive audit trails
  - Implement deletion job tracking and completion notification
  - _Requirements: 6.5, 5.6_

- [ ] 9.3 Create consent withdrawal propagation with job tracking

  - Build /consents/withdraw endpoint with immediate processor notification
  - Consent withdrawal propagates to processors and returns job IDs
  - Do not log any "opt-out ack" server-side (local acknowledgment only)
  - _Requirements: 2.3, 2.4_

- [ ] 10. Write comprehensive test suite for GDPR compliance

  - Create unit tests for consent logic, retention policies, and SDK gating
  - Build integration tests for consent flows, withdrawal propagation, and deletion cascades
  - Implement E2E tests for zero-traffic pre-consent and compliance validation
  - _Requirements: All requirements validation_

- [ ] 10.1 Create consent management unit tests

  - Write tests for ConsentService consent granting, withdrawal, and validation logic
  - Create tests for SDK gating with consent-based initialization blocking
  - Implement retention policy tests with automated data purging validation
  - _Requirements: 1.1-1.6, 2.1-2.6, 4.1-4.6_

- [ ] 10.2 Build integration tests for consent flows

  - Create first-run consent flow tests with "Reject all" prominence validation
  - Write consent withdrawal tests with immediate SDK stopping and deletion job scheduling
  - Implement AI image flow tests separating diagnosis from training consent requirements
  - _Requirements: 1.1, 1.2, 2.2, 2.4, 7.1, 7.2_

- [ ] 10.3 Implement E2E compliance validation tests with mechanical pass/fail

  - Create zero-traffic pre-consent tests: assert no network calls to analytics/crash/A-B endpoints before any consent tap (proxy or packet capture)
  - Write retention verification tests: assert daily PurgeReport freshness + counts; fail build if stale
  - Implement SCC/TIA validation: unit test DPA Manager rejects non-EEA processors missing SCC/TIA
  - Build DPIA validation tests blocking releases without proper documentation
  - _Requirements: 1.4, 4.6, 5.1, 5.3, 5.5_

- [ ] 11. Create iOS Privacy Manifests and App Store compliance

  - Build Apple Privacy Manifests for app and third-party SDKs declaring data collection
  - Document Required-Reasons APIs usage to prevent App Store review blocks
  - Create static checks for privacy manifest completeness and accuracy
  - _Requirements: App Store compliance, iOS privacy requirements_

- [ ] 11.1 Build iOS Privacy Manifests for app and SDKs

  - Create Privacy Manifest declaring data collection purposes and Required-Reasons APIs
  - Document all third-party SDK privacy manifests (Supabase, Sentry, analytics SDKs)
  - Write privacy manifest validation and completeness checking
  - _Requirements: iOS App Store compliance_

- [ ] 11.2 Implement Privacy Manifest static validation

  - Create static check that iOS privacy manifests exist and list all Required-Reasons APIs used
  - Write CI validation for privacy manifest accuracy and completeness
  - Implement privacy manifest update detection for SDK changes
  - _Requirements: iOS App Store compliance_

- [ ] 12. Add EU AI Act compliance monitoring (non-blocking)
  - Map AI features to EU AI Act transparency duties and risk categories
  - Track 2025/2026 phased applicability for AI model compliance
  - Create AI Act compliance documentation and monitoring system
  - _Requirements: EU AI Act future compliance_
