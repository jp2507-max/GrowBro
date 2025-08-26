# Implementation Plan

- [ ] 1. Set up build system compliance infrastructure

  - Create Gradle plugin for targetSdk validation and manifest checking
  - Implement hard-stop build failures for compliance violations
  - Add CI pipeline integration with compliance reporting
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 1.1 Create Gradle compliance plugin

  - Write custom Gradle plugin to enforce targetSdk=35 across all modules
  - Implement validateMergedManifestsForTargetSdk() method with library manifest checking
  - Add static check that refuses releases if targetSdk < 35 with Aug 31, 2025 cutoff and Nov 1, 2025 extension flag path
  - Add build failure logic with Play policy deadline references
  - Create unit tests for Gradle plugin functionality
  - _Requirements: 1.1, 1.2_

- [ ] 1.2 Implement manifest validation system

  - Write scanForRestrictedPermissions() to detect QUERY_ALL_PACKAGES, MANAGE_EXTERNAL_STORAGE
  - Add scanForFgsTypesAndFsi() to detect <service android:foregroundServiceType> and verify matching Play Console declaration
  - Create validation to reject USE_FULL_SCREEN_INTENT unless feature flag core.alarmOrCalling=true
  - Create validation rules for exact alarm permissions with justification requirements
  - Add manifest merger validation during build process
  - Write integration tests for manifest validation scenarios
  - _Requirements: 8.3, 13.1, 13.2_

- [ ] 1.3 Build CI compliance pipeline

  - Create GitHub Actions workflow for compliance checking
  - Implement compliance report generation with actionable recommendations
  - Add build gates that block deployment on policy violations
  - Write automated tests for CI pipeline compliance checks
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 2. Implement runtime permission management system

  - Create PermissionManager class with all required permission handling methods
  - Implement notification permission flow with fallback experiences
  - Add exact alarm permission management with inexact fallbacks
  - Build photo/video permission handling with Selected Photos Access
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 13.1, 13.2, 13.3, 13.4_

- [ ] 2.1 Create notification permission handler

  - Implement isNotificationPermissionGranted() and createChannelsAfterGrant() methods
  - Write logic ensuring app does not create notification channels or posts any notification until POST_NOTIFICATIONS is granted
  - Create in-app reminder badge fallback system for denied/revoked permissions (no notifications)
  - Add in-app primer before system permission prompt
  - Write unit tests asserting zero notifications and zero channel creation before permission grant
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 2.2 Implement exact alarm permission management

  - Create needsExactAlarms() gatekeeper method for permission requests
  - Write requestExactAlarmIfJustified() with Play Console declaration requirements
  - Implement WorkManager/inexact alarm fallback for denied permissions with user-visible timing notes
  - Add graceful degradation logic maintaining reminder functionality when exact alarm permission denied
  - Write integration tests ensuring reminders run with inexact scheduling on permission denial
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 2.3 Build photo/video permission system

  - Implement requestSelectedPhotosAccess() using READ_MEDIA_VISUAL_USER_SELECTED
  - Create showMediaReselectionUI() for Android 14+ reselection flow
  - Add Android Photo Picker integration as default media access method
  - Write CI rules blocking broad READ*MEDIA*\* without justification
  - Create unit tests for photo picker and selected photos access flows
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 2.4 Create storage permission compliance

  - Implement scoped storage usage with app-private directories
  - Add validation to reject QUERY_ALL_PACKAGES requests unless Play-permitted core use case
  - Create <queries> specific intent handling for package visibility by default
  - Write pre-submit manifest scanner for all-files-access rejection
  - Add integration tests for scoped storage functionality
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 2.5 Enforce Photo/Video Permissions policy

  - Default to Photo Picker for all media access (no runtime storage permission required)
  - Implement Selected Photos Access with reselection UI for Android 14+
  - Add CI validation that fails if READ*MEDIA*\* present without local justification.md
  - Create policy compliance documentation for photo/video access patterns
  - Write integration tests for Photo/Video Permissions policy compliance
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 3. Build data safety documentation automation system

  - Create machine-readable data inventory system
  - Implement Data Safety form draft generation
  - Add third-party SDK tracking with Google Play SDK Index validation
  - Build privacy policy synchronization system
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 12.1, 12.2, 12.3, 12.4_

