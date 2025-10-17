# Requirements Document

## Introduction

The Customer Support & Feedback Loop feature provides users with comprehensive in-app assistance, educational resources, and communication channels to ensure they can effectively use GrowBro, get help when needed, and provide feedback. This feature encompasses an in-app help center, AI assessment second-opinion workflows, system status messaging, and educational content integration aligned with playbooks and cultivation guidance.

This feature is critical for user retention, reducing support burden through self-service, and maintaining trust through transparent communication about system status and AI limitations. It also creates feedback loops that improve AI accuracy and product quality over time.

## Requirements

### Requirement 1: In-App Help Center

**User Story:** As a user, I want to access a searchable help center within the app, so that I can quickly find answers to common questions without leaving the app or contacting support.

#### Acceptance Criteria

1. WHEN the user navigates to the help center THEN the system SHALL display a searchable list of help articles organized by category (Getting Started, Calendar & Tasks, Plants & Harvest, Community, AI Assessment, Account & Settings, Troubleshooting)
2. WHEN the user enters a search query THEN the system SHALL filter articles by title and content keywords and display relevant results ranked by relevance (title > keywords > body, boosted by view count and helpfulness ratings)
3. WHEN the user selects a help article THEN the system SHALL display the full article content with formatted text, images, and embedded video links where applicable
4. IF the user is offline WHEN accessing the help center THEN the system SHALL display cached articles with a banner indicating offline mode
5. WHEN the user views a help article THEN the system SHALL provide options to rate the article as helpful or not helpful
6. WHEN the user marks an article as not helpful THEN the system SHALL prompt for optional feedback about what was missing or unclear
7. WHEN the user is viewing a help article THEN the system SHALL display a "Contact Support" button at the bottom for escalation
8. WHEN the device language is German THEN the system SHALL display localized categories, search, and articles in German; the user may override language in Settings
9. WHEN offline search is used THEN results SHALL derive from locally indexed content using full-text search and show an "Offline results" indicator
10. WHEN an article loads images or video links THEN the system SHALL lazy-load media and show placeholders to avoid layout shifts
11. WHEN a user toggles large text settings THEN article typography SHALL scale without truncation or overlap
12. WHEN the user views an article THEN the system SHALL record anonymized telemetry (article view, helpful/not helpful, search terms) without capturing PII
13. WHEN articles are updated on the server THEN the system SHALL use delta updates with ETag versioning and cache-bust to deliver fresh content efficiently

### Requirement 2: Contact Support Flow

**User Story:** As a user, I want to contact support directly from the app with context about my issue, so that I can get personalized help when self-service resources don't resolve my problem.

#### Acceptance Criteria

1. WHEN the user initiates contact support THEN the system SHALL present a form with fields for issue category (dropdown), subject (text), description (textarea), and optional screenshot attachment (max 10MB total)
2. WHEN the user submits a support request THEN the system SHALL include device metadata (app version, OS version, device model, feature flags, last screen route, Sentry last error ID if present) automatically
3. IF the user initiated contact from a help article WHEN submitting THEN the system SHALL include the article ID in the support request metadata
4. WHEN the support request is submitted successfully THEN the system SHALL display a confirmation with an estimated response time and ticket reference number
5. IF the submission fails due to network issues WHEN the user submits THEN the system SHALL queue the request in WatermelonDB with exponential backoff retry and deduplication key
6. WHEN the user has submitted a support request THEN the backend SHALL send an email confirmation to the user's registered email address
7. WHEN the user navigates to support history THEN the system SHALL display all previous support requests with status (Open, In Progress, Resolved) and timestamps
8. WHEN the user attaches screenshots THEN the system SHALL compress images on-device, warn if EXIF contains location data, and allow stripping metadata before upload
9. WHEN a support submission is queued THEN the system SHALL display its local status (Queued, Retrying, Sent) with last attempt timestamp
10. WHEN the backend responds with a ticket reference THEN the system SHALL store it locally and map to the queued record
11. WHEN a user is under the age threshold THEN the contact form SHALL require guardian consent indicator before submit
12. WHEN the user previews submission THEN the system SHALL show captured metadata with toggles to opt out of specific fields for data minimization

### Requirement 3: AI Assessment Second-Opinion Flow

**User Story:** As a user who received an AI plant assessment, I want to request a second opinion or report inaccurate results, so that I can get more reliable guidance and help improve the AI system.

