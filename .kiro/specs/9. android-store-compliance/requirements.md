# Requirements Document

## Introduction

This feature ensures GrowBro meets all Android Play Store compliance requirements for successful app publication and ongoing maintenance. The implementation focuses on updating the app to target Android SDK 35, implementing automated compliance checks, completing all required Play Store documentation, and ensuring adherence to cannabis-related policies. The goal is to achieve a green pre-launch report with zero policy warnings.

## Requirements

### Requirement 1

**User Story:** As a product owner, I want the app to target Android SDK 35, so that it meets Google Play Store's latest requirements and maintains compatibility with new Android versions.

#### Acceptance Criteria

1. WHEN the app is built THEN targetSdkVersion MUST be 35 for all release builds
2. WHEN CI runs THEN it SHALL fail if targetSdk < 35 or if any module's manifest merges to lower than 35
3. WHEN releasing after Aug 31, 2025 THEN the app MUST target API 35 (mobile)
4. IF an extension is needed THEN the request and approval SHALL be tracked with hard-stop deploy after Nov 1, 2025 without extension

### Requirement 2

**User Story:** As a developer, I want automated CI checks for compliance, so that policy violations are caught before release and the development team is notified of any issues.

#### Acceptance Criteria

1. WHEN code is pushed to main branch THEN CI SHALL run compliance checks automatically
2. WHEN compliance violations are detected THEN the build SHALL fail and notify the team
3. WHEN Play Store policies change THEN the CI checks SHALL be updated to reflect new requirements
4. IF the pre-launch report shows warnings THEN the CI SHALL prevent deployment until resolved

### Requirement 3

**User Story:** As a compliance officer, I want the Play Data Safety form completed accurately, so that users understand what data the app collects and how it's used.

#### Acceptance Criteria

1. WHEN maintaining data inventory THEN a machine-readable data map SHALL track feature × data type × purpose × retention × shared with
2. WHEN CI runs THEN it SHALL auto-generate a draft Data safety form from the data map and fail if form or privacy-policy URL is missing/stale
3. WHEN third-party SDKs are used THEN their data collection SHALL be validated against the Google Play SDK Index and vendor docs with pinned versions
4. WHEN the Data Safety form is submitted THEN all data collection practices SHALL be accurately declared

### Requirement 4

**User Story:** As a content manager, I want the IARC content rating questionnaire completed, so that the app receives appropriate age ratings across all supported regions.

#### Acceptance Criteria

1. WHEN the app launches THEN it SHALL enforce 18+ age-gate at first launch before any UGC access
2. WHEN the IARC questionnaire is submitted THEN content rating SHALL reflect educational cannabis content accurately
3. WHEN cannabis-related content is present THEN it SHALL be properly categorized as educational only
4. IF content changes significantly THEN the rating SHALL be reassessed and updated

### Requirement 5

**User Story:** As a legal compliance manager, I want cannabis policy compliance verified, so that the app adheres to Google Play's cannabis policies and avoids policy violations.

#### Acceptance Criteria

1. WHEN the app is reviewed THEN it SHALL NOT facilitate sale, ordering, pickup, delivery, or linking to purchase marijuana/THC products
2. WHEN cannabis content is displayed THEN it SHALL be clearly marked as educational only and 18+
3. WHEN users interact with cannabis content THEN appropriate disclaimers SHALL be shown
4. WHEN store listing copy is created THEN it SHALL be reviewed to catch commerce language before submission

### Requirement 6

**User Story:** As a release manager, I want a green pre-launch report with zero policy warnings, so that the app can be successfully published and updated on the Play Store.

#### Acceptance Criteria

1. WHEN the submission pipeline runs THEN it SHALL hard-fail if Play Pre-launch report shows policy warnings or security issues
2. WHEN policy warnings are detected THEN owners SHALL triage until resolved before release
3. WHEN device-matrix tests run THEN they SHALL include notification consent, exact-alarm denied path, airplane-mode reminders, and UGC report/block flows
4. IF any compliance issues arise THEN they SHALL be tracked and resolved systematically

### Requirement 7

**User Story:** As a developer, I want notifications permission handled correctly for Android 13+, so that the app complies with runtime permission requirements and provides fallback experiences.

#### Acceptance Criteria

1. WHEN the app needs to post notifications THEN it MUST request POST_NOTIFICATIONS at runtime prior to posting any non-exempt notifications
2. WHEN notifications permission is denied or revoked THEN the app MUST suppress all notifications and show an in-app reminder badge instead
3. WHEN first-run occurs THEN show in-app primer before system prompt
4. WHEN automated tests run THEN they SHALL assert zero notifications prior to permission grant