- [ ] 3.1 Create data inventory management system

  - Write DataInventoryItem interface and storage system
  - Implement generateInventory() method for automatic data mapping
  - Create feature × data type × purpose × retention tracking
  - Add JSON-based data inventory as authoritative source
  - Write unit tests for data inventory generation and validation
  - _Requirements: 3.1, 3.2_

- [ ] 3.2 Implement SDK tracking and validation

  - Create validateSdkDisclosuresWithSdkIndex() method
  - Write automatic third-party SDK data practice detection
  - Add version pinning for SDK compliance tracking
  - Implement CI validation against Google Play SDK Index
  - Create integration tests for SDK disclosure validation
  - _Requirements: 3.3, 3.4_

- [ ] 3.3 Build Data Safety form generator

  - Implement createDraftFromInventory() method for form generation
  - Create Play Console Data Safety form structure mapping
  - Add validation ensuring form matches privacy policy disclosures
  - Write CI gates blocking builds if form data is missing/stale
  - Add unit tests for Data Safety form generation accuracy
  - _Requirements: 3.1, 3.4, 12.1, 12.2_

- [ ] 3.4 Create privacy policy synchronization

  - Implement privacy policy URL validation in CI pipeline
  - Write syncWithPrivacyPolicy() method for disclosure alignment
  - Add automated checking that policy explains collection, use, sharing, retention, deletion
  - Create build blocking logic if privacy policy URL is absent
  - Write integration tests for privacy policy sync validation
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 4. Implement UGC moderation system

  - Create comprehensive moderation interface with report/block/mute functionality
  - Build moderation queue with audit logging
  - Add rate limiting and spam detection
  - Implement appeal process and escalation paths
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 4.1 Create user moderation actions

  - Implement reportContent(), blockUser(), muteUser(), deleteOwnContent() methods
  - Add reportGeneratedContent() for future AI-generated content compliance
  - Create UI components making moderation actions visible on all posts/comments
  - Write 5-second SLA server submission logic for reports
  - Add unit tests for all moderation action methods
  - _Requirements: 10.1, 10.2_

- [ ] 4.2 Build moderation queue and audit system

  - Create ModerationQueue class with processReport() and auditAction() methods
  - Implement audit trail logging for all moderation actions
  - Add escalateToHuman() method for complex reports
  - Create moderation dashboard for review team
  - Write integration tests for moderation queue processing
  - _Requirements: 10.2, 10.3_

- [ ] 4.3 Implement rate limiting and spam detection

  - Add rate-limiting logic for report submissions and user actions
  - Create spam detection heuristics for content and user behavior
  - Implement automatic escalation for high-volume violations
  - Write abuse triage SLA documentation and enforcement
  - Add unit tests for rate limiting and spam detection algorithms
  - _Requirements: 10.3_

- [ ] 4.4 Create appeal process system

  - Implement appeal channel described in Help/Policy page
  - Add appeal submission and tracking functionality
  - Create escalation workflow for disputed moderation actions
  - Write clear appeal process documentation for users
  - Add integration tests for complete appeal workflow
  - _Requirements: 10.4_

- [ ] 5. Build account and data deletion system

  - Create in-app account deletion flow accessible in ≤3 taps
  - Implement public web deletion request system
  - Add Data Safety form integration for deletion methods
  - Build deletion audit and compliance tracking
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 5.1 Implement in-app deletion flow

  - Create deleteAccountInApp() method with complete data removal
  - Build UI flow accessible in ≤3 taps from Profile/Settings
  - Add confirmation dialogs and data export options
  - Implement validateDeletionPathAccessibility() testing method
  - Write unit tests for in-app deletion flow and accessibility
  - _Requirements: 9.1, 9.3_