#### Acceptance Criteria

1. WHEN the user views an AI assessment result THEN the system SHALL display a "Request Second Opinion" button and a "Report Issue" button
2. WHEN the user taps "Request Second Opinion" THEN the system SHALL present a consent screen with separate toggles for "human review" (required) and "allow training use" (optional, default off), plus expected response window
3. WHEN the user submits a second-opinion request THEN the system SHALL include the original photo, AI assessment results (all detected issues with confidence scores, model version), assessment ID, and optional user notes
4. WHEN the second-opinion request is submitted THEN the system SHALL create a support ticket and notify the user via in-app notification and email (respecting notification preferences and quiet hours) when the review is complete
5. WHEN the user taps "Report Issue" THEN the system SHALL present a form with options for issue type (Incorrect diagnosis, Missed obvious issue, False positive, Other) and a text field for details
6. WHEN the user submits an issue report THEN the system SHALL flag the assessment for review and log the feedback for AI model improvement
7. WHEN a second opinion is completed THEN the system SHALL display the expert review alongside the original AI assessment with model version, reviewer role (human/expert), timestamp, and any changes vs. original
8. WHEN requesting second opinion THEN the consent screen SHALL allow separate toggles for "human review" and "allow training use," defaulting training to off
9. WHEN the second opinion is published THEN the system SHALL maintain an immutable link to the original assessment ID and model version for provenance
10. WHEN content violates policy (offensive images) THEN the system SHALL reject upload and present policy guidance on acceptable use
11. WHEN the user wants to retract consent THEN the system SHALL allow erasure of the second-opinion package from training datasets

### Requirement 4: System Status & Outage Messaging

**User Story:** As a user, I want to be informed about system outages, maintenance windows, and service degradation, so that I understand when features may not work as expected and can plan accordingly.

#### Acceptance Criteria

1. WHEN the app launches THEN the system SHALL check for active status messages from the backend (integrated with external status page and internal health checks) and display them if present
2. WHEN a critical outage is detected (API unreachable, sync failing) THEN the system SHALL display a prominent banner at the top of the screen with the issue description, severity (Critical/Degraded/Informational), and estimated resolution time
3. WHEN a scheduled maintenance window is approaching (within 24 hours) THEN the system SHALL display an informational banner notifying users of the upcoming maintenance and affected features
4. WHEN the user taps on a status banner THEN the system SHALL navigate to a detailed status page showing current incidents, maintenance schedules, and historical uptime
5. IF the user is offline WHEN the app launches THEN the system SHALL display an offline indicator but SHALL NOT show false outage messages
6. WHEN a status message is resolved THEN the system SHALL automatically dismiss the banner and optionally show a brief "Service Restored" toast notification
7. WHEN the user navigates to Settings > About THEN the system SHALL provide a link to the external status page (e.g., status.growbro.app)
8. WHEN status is "Degraded" vs "Critical" THEN the banner style and CTA SHALL reflect severity with accessible colors (WCAG AA compliant) and descriptive labels
9. WHEN the device is offline AND last-known status is "All clear" THEN the system SHALL show only the offline indicator without an outage banner
10. WHEN status messages are cached THEN the system SHALL include a last-updated timestamp and de-duplicate incidents from multiple sources
11. WHEN the user opts in to push notifications THEN the system SHALL send incident notifications for Critical severity only, regionalized to services impacting the user's region

### Requirement 5: Educational Content Integration

**User Story:** As a user following a playbook or managing plants, I want to access relevant educational content at the right time, so that I can learn best practices and improve my cultivation skills contextually.

#### Acceptance Criteria

