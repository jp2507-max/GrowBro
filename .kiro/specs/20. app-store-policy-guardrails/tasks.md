# Implementation Plan

- [ ] 1. Set up core compliance infrastructure and interfaces

  - Create directory structure for compliance services, types, and utilities
  - Define TypeScript interfaces for all compliance components (GeoDetectionService, ContentPolicyScanner, etc.)
  - Set up configuration management for policy rules and regional settings
  - Add "Reviewer Mode" flag (single remote switch) that disables Community, AI Diagnosis, and sharing
  - Create Reviewer Notes screen with app purpose, age gate, geo toggles, support email, privacy URL, and demo credentials
  - _Requirements: 1.1, 1.6, 2.1, 10.1, 10.2_

- [ ] 2. Implement geo-detection service without GPS dependency
- [ ] 2.1 Create region detection utilities with source priority

  - Implement App Store region detection using device locale and store settings
  - Create SIM/MCC country code detection for mobile networks
  - Build backend IP geolocation service integration
  - Write manual country picker component with neutral UI
  - _Requirements: 1.1, 1.2, 1.6_

- [ ] 2.2 Implement policy feature mapping and Conservative Mode

  - Create PolicyFeatures interface and regional feature mapping
  - Implement Conservative Mode logic (read-only community, stronger disclaimers) over full lockouts except where law requires geofencing
  - Apply region policy toggles within ≤5 minutes of foreground/region change (not 24 hours)
  - Add telemetry for region_mode_changed events with audit trail
  - _Requirements: 1.1, 1.2, 1.6_

- [ ] 2.3 Create region validation and caching system

  - Implement region info caching with TTL and confidence scoring
  - Build region compliance validation against policy configuration
  - Create fallback mechanisms for unknown regions defaulting to Conservative Mode
  - Write unit tests for all geo-detection scenarios and edge cases
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [ ] 3. Build content policy scanner for static content and store assets
- [ ] 3.1 Create policy rule engine and pattern matching

  - Implement configurable policy rules with regex, keyword, and ML classifier support
  - Build commerce pattern detection (order/cart/checkout/pickup/delivery/price symbols)
  - Create contact pattern detection (WhatsApp/Telegram handles, phone numbers, "DM to buy")
  - Add cannabis commerce detection (THC mg/€, strain prices, menu references)
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 3.2 Implement multi-surface content scanning

  - Build app strings scanner for EN/DE resources with i18n integration
  - Create store listing content scanner for descriptions and screenshot captions
  - Implement push notification template scanner for policy violations
  - Add release notes and metadata scanning capabilities
  - Flag any copy that could "facilitate sale" (cart/checkout/pickup/price/THC mg/€, "DM to buy", WhatsApp/Telegram/phone)
  - _Requirements: 3.1, 3.2, 3.4_

- [ ] 3.3 Create CI/CD policy linter with build integration

  - Build policy linter that fails CI builds on flagged content
  - Implement human-readable diff output with policy section references
  - Include policy references in CI output (e.g., "Play ▸ Marijuana", "Apple 1.2 UGC")
  - Add waiver system for authorized approvers with justification and audit trail
  - _Requirements: 3.2, 3.5, 5.2, 5.5_

- [ ] 4. Implement legal entity validator for app store submission
- [ ] 4.1 Create Apple App Store validation checks

  - Fail submission if Seller ≠ Organization; require D-U-N-S (Apple)
  - Build support URL, privacy policy URL, and D-U-N-S number validation
  - Create geo-restriction statement requirement for cannabis features
  - Add Apple age rating validation using new tiers (13+/16+/18+)
  - _Requirements: 2.1, 2.3, 2.5, 5.1_

- [ ] 4.2 Create Google Play Store validation checks

  - Implement Play Console "App Content" declarations completeness check
  - Target API 35 enforcement + extension dates (API_35_ENFORCEMENT_DATE_UTC with API_35_EXTENSION_DATE_UTC extension)
  - Photo/Video permissions declaration check for 2025 requirements
  - Add background location permission declaration enforcement
  - _Requirements: 2.1, 2.5, 5.1, 5.4_

- [ ] 4.3 Build submission readiness checker and compliance certificate generator

  - Create comprehensive submission checklist for both Apple and Google
  - Implement compliance certificate generation with all required documentation
  - Build policy reference mapping for specific violations and remediation steps
  - Add submission blocker detection with detailed error messages and citations
  - _Requirements: 2.2, 2.4, 5.3, 5.5_