- [ ] 5.2 Create web deletion request system

  - Build public web page for deletion requests
  - Implement requestDeletionViaWeb() API endpoint
  - Add user verification and deletion processing workflow
  - Create deletion request tracking and status updates
  - Write integration tests for web deletion request processing
  - _Requirements: 9.2_

- [ ] 5.3 Integrate deletion methods with Data Safety

  - Implement updateDataSafetyWithDeletionMethods() to reference both paths
  - Add CI validation ensuring deletion methods are documented
  - Create release gate blocking deployment if deletion paths missing
  - Write automated tests validating Data Safety form includes deletion references
  - _Requirements: 9.4_

- [ ] 5.4 Deletion compliance release gate

  - Validate in-app delete path discoverability (≤3 taps from Profile/Settings)
  - Validate web deletion URL present in Play Console Data safety answers
  - Block submission if either deletion method is missing or inaccessible
  - Create automated testing for deletion path accessibility requirements
  - Write compliance checklist for deletion method validation
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 6. Create app access and reviewer system

  - Build test credentials and demo flow system
  - Create reviewer instructions for gated features
  - Add deep link entry points for automated testing
  - Implement release gates for App Access completeness
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 6.1 Implement test credentials system

  - Create provideTestCredentials() method with demo account access
  - Build generateDemoFlow() with step-by-step instructions
  - Add test account with access to diagnosis, community, reminders features
  - Write validateAccessToGatedFeatures() verification method
  - Create unit tests for test credential generation and validation
  - _Requirements: 11.1, 11.2_

- [ ] 6.2 Build reviewer instruction system

  - Implement createReviewerInstructions() with comprehensive feature access guide
  - Add clear steps to reach diagnosis, community, and reminders features
  - Create deep link entry points for scripted crawler navigation
  - Write instructions for navigating past age-gate and login flows
  - Add integration tests for reviewer instruction completeness
  - _Requirements: 11.2, 11.3_

- [ ] 6.3 Create App Access release gates

  - Validate test account credentials and steps to reach reminders/community/diagnosis features
  - Validate deep links for crawler paths that navigate past age-gate to feature screens
  - Add build blocking logic if Play Console App Access contains incomplete test credentials, steps, or deep links
  - Create internal checklist confirmation before submission
  - Write automated tests ensuring App Access completeness before release
  - _Requirements: 11.4_

- [ ] 7. Implement cannabis policy compliance system

  - Create automated content scanning for policy violations
  - Build age gate enforcement system
  - Add educational disclaimer system
  - Implement store listing compliance checker
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 4.1, 4.2, 4.3, 4.4_

- [ ] 7.1 Build content compliance scanner

  - Implement scanForCommerceLanguage() to detect order/delivery/pickup/buy terms
  - Create validateContent() method for policy violation detection
  - Add automated scanning of store listing copy and in-app text
  - Write validateExternalLinks() to block vendor links with documentation allowlist
  - Create unit tests for commerce language detection accuracy
  - _Requirements: 5.1, 5.4_

- [ ] 7.2 Create age gate enforcement

  - Implement enforceAgeGate() with 18+ verification before cannabis content
  - Add age verification UI flow at first launch
  - Create session management for age-verified users
  - Write bypass prevention and verification audit logging
  - Add integration tests for age gate enforcement across all cannabis features
  - _Requirements: 4.1, 5.2_

- [ ] 7.3 Implement educational disclaimer system

  - Create addEducationalDisclaimers() method for all cannabis content
  - Add clear "educational only" labeling throughout the app
  - Implement disclaimer display before accessing cannabis features
  - Write content categorization system for educational vs other content
  - Create unit tests for disclaimer placement and visibility
  - _Requirements: 5.2, 5.3_

- [ ] 7.4 Build store listing compliance checker

  - Implement pre-submission policy compliance scanning
  - Create automated review of store listing copy for policy violations
  - Add checkForSalesFeatures() validation preventing commerce functionality
  - Write policy violation reporting with remediation suggestions
  - Create integration tests for complete store listing compliance validation
  - _Requirements: 5.4_