### Requirement 8

**User Story:** As a developer, I want exact alarms handled appropriately, so that the app uses inexact scheduling by default and only requests exact alarms when truly needed.

#### Acceptance Criteria

1. WHEN scheduling reminders THEN the app SHALL use WorkManager/inexact alarms by default
2. WHEN exact timing is required THEN only request SCHEDULE_EXACT_ALARM or USE_EXACT_ALARM with Play Console permission declaration
3. WHEN exact-alarm permission is denied THEN the app SHALL run normally with inexact scheduling
4. WHEN CI runs THEN it SHALL block any manifest adding exact-alarm permissions without linked declaration doc

### Requirement 9

**User Story:** As a user, I want account and data deletion capabilities, so that I can remove my account and associated data when needed.

#### Acceptance Criteria

1. WHEN account creation exists THEN provide in-app path to delete account and associated data
2. WHEN deletion is requested THEN provide a public web URL for deletion requests
3. WHEN deletion path is accessed THEN it SHALL be discoverable in ≤3 taps from Profile/Settings
4. WHEN Data safety form is completed THEN both deletion methods SHALL be referenced

### Requirement 10

**User Story:** As a community manager, I want UGC moderation tools, so that users can report inappropriate content and maintain a safe community environment.

#### Acceptance Criteria

1. WHEN viewing any post/comment THEN users SHALL be able to Report with reason categories, Block/Mute the author, and delete their own content
2. WHEN content is reported THEN it SHALL reach the server in ≤5s with moderation queue and audit logs
3. WHEN abuse occurs THEN provide rate-limits/spam heuristics and documented triage SLA
4. WHEN appeals are needed THEN provide appeal channel described in Help/Policy page

### Requirement 11

**User Story:** As a reviewer, I want app access credentials provided, so that all gated features can be properly reviewed during the submission process.

#### Acceptance Criteria

1. WHEN submitting to Play Console THEN supply test credentials or demo flow in App content → App access
2. WHEN providing access THEN include clear steps to reach gated features (diagnosis, community, reminders)
3. WHEN internal checklist runs THEN it SHALL be confirmed before submission
4. IF App Access is missing THEN rejected builds SHALL block release

### Requirement 12

**User Story:** As a privacy officer, I want a public privacy policy, so that users understand data practices and the policy aligns with Play Store disclosures.

#### Acceptance Criteria

1. WHEN the privacy policy is published THEN it MUST explain collection, use, sharing, retention, and deletion practices
2. WHEN Data safety answers are provided THEN the privacy policy MUST match those disclosures
3. WHEN CI runs THEN it SHALL block builds if privacy policy URL is absent
4. WHEN policy changes THEN both privacy policy and Data safety form SHALL be updated consistently

### Requirement 13

**User Story:** As a developer, I want proper storage and media permissions, so that the app uses scoped storage and avoids sensitive permission requests.

#### Acceptance Criteria

1. WHEN accessing storage THEN use app-private directories and READ_MEDIA_IMAGES as needed
2. WHEN requesting permissions THEN do NOT request MANAGE_EXTERNAL_STORAGE
3. WHEN CI runs THEN pre-submit manifest scan SHALL reject all-files-access requests
4. WHEN using image picker THEN it SHALL work under scoped storage restrictions

### Requirement 14

**User Story:** As a privacy officer, I want telemetry and diagnostics handled properly, so that PII is protected and consent is obtained where required.

#### Acceptance Criteria

1. WHEN crash/analytics events occur THEN they MUST exclude PII by default
2. WHEN analytics are collected THEN provide in-app toggle for user control
3. WHEN regional law requires THEN obtain valid consent for analytics collection
4. WHEN diagnostic data is sent THEN ensure it complies with data minimization principles

### Requirement 15

**User Story:** As a developer, I want proper documentation of all compliance measures, so that future updates maintain compliance and the team understands all requirements.

#### Acceptance Criteria

1. WHEN compliance measures are implemented THEN they SHALL be documented in the project with Play submission checklist
2. WHEN third-party SDKs are added THEN their compliance impact SHALL be assessed and documented
3. WHEN CI runs THEN it SHALL lint manifests for restricted permissions and block unreviewed additions
4. IF compliance questions arise THEN the documentation SHALL provide clear guidance
