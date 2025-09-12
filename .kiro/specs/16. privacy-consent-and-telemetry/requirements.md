# Requirements Document

## Introduction

The Privacy Consent and Telemetry feature provides comprehensive privacy management capabilities for GrowBro users, ensuring GDPR compliance and transparent data handling. This system enables granular consent management for different data processing purposes, multilingual legal documentation, and robust data retention controls. The feature emphasizes user control, data minimization principles, regulatory compliance, and follows EDPB guidelines for mobile applications.

## Requirements

### Requirement 1

**User Story:** As a GrowBro user, I want to provide granular consent for different data processing purposes, so that I have full control over how my personal data is used.

#### Acceptance Criteria

1. WHEN the user first opens the app THEN the system SHALL present separate, independent toggles for: (a) Telemetry/analytics (non-essential), (b) Experiments/feature flags, (c) AI training images (distinct from diagnosis), (d) Crash diagnostics (minimal, essential only)
2. WHEN presenting consent options THEN the system SHALL make "Reject all" as easy and prominent as "Accept all" per EDPB requirements
3. WHEN the user selects consent preferences THEN the system SHALL store proof of consent including purpose, UI surface (first-run/settings), policy version, timestamp, and controller identity per Art. 7(1)
4. WHEN consent is granted for any purpose THEN the system SHALL initialize relevant SDKs only after consent is given, deferring initialization and blocking network calls pre-consent
5. WHEN the user denies any consent THEN the system SHALL NOT degrade core functionality (no detriment principle)
6. WHEN storing consent THEN the system SHALL maintain consent version tracking and only re-consent on material changes to purposes or lawful basis

### Requirement 2

**User Story:** As a privacy-conscious user, I want to withdraw my consent for specific purposes at any time, so that I can maintain control over my data processing preferences.

#### Acceptance Criteria

1. WHEN the user accesses privacy settings THEN the system SHALL display current consent status for each purpose with withdrawal as easy as giving consent per Art. 7(3)
2. WHEN the user withdraws consent for a specific purpose THEN the system SHALL immediately stop collection, emit a single opt_out_ack event locally (not server-logged), and propagate to processors
3. WHEN consent is withdrawn THEN the system SHALL initiate queued erasure with processors (e.g., Sentry/Supabase) where applicable
4. WHEN withdrawal occurs THEN the system SHALL offer one-tap delete of historical analytics/training data with visible SLA (≤30 days) and audit log entry
5. WHEN training image consent is withdrawn THEN the system SHALL maintain AI diagnosis functionality while stopping training data collection
6. WHEN any consent is withdrawn THEN the system SHALL NOT degrade core app functionality or apply detriment

### Requirement 3

**User Story:** As a user in Germany or English-speaking regions, I want to read privacy information in my preferred language, so that I can make informed decisions about my data.

#### Acceptance Criteria

1. WHEN the user's device language is German THEN the system SHALL display all legal texts in German
2. WHEN the user's device language is English or unsupported THEN the system SHALL display legal texts in English
3. WHEN displaying consent forms THEN the system SHALL show plain-language purpose notices with lawful basis, retention, recipients, and transfer info per Arts. 13/14
4. WHEN explaining image processing THEN the system SHALL explicitly state that image processing is personal data and when it leaves the device (diagnosis vs training pool)
5. WHEN presenting legal information THEN the system SHALL version the texts and only re-consent on material changes to purposes or lawful basis
6. WHEN showing privacy information THEN the system SHALL use plain language following CNIL mobile app guidance for clarity

### Requirement 4

**User Story:** As a data controller, I want to implement retention policy controls and data minimization, so that the app complies with GDPR and privacy regulations.

#### Acceptance Criteria

1. WHEN collecting data THEN the system SHALL enforce concrete retention windows: Raw telemetry 90d → aggregated; crash logs 180d; training images 365d or until withdrawal; temp inference images ≤24h
2. WHEN processing telemetry THEN the system SHALL use schema guardrails: no free text, no image URIs, no precise timestamps if buckets suffice, rotate pseudonymous IDs with daily salt
3. WHEN implementing data minimization THEN the system SHALL use sampling and rate limits for all data collection
4. WHEN processing images THEN the system SHALL purge temporary inference images within 24 hours and separate diagnosis from training data collection
5. WHEN collecting analytics THEN the system SHALL aggregate and anonymize data following ICO data minimization principles
6. WHEN retention periods expire THEN the system SHALL execute automated deletion jobs with verification logs showing success/fail counts

