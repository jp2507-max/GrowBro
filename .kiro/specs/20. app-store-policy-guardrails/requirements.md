# Requirements Document

## Introduction

This feature implements comprehensive app store policy compliance guardrails for GrowBro to ensure adherence to Apple App Store and Google Play Store policies. The system will include geo-fencing capabilities, legal entity verification, content scanning for policy violations, and automatic injection of educational disclaimers to maintain compliance across different jurisdictions and app store requirements.

## Requirements

### Requirement 1

**User Story:** As a compliance officer, I want the app to automatically detect the user's geographic location and apply appropriate policy restrictions, so that we maintain compliance with regional laws and app store policies while keeping educational content accessible.

#### Acceptance Criteria

1. WHEN the app launches or comes to foreground THEN the system SHALL determine the user's country via store region/SIM/MCC or backend IP lookup without requiring device GPS
2. WHEN the country cannot be determined THEN the system SHALL present a manual country picker and proceed in Conservative Mode
3. WHEN the country is restricted THEN the system SHALL enable Conservative Mode (community read-only, no commerce-adjacent copy, stronger disclaimers) instead of blocking the app entirely
4. WHEN precise location is requested THEN it SHALL be foreground-only and justified; background location is avoided unless core functionality requires it
5. WHEN OS region change or significant-location event occurs THEN policy toggles SHALL apply within 5 minutes
6. WHEN policy mode changes THEN the system SHALL emit region_mode_changed telemetry (old→new, reason) for audits

### Requirement 2

**User Story:** As a legal compliance manager, I want the app to verify legal entity requirements before app store submission, so that we meet all regulatory requirements for highly regulated fields including legal cannabis.

#### Acceptance Criteria

1. WHEN preparing for submission THEN the system SHALL fail unless the seller is a legal entity (not individual) with valid support URL, contact email, and D-U-N-S number (Apple)
2. WHEN legal entity verification fails THEN the system SHALL block build submission with specific policy citations and missing requirements
3. WHEN cannabis-related features are present THEN the system SHALL require a geo-restriction statement for app store submission
4. WHEN all legal requirements are met THEN the system SHALL generate a submission checklist artifact (JSON + HTML) including compliance certificates
5. WHEN Play Console 'App Content' declarations are incomplete THEN the system SHALL prevent submission with detailed remediation steps

### Requirement 3

**User Story:** As a content moderator, I want the app to automatically scan all static content for policy violations, so that we prevent "facilitation of sale" violations per Google Play's marijuana and illegal activities policies.

#### Acceptance Criteria

1. WHEN any text assets are added THEN the system SHALL scan EN/DE resources, store listing, push templates, and screenshot captions for commerce patterns (order, checkout, delivery, pickup, menu/cart, prices, "DM to buy", THC mg/€, WhatsApp/Telegram handles)
2. WHEN potential violations are detected THEN CI policy_lint SHALL fail build with "Play > Marijuana" or "Illegal Activities" policy references and specific examples
3. WHEN content passes scanning THEN the system SHALL approve content with ruleset version tracking
4. WHEN policy rules are updated THEN the system SHALL re-scan existing content against new criteria automatically
5. WHEN false positives occur THEN authorized approvers SHALL be able to "accept risk" with justification notes, and all waivers SHALL be audited

### Requirement 4

**User Story:** As a user in any jurisdiction, I want to see appropriate educational disclaimers throughout the app, so that I understand the educational nature of the content and legal responsibilities without manipulation.

#### Acceptance Criteria

1. WHEN the app launches THEN the system SHALL display a neutral age screen (minimum 18+ or regional majority) that blocks minors from cannabis content without nudging
2. WHEN users access AI Diagnosis or Playbooks THEN the system SHALL inject contextual disclaimers: "Educational horticulture guidance only; not medical advice"
3. WHEN users share content THEN share sheets SHALL append educational disclaimers to outbound content
4. WHEN disclaimer text changes THEN users SHALL be required to re-acknowledge updated terms (versioned)
5. WHEN privacy notices are displayed THEN they SHALL reflect App Privacy disclosures without manipulating consent

### Requirement 5

**User Story:** As a developer, I want automated policy compliance checks during the build process, so that policy violations are caught before app store submission with specific policy citations.

#### Acceptance Criteria