1. WHEN the user views a task in the calendar THEN the system SHALL display a "Learn More" link if educational content is available for that task type (mapped via content ID with locale and offline availability flags)
2. WHEN the user taps "Learn More" on a task THEN the system SHALL open an educational article or video explaining the task, best practices, and common mistakes
3. WHEN the user selects a playbook THEN the system SHALL display an overview with embedded educational content about the grow method (Auto/Photo, Indoor/Outdoor)
4. WHEN the user views a plant's growth stage THEN the system SHALL provide contextual tips and educational links relevant to that stage (e.g., "Flowering Stage: Nutrient Requirements")
5. WHEN the user receives an AI assessment with detected issues THEN the system SHALL include links to educational content about each identified problem (e.g., "Nitrogen Deficiency: Causes and Solutions")
6. WHEN the user navigates to the Community feed THEN the system SHALL occasionally surface featured educational posts or tips from verified growers
7. WHEN the user completes a major milestone (first harvest, first playbook completion) THEN the system SHALL display a congratulatory message with links to advanced educational content for the next level
8. WHEN the user taps "Learn More" and content requires network THEN the system SHALL show estimated size and a Wi-Fi-only toggle before download
9. WHEN content is unavailable in the user's language THEN the system SHALL fallback to English and indicate the fallback with a language badge
10. WHEN the user completes a step THEN the system SHALL suggest one related educational item respecting the user's "minimize prompts" preference
11. WHEN educational content is prefetched THEN the system SHALL download content summaries and thumbnails; full articles/videos on-demand or Wi-Fi only per user setting
12. WHEN embedded videos are displayed THEN the system SHALL ensure proper licensing and track external links for copyright compliance

### Requirement 6: Feedback Collection & Rating Prompts

**User Story:** As a user, I want to provide feedback about my experience with the app, so that I can help improve the product and feel heard by the development team.

#### Acceptance Criteria

1. WHEN the user completes a significant action (completes a playbook, logs a harvest, uses AI assessment 5 times) THEN the system SHALL prompt for a rating (1-5 stars) with optional comment after a positive moment, never blocking primary flows
2. WHEN the user provides a rating of 4-5 stars THEN the system SHALL ask if they'd like to rate the app on the App Store/Play Store using native APIs (SKStoreReviewController for iOS, Play In-App Review API for Android)
3. WHEN the user provides a rating of 1-3 stars THEN the system SHALL show an in-app feedback form asking what could be improved and route feedback to the product team without prompting for a store review
4. WHEN the user navigates to Settings > Feedback THEN the system SHALL provide options to submit general feedback, report a bug, or request a feature
5. WHEN the user submits feedback THEN the system SHALL confirm receipt and provide a reference number for tracking
6. IF the user has previously dismissed a rating prompt WHEN the prompt would appear again THEN the system SHALL wait at least 30 days before showing another prompt (app-level throttle)
7. WHEN the user opts out of feedback prompts THEN the system SHALL persist this preference locally and never auto-prompt again, only showing prompts in Settings
8. WHEN triggering store review THEN the system SHALL use platform-native APIs and SHALL degrade gracefully if quota prohibits showing a prompt (Apple: up to 3 per 365 days)
9. WHEN a user opts out of prompts THEN the system SHALL persist this preference and never auto-prompt again
10. WHEN a 1-3 star rating is submitted THEN the system SHALL show an in-app feedback form and SHALL NOT attempt a store prompt

### Requirement 7: Compliance & Privacy in Support Interactions

**User Story:** As a user, I want my support interactions and feedback to respect my privacy and comply with data protection regulations, so that I can trust the support process with my information.

#### Acceptance Criteria

1. WHEN the user submits a support request with a screenshot THEN the system SHALL warn if the screenshot may contain personal information and require explicit confirmation
2. WHEN the user requests a second opinion on an AI assessment THEN the system SHALL display a privacy notice explaining that the photo will be reviewed by support staff and require consent
3. WHEN the user's support data is processed THEN the system SHALL comply with GDPR/privacy regulations and only retain data for the minimum necessary period (90 days configurable for resolved tickets)
4. WHEN the user requests account deletion THEN the system SHALL immediately purge all associated support tickets, feedback, and uploaded screenshots
5. WHEN the user views their data in Settings > Privacy THEN the system SHALL include a section showing support interactions and allow export or deletion
6. WHEN support staff access user data THEN the system SHALL log the access in an immutable audit table with staff ID, purpose, and timestamp, limiting access to only necessary information
7. WHEN the user is under 18 (age gate check) THEN the system SHALL NOT allow support requests without parental consent indicators (compliance with COPPA/GDPR for minors)
8. WHEN a user requests data export THEN the system SHALL include support tickets, feedback, attachments, and access logs relevant to the user, downloadable within 72 hours
9. WHEN staff access a ticket THEN the system SHALL write an immutable audit log with staff ID, purpose, and timestamp
10. WHEN support data is stored THEN the system SHALL use Supabase row-level security (RLS) to restrict access to user-owned support records
11. WHEN PII is collected THEN the system SHALL minimize by default with explicit opt-ins for sensitive fields (location, photos, email CC)