### Requirement 5

**User Story:** As a compliance officer, I want to ensure proper DPA references and deletion cascade validation, so that the app meets regulatory requirements and data integrity standards.

#### Acceptance Criteria

1. WHEN processing data with third parties THEN the system SHALL maintain signed DPAs with processors (Supabase & Sentry), document data locations, and log cascade deletions (DB + blobs + caches)
2. WHEN handling international transfers THEN the system SHALL require SCCs (2021/914) + Transfer Impact Assessment with documented supplementary measures for non-EEA processors
3. WHEN configuring services THEN the system SHALL prefer EU regions (Supabase EU, Sentry EU data residency) and maintain SCC module + TIA references
4. WHEN maintaining compliance THEN the system SHALL keep Records of Processing Activities (Art. 30) for each purpose and SDK in exportable format
5. WHEN processing involves AI diagnosis THEN the system SHALL complete DPIA prior to launch due to computer-vision diagnosis and potential large-scale processing
6. WHEN executing deletions THEN the system SHALL cascade across WatermelonDB + blobs + caches with audit logs and job receipt tracking

### Requirement 6

**User Story:** As a user, I want to easily access and understand my privacy settings, so that I can manage my data preferences without confusion.

#### Acceptance Criteria

1. WHEN accessing Settings → Privacy THEN the system SHALL show current toggles, lawful basis, retention, recipients, transfer mechanism, Export data, and Delete account options
2. WHEN viewing consent options THEN the system SHALL surface impact notes ("What changes when this is off?") for each purpose
3. WHEN managing consents THEN the system SHALL provide toggle controls with immediate effect and GDPR timeline compliance (≤1 month for requests)
4. WHEN requesting data export THEN the system SHALL provide DSR endpoints (/dsr/export, /dsr/delete, /consents/withdraw) with job IDs
5. WHEN initiating account deletion THEN the system SHALL ensure WatermelonDB + blobs cascade deletion with comprehensive audit logging
6. WHEN displaying SDK information THEN the system SHALL maintain a public SDK list (name, role, region, DPA link) and re-check consent on each app start

### Requirement 7

**User Story:** As a compliance officer, I want to establish proper lawful basis mapping and SDK management, so that data processing is legally compliant and auditable.

#### Acceptance Criteria

1. WHEN processing telemetry/experiments/training images THEN the system SHALL use consent as lawful basis (Art. 6(1)(a))
2. WHEN handling crash logs THEN the system SHALL use legitimate interests only if truly essential/minimized, defaulting to consent for mobile ePrivacy compliance
3. WHEN initializing SDKs THEN the system SHALL defer initialization until consent is granted and re-check on each app start
4. WHEN logging compliance events THEN the system SHALL record consent lifecycle (grants/withdrawals), deletion job receipts, and data export job IDs without personal content
5. WHEN managing processors THEN the system SHALL maintain signed DPAs for Supabase and Sentry with EU region configuration and TIA documentation
6. WHEN auditing THEN the system SHALL generate Article-30 records for each purpose/SDK from code annotations

### Requirement 8

**User Story:** As a compliance officer, I want to implement explicit lawful-basis policy for crash diagnostics, so that mobile crash telemetry complies with EU privacy regulations and provides clear legal justification paths.

#### Acceptance Criteria

1. WHEN collecting crash diagnostics THEN the system SHALL default to obtaining explicit user consent for mobile crash telemetry in EU regions per ePrivacy requirements
2. WHEN implementing legitimate interest for crash diagnostics THEN the system SHALL require documented justification, completed DPIA, risk assessment, minimal data scope, and legal sign-off before using LI basis
3. WHEN determining lawful basis THEN the system SHALL implement region detection to automatically apply EU consent requirements vs non-EU legitimate interest defaults
4. WHEN presenting crash telemetry consent THEN the system SHALL provide clear opt-in UI flow with granular consent recording including lawful basis used, timestamp, and policy version
5. WHEN configuring crash telemetry THEN the system SHALL implement configurable feature-flag to disable crash telemetry per-region with audit logging of configuration changes
6. WHEN uploading crash diagnostics THEN the system SHALL record audit logs capturing consent decisions, lawful basis justification, and data minimization scope for each upload
7. WHEN handling consent withdrawal THEN the system SHALL update retention and deletion workflows to reference lawful basis used and implement immediate cessation of crash telemetry collection
8. WHEN processing crash data under legitimate interest THEN the system SHALL enforce essential-only collection with documented necessity assessment and regular LI justification reviews