1. WHEN a build is initiated THEN the system SHALL validate App Store Connect age-rating tiers (4+, 9+, 13+, 16+, 18+) with deadline to complete updated age-rating questionnaire by January 31, 2026; Google Play READ_MEDIA_IMAGES/READ_MEDIA_VIDEO declarations by January 22, 2025 (extendable to May 28, 2025) or implement system photo picker to remove broad media permissions; App Privacy answers and Play Data Safety declarations completeness
2. WHEN policy violations are detected THEN the build SHALL fail with store-policy citations (section + link) for each violation (e.g., 'Play > Marijuana', 'Apple 1.4.3')
3. WHEN keyword linter runs THEN it SHALL scan notification templates and store listing for policy violations
4. IF all policy checks pass THEN the build SHALL proceed with compliance certification and submission checklist
5. WHEN compliance checks fail THEN developers SHALL receive actionable remediation guidance with policy references

### Requirement 6

**User Story:** As a product manager, I want real-time monitoring of policy compliance status including UGC moderation metrics, so that I can proactively address potential violations before they impact app store approval.

#### Acceptance Criteria

1. WHEN potential violations are detected THEN the system SHALL generate a Jira/GitHub issue with reproduction steps, screenshot, policy section, and remediation steps
2. WHEN UGC moderation occurs THEN the system SHALL track SLAs, report/auto-hide thresholds, appeals, and block counts in a Policy Dashboard
3. WHEN compliance metrics change THEN the dashboard SHALL show leading indicators: % policy-blocked strings, % low-confidence AI results, region-mode distribution
4. WHEN UGC moderation SLA breaches occur THEN the system SHALL trigger automated alerts per Google's UGC policy requirements
5. WHEN app store policies are updated THEN the system SHALL assess impact on current compliance status and update validation criteria

### Requirement 7

**User Story:** As a user, I want the app to gracefully handle policy restrictions without compromising my experience, so that I can still access appropriate educational content within legal boundaries.

#### Acceptance Criteria

1. WHEN features are disabled by region/policy THEN the system SHALL surface clear explainers and keep educational read-only content, calendar, and reminders available
2. WHEN community features are restricted THEN the system SHALL switch to read-only mode with in-app reporting still available to meet UGC policy expectations
3. WHEN feature flags toggle via remote config THEN changes SHALL reflect without app update and be auditable
4. WHEN users attempt to access restricted content THEN the system SHALL provide educational alternatives and clear explanations
5. WHEN restrictions lift (region changed) THEN the app SHALL restore features immediately on next foreground and record the transition

### Requirement 8

**User Story:** As a community moderator, I want robust UGC safety baselines on both client and server, so that we meet Google Play's UGC policy requirements for ongoing moderation.

#### Acceptance Criteria

1. WHEN users create content THEN the system SHALL run pre-publish keyword checks for commerce/meet-ups, link/phone/handle obfuscation detection
2. WHEN content is published THEN the system SHALL apply rate limits and provide 15-second undo functionality
3. WHEN content receives N reports THEN the system SHALL auto-hide content and trigger moderator review
4. WHEN moderation decisions are made THEN the system SHALL provide appeals process and moderator tooling
5. WHEN UGC violations are detected THEN the system SHALL maintain audit trails for all moderation actions

### Requirement 9

**User Story:** As a privacy-conscious user, I want the app to minimize data collection and provide clear controls, so that my privacy is protected in alignment with App Privacy and Data Safety requirements.

#### Acceptance Criteria

1. WHEN users upload photos THEN the system SHALL strip EXIF GPS data by default
2. WHEN cloud processing is needed THEN the system SHALL require explicit opt-in from users
3. WHEN users revoke permissions THEN the system SHALL provide easy data purge functionality
4. WHEN App Privacy answers are provided THEN they SHALL align with Play Data Safety declarations
5. WHEN data collection occurs THEN it SHALL follow data minimization principles and be clearly disclosed

### Requirement 10

**User Story:** As an app store reviewer, I want clear documentation about the app's purpose and compliance measures, so that I can efficiently review the app for policy compliance.

#### Acceptance Criteria

1. WHEN the app is submitted THEN it SHALL include Reviewer Notes documenting educational purpose, no commerce, age gate, and region toggles
2. WHEN reviewers test the app THEN documentation SHALL explain how to trigger "Conservative Mode" for testing
3. WHEN contact information is needed THEN support URLs and privacy policy links SHALL be clearly accessible
4. WHEN compliance features are implemented THEN documentation SHALL reference specific policy sections (Apple 2.1/2.3, etc.)
5. WHEN the app's functionality is reviewed THEN clear explanations SHALL be provided for all policy-sensitive features