- [ ] 8. Create telemetry and diagnostics compliance

  - Implement PII redaction in crash and analytics events
  - Add user control toggle for analytics collection
  - Build regional consent management system
  - Create data minimization enforcement
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 8.1 Implement PII redaction system

  - Create automatic PII detection and redaction in crash reports
  - Add PII filtering for analytics events by default
  - Implement data sanitization before transmission
  - Write validation ensuring no PII in diagnostic data
  - Create unit tests for PII redaction accuracy and completeness
  - _Requirements: 14.1, 14.4_

- [ ] 8.2 Build analytics control system

  - Implement in-app toggle for analytics collection in Settings
  - Add user consent flow for diagnostic data collection
  - Create opt-out functionality with immediate effect
  - Write consent state management and persistence
  - Add integration tests for analytics control functionality
  - _Requirements: 14.2_

- [ ] 8.3 Create regional consent management

  - Implement valid consent collection where required by regional law
  - Add GDPR, CCPA, and other regional compliance handling
  - Create consent banner and management UI
  - Write consent validation and audit logging
  - Add unit tests for regional consent requirement handling
  - _Requirements: 14.3_

- [ ] 9. Build comprehensive testing and validation system

  - Create automated test suite covering all compliance scenarios
  - Implement device matrix testing for permission flows
  - Add Pre-launch Report integration and validation
  - Build manual testing procedures and checklists
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 9.1 Create permission testing suite

  - Write tests for notification first-run opt-in, denial, and revoke scenarios
  - Add exact alarm denied → inexact fallback testing
  - Create photo picker and Selected Photos Access flow tests
  - Implement zero notifications before grant assertion tests
  - Write media reselection flow testing for Android 14+
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4, 13.1, 13.2, 13.3, 13.4_

- [ ] 9.2 Build policy compliance testing

  - Create UGC moderation visibility tests for report/block/mute on all content
  - Add cannabis compliance testing for commerce language detection
  - Implement external vendor link blocking validation
  - Write age gate enforcement testing across all features
  - Create appeal link presence validation in Help/Policy pages
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 5.1, 5.2, 5.3, 5.4_

- [ ] 9.3 Implement documentation testing

  - Create data inventory ↔ SDK Index cross-check validation
  - Add privacy policy ↔ Data Safety form sync testing
  - Implement deletion path accessibility testing (≤3 taps)
  - Write App Access completeness validation
  - Create CI failure testing for missing compliance documentation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 12.1, 12.2, 12.3, 12.4, 9.1, 9.2, 9.3, 9.4, 11.1, 11.2, 11.3, 11.4_

- [ ] 9.4 Build Pre-launch Report integration

  - Implement deep link entry points for scripted crawler navigation past age-gate/login
  - Add policy/security warning detection with hard release blocking on any warnings
  - Create device matrix testing across Android 13, 14, 15
  - Write automated Pre-launch Report validation ensuring crawler can access key features
  - Add manual testing procedures for compliance verification
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 10. Create compliance documentation and maintenance system

  - Build comprehensive compliance documentation
  - Create maintenance procedures for policy updates
  - Add compliance monitoring and alerting
  - Implement regular compliance audits and reviews
  - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [ ] 10.1 Create compliance documentation

  - Write Play submission checklist with all required components
  - Document all compliance measures and their implementation
  - Create troubleshooting guide for common compliance issues
  - Add policy reference links and deadline tracking
  - Write developer onboarding guide for compliance requirements
  - _Requirements: 15.1, 15.4_

- [ ] 10.2 Implement policy update procedures

  - Create monitoring system for Google Play policy changes
  - Add automated alerts for new compliance requirements
  - Implement documentation update workflows for policy changes
  - Write impact assessment procedures for policy updates
  - Create rollout procedures for compliance-related changes
  - _Requirements: 15.2, 15.3_

- [ ] 10.3 Build compliance monitoring system
  - Implement ongoing compliance validation in CI/CD pipeline
  - Add automated compliance reporting and alerting
  - Create compliance dashboard for team visibility
  - Write compliance metrics tracking and analysis
  - Add regular audit scheduling and execution
  - _Requirements: 15.3, 15.4_