- [ ] 5. Create disclaimer management system with versioning
- [ ] 5.1 Implement age gate with Apple's 2025 requirements

  - Map content to Apple's global age-rating tiers: 4+ (general), 9+ (mild content), 13+ (mild violence/sexual themes), 16+ (intense violence/sexual themes), 18+ (adult content)
  - Map cannabis and adult-only content to 18+ rating or regional-majority rules (whichever is higher)
  - Create neutral age-verification screen with adult-task gate (randomized Q&A or instruction-following) for purchases, external links, and adult sections per Apple 5.1.1(iv)
  - Implement age-gate bypass rules for educational content access with clear disclaimers
  - Add tasks to localize gating copy and declare age-related capabilities in App Store Connect for each region
  - Build regional age requirement mapping with support for jurisdiction-specific minimum ages
  - Create age verification persistence with configurable TTL and re-verification triggers
  - Implement parental gate mechanisms for under-18 users accessing restricted content
  - Add telemetry tracking for age gate interactions, pass/fail rates, and bypass usage
  - _Requirements: 4.1, 4.4, 4.5, 5.1.1(iv)_

- [ ] 5.2 Build contextual disclaimer injection system

  - Create "Educational horticulture guidance only; not medical advice" disclaimers for AI Diagnosis
  - Implement Playbooks disclaimers with jurisdiction-appropriate legal text
  - Build community share disclaimer injection for outbound content
  - Add cultivation content disclaimers with educational focus
  - _Requirements: 4.2, 4.3, 4.5_

- [ ] 5.3 Implement disclaimer versioning and re-acknowledgment

  - Create disclaimer version tracking with user acknowledgment history
  - Build forced re-acknowledgment system when disclaimer text changes
  - Implement privacy notice alignment with App Privacy disclosures
  - Add share sheet disclaimer appending for all outbound content
  - _Requirements: 4.4, 4.5, 9.3, 9.4_

- [ ] 6. Build UGC moderation system for Google Play compliance
- [ ] 6.1 Create pre-publish content filtering

  - Implement commerce/meetup/price/contact pattern detection for user content
  - Build rate limiting system with configurable thresholds
  - Create 15-second undo functionality for published content
  - Add link, phone, and handle obfuscation detection ("p@y", "v3nd", link shorteners)
  - Meet baseline requirements for both Apple 1.2 and Play UGC policies (robust moderation + reporting/blocking)
  - _Requirements: 8.1, 8.2, 8.5_

- [ ] 6.2 Implement reporting and auto-hide system

  - Create in-app content reporting functionality with reason categorization
  - Build user blocking system with justification tracking
  - Implement configurable auto-hide threshold (e.g., 3 reports triggers auto-hide)
  - Add moderator queue with pending content review workflow
  - _Requirements: 8.2, 8.3, 8.5_

- [ ] 6.3 Create appeals process and moderation metrics

  - Build appeals system for moderation decisions with user-friendly interface
  - Implement moderator tooling with decision tracking and audit trails
  - Create UGC moderation metrics dashboard (reports, auto-hides, appeals, SLA breaches)
  - Add SLA telemetry: track time-to-action, auto-hide triggers, appeals outcomes; alert on breaches
  - _Requirements: 8.4, 8.5, 6.2, 6.4_

- [ ] 7. Implement build pipeline compliance automation
- [ ] 7.1 Create automated policy compliance validator

  - Build comprehensive build-time policy compliance checker
  - Target API gate: hard-fail builds if target < API 35 after API_35_ENFORCEMENT_DATE_UTC; show deadline + extension info
  - Apple age rating gate: verify the new age rating matches the in-app gate
  - Account deletion gate (Apple 5.1.1(v)): fail builds if account can be created but not deleted in-app
  - Photos & Videos policy (Play 2025): require declaration or migrate to Photo Picker; block release if missing
  - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [ ] 7.2 Build submission gate validation

  - Implement legal entity requirement validation before build submission
  - Create policy reference citation system for build failures
  - Build actionable remediation guidance with specific policy sections
  - Add compliance certificate generation for successful builds
  - _Requirements: 5.2, 5.3, 5.5, 2.2_

- [ ] 8. Create privacy and data protection features
- [ ] 8.1 Implement photo privacy protection

  - Build EXIF GPS data stripping for all photo uploads by default
  - Create explicit opt-in system for cloud processing with clear consent
  - Implement local inference first; explicit opt-in for cloud processing
  - Add data purge functionality for user privacy control
  - Align with Play Data Safety answers and App Privacy disclosures
  - _Requirements: 9.1, 9.2, 9.4_

