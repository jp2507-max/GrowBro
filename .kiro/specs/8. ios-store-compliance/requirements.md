# Requirements Document

## Introduction

This feature ensures GrowBro meets all iOS App Store compliance requirements based on August 2025 guidelines, specifically focusing on privacy manifests with required-reason API mappings, App Privacy questionnaire completion, 17+ age-rating with in-app age-gating, UGC safeguards, and AI assessment disclaimers. The goal is to pass App Store Connect review without any privacy warnings while maintaining full compliance with Apple's privacy, content, and safety guidelines.

## Requirements

### Requirement 1

**User Story:** As a developer, I want to create comprehensive privacy manifests with required-reason API declarations, so that the app passes 2025 enforcement requirements without rejection.

#### Acceptance Criteria

1. WHEN the app is analyzed THEN the system SHALL create an Apple Privacy Manifest (PrivacyInfo.xcprivacy) for the main app
2. WHEN third-party SDKs are inventoried THEN the system SHALL ensure each SDK from Apple's "commonly used SDKs" list includes its own privacy manifest
3. WHEN Required Reason APIs are used THEN the system SHALL declare approved reasons for file timestamps, boot time, disk space, UserDefaults, and keyboard state APIs
4. WHEN SDK signatures are validated THEN the system SHALL ensure all SDKs have valid signatures per Apple's requirements
5. IF any Required Reason API is used without declaration THEN the system SHALL prevent submission rejection by documenting the specific use case

### Requirement 2

**User Story:** As a compliance officer, I want to complete the App Privacy "Nutrition Labels" with accurate data classifications, so that the app store listing reflects our actual privacy practices and tracking status.

#### Acceptance Criteria

1. WHEN data collection is analyzed THEN the system SHALL categorize all data types per Apple's privacy categories (Contact Info, Health & Fitness, User Content, etc.)
2. WHEN data linkage is evaluated THEN the system SHALL classify each data type as "linked to user" or "not linked to user"
3. WHEN tracking practices are assessed THEN the system SHALL accurately flag any data used for tracking across apps/websites
4. WHEN analytics/Sentry/Supabase are integrated THEN the system SHALL update the App Privacy section to reflect new data flows
5. WHEN the questionnaire is completed THEN the system SHALL include supporting screenshots in the repository for audit purposes

### Requirement 3

**User Story:** As a product manager, I want to implement 17+ age-rating with mandatory 18+ in-app age-gating, so that the app complies with cannabis content restrictions and legal requirements.

#### Acceptance Criteria

1. WHEN the App Store age-rating questionnaire is completed THEN the system SHALL set rating to 17+ for frequent/intense medical content and drug references
2. WHEN the app launches for the first time THEN the system SHALL present an 18+ age verification gate before any content access
3. WHEN a user attempts to bypass age verification THEN the system SHALL prevent access to all app functionality
4. WHEN age verification is completed THEN the system SHALL store the verification status securely using MMKV
5. IF a user indicates they are under 18 THEN the system SHALL deny access with appropriate messaging and exit options

### Requirement 9: Geo-Fence + 18+ Lint (Adjustments A12)

**User Story:** As a release manager, I want pre-submit checks for geo-fence configuration and 18+ parity so that our store rating and in-app gate remain aligned.

#### Acceptance Criteria

1. WHEN preparing for submission THEN the system SHALL check for required geo-fence configuration for restricted regions and fail the submission checklist if missing
2. WHEN validating rating THEN the system SHALL ensure the App Store rating (17+/18+) matches the in-app 18+ age gate and block release when mismatched

### Requirement 4

**User Story:** As a product manager, I want to implement required UGC safeguards per Guideline 1.2, so that the community features comply with Apple's content moderation requirements.

#### Acceptance Criteria

1. WHEN objectionable content is posted THEN the system SHALL filter using keyword/image heuristics plus moderation queue
2. WHEN users encounter inappropriate content THEN the system SHALL provide a report flow with visible 24-hour review SLA
3. WHEN users are abusive THEN the system SHALL provide block/mute functionality
4. WHEN users need support THEN the system SHALL provide published contact info (in-app support + Support URL)
5. WHEN UGC controls are implemented THEN the system SHALL document all four controls in Review Notes and Community Guidelines

### Requirement 5

**User Story:** As a product manager, I want to implement AI assessment disclaimers and confidence thresholds, so that the AI Photo Assessment feature complies with medical guidance restrictions.

#### Acceptance Criteria

5. WHEN AI analysis is presented THEN the system SHALL label outputs as "AI assessment" (not "diagnosis")
6. WHEN AI results are displayed THEN the system SHALL show confidence scores and educational disclaimers
7. WHEN confidence is below 70% THEN the system SHALL route users to "Ask Community / Get second opinion"
8. WHEN AI guidance is provided THEN the system SHALL include "educational guidance; not professional advice" disclaimer
9. IF medical-style claims are detected THEN the system SHALL prevent them to avoid Guideline 1.4 violations

### Requirement 6

**User Story:** As a developer, I want to implement proper permission handling and account management, so that the app meets privacy and user control requirements.

#### Acceptance Criteria

1. WHEN camera access is requested THEN the system SHALL use clear NSCameraUsageDescription for "capture plant photos for AI assessment"
2. WHEN photo library access is needed THEN the system SHALL provide specific purpose strings for save/select operations
3. WHEN Sign in with Apple is offered THEN the system SHALL make it first-class alongside any third-party login options
4. WHEN users want to delete accounts THEN the system SHALL provide in-app deletion path (Settings → Account → Delete)
5. WHEN account deletion occurs THEN the system SHALL remove account and data not legally required to keep, with confirmation

### Requirement 7

**User Story:** As a developer, I want to ensure no commerce facilitation and proper push notification handling, so that the app avoids Guideline 1.4.3 violations and notification policy issues.

#### Acceptance Criteria

1. WHEN app content is reviewed THEN the system SHALL contain no ordering, delivery, affiliate links, or "find a seller" flows
2. WHEN app descriptions are written THEN the system SHALL clearly state "educational content only"
3. WHEN core features are accessed THEN the system SHALL NOT require push notification enablement
4. WHEN marketing pushes are sent THEN the system SHALL only send after explicit opt-in with in-app opt-out available
5. WHEN promotional content is considered THEN the system SHALL avoid any consumption encouragement messaging

### Requirement 8

**User Story:** As a development team, I want comprehensive compliance documentation and review preparation, so that App Store submissions pass without rejections.

#### Acceptance Criteria

1. WHEN the app is submitted THEN the system SHALL include demo credentials and ensure all servers (Supabase, AI APIs) are live
2. WHEN Review Notes are written THEN the system SHALL explain UGC moderation, AI assessment flow, and offline/sync functionality
3. WHEN screenshots are prepared THEN the system SHALL ensure no commerce implications or consumption promotion
4. WHEN accessibility is considered THEN the system SHALL fill Accessibility Nutrition Labels for VoiceOver and Larger Text support
5. WHEN compliance documentation is complete THEN the system SHALL maintain audit trail for future submissions and team reference