### Requirement 8: Offline Support & Sync

**User Story:** As a user with intermittent connectivity, I want to access help content and queue support requests offline, so that I can get assistance even when I don't have a stable internet connection.

#### Acceptance Criteria

1. WHEN the app is first installed THEN the system SHALL download and cache essential help articles for offline access (max 50-100MB with LRU eviction)
2. WHEN the user is offline WHEN accessing the help center THEN the system SHALL display cached articles with a banner indicating "Offline Mode - Showing cached content"
3. WHEN the user submits a support request while offline THEN the system SHALL queue the request in WatermelonDB and display a message "Your request will be sent when you're back online"
4. WHEN connectivity is restored WHEN there are queued support requests THEN the system SHALL automatically submit them in priority order (support > status > content) with exponential backoff and deduplication, showing a subtle "syncing" indicator
5. WHEN the user is offline WHEN attempting to request a second opinion THEN the system SHALL allow the request to be queued but warn that photo upload will occur when online
6. WHEN the user is offline WHEN viewing system status THEN the system SHALL display the last known status with a timestamp indicating when it was last updated
7. WHEN the user is online WHEN the app syncs THEN the system SHALL update cached help articles if newer versions are available
8. WHEN queued payload size exceeds limit THEN the system SHALL prevent new attachments and instruct the user to send without attachments or wait for connectivity
9. WHEN connectivity is restored THEN the system SHALL process queues in priority order (support > status > content), showing a subtle "syncing" indicator
10. WHEN queued payloads are stored THEN the system SHALL encrypt them at rest (MMKV or equivalent) and wipe on successful submission
11. WHEN submissions are retried THEN the system SHALL use idempotent submits with clientRequestId to prevent duplicates
12. WHEN the user navigates to Settings THEN the system SHALL provide a control to clear cached help/education content

## Cross-Cutting Non-Functional Requirements

### Security & Privacy

1. WHEN PII is collected THEN the system SHALL minimize by default with explicit opt-ins for sensitive fields (location, photos, email CC)
2. WHEN data is transmitted THEN the system SHALL use end-to-end TLS with signed URLs for media uploads
3. WHEN attachments are uploaded THEN the backend SHALL perform virus checking server-side
4. WHEN user data is stored THEN the system SHALL use Supabase row-level security (RLS) on all user-owned tables with separate audit schema for staff access logs
5. WHEN secrets are managed THEN the system SHALL never bundle keys in the app and SHALL rely on env.js validation

### Performance

1. WHEN help center search is performed offline THEN the system SHALL return results in <150ms for 500 articles
2. WHEN help center search is performed online THEN the system SHALL return results in <700ms at p95
3. WHEN status banners are rendered THEN the system SHALL render in <50ms on cold start with background fetch completing within 5 seconds
4. WHEN images are attached THEN the system SHALL compress to <1MB per screenshot by default

### Reliability & Operations

1. WHEN the app is killed THEN the system SHALL ensure no data loss in queued requests through durable WatermelonDB storage
2. WHEN submissions are made THEN the system SHALL use idempotent submits with clientRequestId to prevent duplicates
3. WHEN major outages occur THEN the system SHALL support an incident kill-switch via remote config to disable AI second-opinion intake
4. WHEN features are rolled out THEN the system SHALL use feature flags for staged rollout

### Observability

1. WHEN user actions occur THEN the system SHALL log Sentry breadcrumbs for help search, article open, support submit, second-opinion submit, status banner show/close without capturing PII
2. WHEN errors occur THEN the system SHALL use structured logs with event names and redacted fields

### Accessibility

1. WHEN UI is rendered THEN all flows SHALL be screen-reader compatible with hit targets ≥44x44pt and color contrast meeting WCAG AA standards
2. WHEN text is displayed THEN the system SHALL support dynamic font sizing without truncation

### Internationalization

1. WHEN content is displayed THEN all user-visible strings SHALL be available in EN and DE with localized date/time and number formats
2. WHEN the user's preferred language is unavailable THEN the system SHALL fallback to English with clear indication

### App Store Compliance

1. WHEN rating prompts are shown THEN the system SHALL throttle per Apple/Google guidance (Apple: max 3 per 365 days) and SHALL never gate core actions behind a rating