- [ ] 8.2 Build privacy disclosure alignment system

  - Create App Privacy answers and Play Data Safety declaration comparison
  - Implement discrepancy detection and reporting for privacy misalignment
  - Build data minimization compliance checker for all data collection
  - Add privacy policy URL validation and accessibility verification
  - _Requirements: 9.4, 9.5, 2.1_

- [ ] 9. Implement compliance monitoring and alerting system
- [ ] 9.1 Create Policy Dashboard with real-time metrics

  - Build age-gate pass rate tracking with regional breakdown
  - Implement region mode distribution monitoring (Normal/Conservative/Restricted)
  - Create policy-blocked content attempt tracking by type and severity
  - Add % low-confidence AI share (to trigger "ask community" fallback)
  - Add UGC moderation SLA compliance dashboard with breach alerts
  - _Requirements: 6.1, 6.3, 6.4, 6.5_

- [ ] 9.2 Build automated alerting and issue creation

  - Auto-issues: open Jira/GitHub with policy citation + reproduction steps when a violation fires
  - Create automated alerts for critical compliance failures and SLA breaches
  - Build policy compliance status change notifications for stakeholders
  - Add compliance metrics threshold monitoring with proactive alerting
  - _Requirements: 6.1, 6.2, 6.4_

- [ ] 10. Create reviewer mode and kill switches for app store review
- [ ] 10.1 Implement secure remote flag system with cryptographic verification

  - Create master kill switch to disable Community + AI Diagnosis + sharing simultaneously
  - Build Reviewer Notes screen with app purpose, compliance measures, and contact info
  - Implement Conservative Mode demonstration for app store reviewers
  - **Require signed remote configs**: Verify cryptographic signature (ECDSA P-256) before applying any remote policy changes
  - **Enforce TLS certificate pinning**: Pin server certificates for config endpoints to prevent MITM attacks
  - **Implement encrypted local storage**: Store last-known-good policy in encrypted local storage (AES-256-GCM) with atomic fallback mechanism
  - **Default to Conservative Mode**: Automatically enter Conservative Mode on first-run or when no valid cached policy exists
  - **Create immutable audit log**: Append every toggle/remote-policy-apply to secure audit log with timestamp, actor/service ID, action, policy version, and verification result
  - Add feature flag system with remote config for instant policy changes without app updates
  - Implement secure key rotation for signing keys with automated certificate renewal
  - _Requirements: 7.1, 7.3, 7.5, Security hardening_

- [ ] 10.2 Build reviewer documentation and compliance demonstration

  - Create comprehensive reviewer notes with policy compliance explanations and demo access
  - Implement geo-restriction demonstration for cannabis features
  - Build age gate and disclaimer showcase for reviewer testing
  - Add support URL, privacy policy, and legal entity information display
  - Include quick path to test Conservative Mode and geo restrictions per Apple guidance
  - _Requirements: 10.1, 10.2, 10.4, 10.5_

- [ ] 11. Implement audit trail and compliance reporting
- [ ] 11.1 Create comprehensive audit logging system

  - Build ComplianceEvent logging for all policy-related actions
  - Add entities: ComplianceWaiver, RegionModeChange, PolicyLintFinding for audit trail
  - Implement ComplianceWaiver tracking with approver and justification
  - Create RegionModeChange logging with feature impact tracking
  - Add PolicyLintFinding storage for build-time violation history
  - _Requirements: 1.6, 3.5, 6.5, 8.5_

- [ ] 11.2 Build compliance reporting and analytics

  - Create periodic compliance reports with violation trends and metrics
  - Implement policy effectiveness analysis with recommendation generation
  - Generate submission packet (Apple/Play checklists + citations) alongside compliance certificate
  - Add compliance certificate generation with all required attestations
  - _Requirements: 6.5, 2.4, 5.3_

- [ ] 12. Create end-to-end testing and validation suite
- [ ] 12.1 Build comprehensive policy compliance test suite

  - "Reviewer Run" script: flips all kill switches, sets conservative region, verifies UGC report/block, runs account-deletion flow, validates store-listing scans, and asserts target API/age rating gates
  - Implement region-based policy testing across different jurisdictions
  - Build UGC moderation workflow testing with report/block/appeal scenarios
  - Add policy regression tests: seed strings for Play Marijuana violations to ensure linter catches them after copy changes
  - _Requirements: All requirements validation_

- [ ] 12.2 Implement performance and security testing
  - Create geo-detection performance testing without GPS dependency
  - Build content scanning performance tests for large content volumes
  - Implement security testing for privacy data handling and audit trails
  - Add load testing for UGC moderation system under high report volumes
  - _Requirements: Performance and security validation across all components_
