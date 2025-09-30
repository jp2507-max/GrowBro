ef### Security edge-case tests (explicit additions)

Add the following unit test cases to the deep-link test matrix to ensure rigorous validation and sanitizer behavior. Each row includes: input URL, expected result (pass/fail), failure reason, and expected validation error code.

1. Scheme: `file:` (forbidden)

- input: `file:///etc/passwd`
- expected: fail
- reason: local file scheme should never be allowed for notifications deep-links
- error: `forbidden-scheme-file`

2. Insecure HTTP redirect (blocked for sensitive redirects)

- input: `http://insecure.example.com/welcome`
- expected: fail (unless explicitly allowlisted in origin policy)
- reason: insecure transport for redirect targets may leak tokens or user data
- error: `blocked-redirect-insecure-http`

3. Userinfo present in host (forbidden)

- input: `https://admin:password@evil.example.com/dashboard`
- expected: fail
- reason: userinfo in URL authority can leak credentials and should be rejected
- error: `forbidden-userinfo`

4. Non-default ports (blocked unless allowlisted)

- input: `https://example.com:8080/app`
- expected: fail (unless the origin + port is allowlisted)
- reason: non-default ports can bypass origin-based allowlists and may indicate internal services
- error: `blocked-nondefault-port`

5. IDN / Unicode host handling (blocked by default)

- input: `https://xn--pple-43d.com/` # punycode for an IDN; include literal unicode form when possible: `https://раss.example/`
- expected: fail (unless IDN is explicitly allowed by policy)
- reason: Unicode/IDN hostnames can be used for homograph attacks
- error: `blocked-idn`

6. Nested / repeated percent-encoding + path traversal normalization

- input: `https://example.com/%252e%252e/%2e%2e/etc/secret`
- expected: fail
- reason: repeated encoding and traversal sequences must be normalized and then rejected if they escape allowed paths
- error: `blocked-path-traversal`

7. Combined edge cases (multiple issues should report the primary blocking code)

- input: `http://admin:bad@xn--pple-43d.com:8080/%252e%252e/%2e%2e/secret`
- expected: fail
- reason: should fail for the highest-priority policy violation (scheme and userinfo/insecure transport); test asserts consistent error prioritization
- error: `blocked-redirect-insecure-http` (or `forbidden-userinfo` depending on policy priority — assert the configured canonical precedence)

8. Sanitizer iteration limit enforcement

- input: extremely nested encoding: `https://example.com/` + repeated `%25` layers, e.g. `%25` repeated 200 times followed by `2e2e` sequences to attempt to bypass normalization
- expected: fail
- reason: sanitizer must enforce a maximum number of decoding iterations to prevent DoS or ambiguous results
- error: `sanitizer-iteration-limit`

9. Allowlist / host-origin checks (positive case)

- input: `https://trusted.example.com/dashboard`
- precondition: `trusted.example.com` is present in the app allowlist with the default port and secure scheme
- expected: pass
- reason: valid origin allowlisted for redirect targets
- error: none

10. Allowlist with non-default port (explicit allowlist entry)

- input: `https://internal.example.com:8443/service`
- precondition: `https://internal.example.com:8443` is explicitly allowlisted
- expected: pass
- reason: explicit allowlist for origin + port is supported
- error: none

Test implementation notes:

- Each unit test should assert the canonical validation error code returned by the deep-link sanitizer/validator.
- When multiple violations exist, tests should assert the canonical precedence ordering of errors. Document the precedence used by the validator in the test helper (for example: scheme -> userinfo -> insecure -> nondefault-port -> idn -> path-traversal -> sanitizer-iteration-limit).
- Tests for path traversal must validate path normalization semantics: normalize percent-encodings iteratively up to the sanitizer iteration limit, then perform path resolution and check whether the resulting path escapes an allowed base. Ensure repeated encoding cases are handled deterministically.
- Sanitizer iteration limit tests should construct inputs that would require many decoding passes and assert that the validator halts with `sanitizer-iteration-limit` rather than looping indefinitely.
- Include both unit tests (fast fuzz-like table-driven tests) and a small integration test exercising the allowlist configuration and showing that allowlist entries for host+port and IDN flags are respected.

Documented validation error codes (canonical list):

- forbidden-scheme-file: The URL uses a local file scheme which is disallowed for deep-links.
- forbidden-scheme-javascript: The URL (or a nested URL parameter) uses the `javascript:` scheme which is disallowed.
- forbidden-scheme-intent: The URL (or a nested URL parameter) uses the Android `intent:` scheme which is disallowed.
- forbidden-scheme-data: The URL (or a nested URL parameter) uses the `data:` scheme which is disallowed.
- blocked-redirect-insecure-http: The URL (or a nested redirect parameter) uses the insecure HTTP scheme and is blocked unless explicitly allowlisted.
- blocked-redirect-external: A redirect-like parameter points to an external absolute URL (different origin) which is not allowlisted and therefore blocked.
- blocked-unknown-external-param: An unrecognized query parameter carries an absolute external URL (implying navigation) and is therefore blocked.
- forbidden-userinfo: The URL contains userinfo (username[:password]@host) which is disallowed.
  - Alias: `blocked-authority-userinfo` may be emitted by some validators; treat it as equivalent to `forbidden-userinfo`.
- blocked-nondefault-port: The URL uses a non-default port and is blocked unless the exact origin (including port) is allowlisted.
- blocked-idn: The URL uses an IDN (Unicode) hostname which is blocked unless explicitly allowed (punycode must be used for allowlist matching).
- blocked-path-traversal: The normalized path escapes allowed directories after iterative decoding and normalization.
  - Alias: `blocked-path` may appear in older tests or telemetry; treat it as equivalent to `blocked-path-traversal`.
- sanitizer-iteration-limit: The URL required more decoding iterations than permitted by the sanitizer; parsing was aborted.

Notes:

- The above set is the canonical list of non-sensitive reason codes the validator should return on failure. Tests and telemetry should assert one of these identifiers.
- To preserve backward compatibility with existing tests, `blocked-path` and `blocked-authority-userinfo` are documented as accepted aliases for `blocked-path-traversal` and `forbidden-userinfo`, respectively. New tests should use the canonical identifiers.

# Implementation Plan

- [x] 1. Set up core notification infrastructure and platform-specific foundations
  - Create notification service architecture with proper TypeScript interfaces
  - Set up WatermelonDB schemas for notifications, preferences, and tokens
  - Configure Expo notifications with platform-specific channels and categories
  - _Requirements: 1.6, 3.7, 5.1_

- [x] 1.1 Create WatermelonDB schemas and models for notification system
  - Write notification, preference, and token table schemas with proper indexing
  - Implement WatermelonDB models with validation and relationships
  - Create database migrations for notification tables
  - Write unit tests for model operations and constraints
  - _Requirements: 6.6, 10.7_

- [x] 1.2 Implement Android notification channels with immutable configuration
  - Create Android channel configuration with versioned IDs (v1 suffix)
  - Implement channel creation service with proper importance levels and grouping
  - Add channel migration strategy for future updates
  - Write tests for channel creation and validation
  - _Requirements: 1.6, 3.7_

- [x] 1.3 Implement iOS notification categories and actions
  - Create iOS category configuration with proper action definitions
  - Set up UNNotificationCategory with reply and action buttons
  - Implement category registration service
  - Write tests for category setup and action handling
  - _Requirements: 1.7, 2.7_

- [x] 2. Build push notification token management system with Expo Push Service
  - Implement Expo push token registration and refresh handling
  - Create token sync service with Supabase backend
  - Add token lifecycle management with cleanup and rotation
  - _Requirements: Platform-Specific Foundation (Token Management)_

- [x] 2.1 Implement Expo push token registration and lifecycle management
  - Create token registration service using expo-notifications (getExpoPushTokenAsync)
  - Implement token refresh handling with automatic retry logic
  - Add Expo token validation (ExponentPushToken[...] format)
  - Write unit tests for Expo token operations and edge cases
  - _Requirements: Platform-Specific Foundation (Token Management)_

- [x] 2.2 Create token sync service with Supabase backend
  - Implement Expo token storage and retrieval from Supabase push_tokens table
  - Add token synchronization with timestamp tracking and RLS policies
  - Create token cleanup service for DeviceNotRegistered errors from Expo receipts
  - Write integration tests for token sync operations and error handling
  - _Requirements: Platform-Specific Foundation (Token Management)_

- [x] 3. Implement local notification scheduling with platform constraints
  - Create local notification service with iOS 64-notification limit handling
  - Implement Android exact alarm permission flow with WorkManager fallback
  - Add rolling scheduler for iOS and Doze mode handling for Android
  - _Requirements: 2.2, 2.3, 2.6, 2.7_

- [x] 3.1 Create iOS rolling notification scheduler for 64-notification limit
  - Implement rolling scheduler that maintains max 48 pending notifications (enforced by iOS)
  - Add notification refresh logic on app start/resume and background task completion
  - Create priority-based scheduling for upcoming tasks with automatic rescheduling
  - Write tests for notification limit handling, refresh cycles, and edge cases
  - _Requirements: 2.2, 2.7_

- [x] 3.2 Implement Android exact alarm system with permission handling
  - Create exact alarm permission request flow with educational UI (Android 14+ denies by default)
  - Implement SCHEDULE_EXACT_ALARM permission checking and settings intent
  - Add fallback to WorkManager for inexact scheduling when permission denied
  - Show foreground sync on app open when using inexact alarms
  - Write tests for permission flows, fallback behavior, and user education
  - _Requirements: 2.3, 2.6, 5.6_

- [x] 3.3 Build local notification scheduling service with platform-specific logic
  - Create unified scheduling interface with platform-specific implementations
  - Implement notification cancellation and rescheduling
  - Add Doze mode and battery optimization handling for Android
  - Write unit tests for scheduling operations and platform differences
  - _Requirements: 2.1, 2.4, 2.5_

- [ ] 4. Create deep link handling system with security validation
  - Implement URL parsing and validation with allowlist security
  - Create navigation handler with authentication gate for protected content
  - Set up Universal Links and App Links with domain verification
  - _Requirements: 4.1, 4.2, 4.3, 4.5, 8.1, 8.2, 8.3, 8.8_

- [x] 4.1 Implement secure deep link URL parser and validator
  - Create URL parser with host and path allowlist validation
  - Implement parameter sanitization to prevent injection attacks
  - Add validation for HTTPS and custom scheme URLs
  - Explicitly reject any "redirect" (or equivalent) query parameter that points to an external http(s) host. Only allow redirect targets that are:
    - a relative path (e.g. "/profile") or
    - a same-origin absolute URL (same origin as the app's configured allowed host(s)).
      If a redirect query parameter is present and its target is an external host (different origin) the URL MUST be treated as invalid and rejected.
  - Explicitly fail validation for URLs that use the following unsafe schemes: `javascript:`, `intent:`, `data:`, and `file:`. Any deep link containing a URL with these schemes (either as the primary URL or nested inside a parameter) MUST be considered invalid.
  - For web URLs, require HTTPS (and WSS for websocket endpoints). Disallow HTTP except in explicitly configured development hosts.
  - Reject authorities containing userinfo (user:pass@host) to avoid credential leakage and parser ambiguities.
  - Reject absolute URLs with non-default ports unless the port is on an explicit allowlist per trusted origin.
  - Update sanitizer & validator behavior (implementation notes):
    - Canonicalize and normalize incoming URLs before validation (percent-decode where appropriate, normalize case for host, remove default ports, collapse "./" and "../" path segments).
    - Convert internationalized domain names (IDN) to punycode prior to allowlist checks; reject mixed/invalid representations.
    - Reject URLs with userinfo components and those specifying non-allowlisted ports.
    - Percent-decode query parameter values when validating nested URLs (e.g. ?redirect=%2Fpath or ?redirect=https%3A%2F%2Fevil.com). Perform decoding on a bounded loop (e.g., max 3 iterations) to defend against repeated-encoding attacks.
    - When a query parameter is intended to carry a URL (common names: `redirect`, `next`, `url`, `continue`), parse that value as a URL and validate it using the same allowlist rules.
    - Treat presence of an unknown or unrecognized query parameter carrying an absolute external URL as a validation failure when the key implies navigation.
    - Maintain an allowlist of trusted origins (configurable), including an optional allowlist of non-default ports per origin, and treat only those origins as same-origin for redirect checks.
    - Log/telemetry: on validation failure record a non-sensitive reason code (e.g. `blocked-redirect-external`, `forbidden-scheme-javascript`, `forbidden-scheme-file`, `blocked-authority-userinfo`) to aid debugging; do NOT log full redirect targets or other sensitive tokens.
  - Add sanitizer protections for nested encoded payloads and repeated-encoding attacks (e.g. double percent-encoding). Normalize repeatedly until a stable representation is reached, but cap iteration depth to avoid DoS.
  - Write comprehensive tests for URL validation and security edge cases, including but not limited to:
    - Blocked redirect params pointing to external http(s) hosts (absolute external URLs encoded/unencoded).
    - Allowed redirect params that are same-origin absolute URLs and relative paths.
    - Rejection of `javascript:` scheme in the main URL and in query params (plain and percent-encoded).
    - Rejection of `intent:` scheme (Android intent: URIs) in the main URL and in query params.
    - Rejection of `data:` scheme in the main URL and in query params.
    - Nested/encoded variants (e.g. redirect parameter value is itself percent-encoded URL that contains forbidden scheme or external host).
    - Path traversal normalization edge cases (../, //, mixed-encoding) to ensure origin/path checks are robust.
    - Performance guardrails (ensure sanitizer stops after N iterations on repeated-decoding).
  - _Requirements: 4.5, 8.3, 11.2_

  - Example unit test matrix (to be implemented in test suite):
    - Test matrix (explicit security edge-cases)

      Note: each test includes an "Input" (raw incoming deep link), an "Expectation" (pass/fail), and when failing the canonical non-sensitive reason code expected from telemetry/validation. Tests should be implemented in the URL parser/validator unit test file (example: `src/lib/url-validator.test.ts`) and must assert sanitizer iteration limits, allowlist/host-origin checks, punycode/IDN normalization, and that userinfo/non-default ports are rejected unless explicitly allowlisted.
      - Test: reject `file:` scheme (forbidden primary scheme)
        - Input: file:///etc/passwd
        - Expect: validation failure, reason `forbidden-scheme-file`

      - Test: reject nested `file:` inside parameter (percent-encoded)
        - Input: app://open?url=file%3A%2F%2F%2Fetc%2Fpasswd
        - Expect: validation failure, reason `forbidden-scheme-file`

      - Test: reject insecure `http:` external redirect when not allowlisted
        - Input: app://open?redirect=http://evil.example.com/path
        - Expect: validation failure, reason `blocked-redirect-insecure-http`

      - Test: allow explicit development host over HTTP if configured (positive control)
        - Input: app://open?redirect=http://dev.local:8080/dashboard
        - Expect: validation success if `dev.local:8080` is present in allowlist; otherwise `blocked-redirect-insecure-http`

      - Test: reject authority containing userinfo (user:pass@host)
        - Input: app://open?redirect=https://user:pass@evil.com/
        - Expect: validation failure, reason `forbidden-userinfo`

      - Test: reject main URL that includes userinfo in host
        - Input: https://alice:secret@trusted.example.com/welcome
        - Expect: validation failure, reason `forbidden-userinfo`

      - Test: reject absolute URL with non-default (disallowed) port
        - Input: app://open?redirect=https://app.example.com:4443/profile
        - Expect: validation failure, reason `blocked-nondefault-port` unless `app.example.com:4443` is explicitly allowlisted

      - Test: accept same-origin absolute redirect when origin and port match allowlist
        - Input: app://open?redirect=https://app.example.com:443/profile
        - Expect: validation success (default HTTPS port considered canonical)

      - Test: IDN/Unicode host handling — reject mixed/invalid representations
        - Input: app://open?redirect=https://éxample.com/profile
        - Expect: validation failure, reason `blocked-idn` (must be converted to punycode then matched against allowlist)

      - Test: IDN punycode accepted when allowlisted
        - Input: app://open?redirect=https://xn--xample-9ua.com/profile
        - Expect: validation success if `xn--xample-9ua.com` is in allowlist; otherwise `blocked-idn`

      - Test: nested/repeated encoding combined with path-traversal normalization
        - Input: app://open?redirect=%252Fadmin%252F..%252Fuser%252Fprofile (double-encoded path traversal)
        - Expect: sanitizer performs bounded decoding (e.g., max 3 iterations), normalizes to `/user/profile` and then applies allowlist/origin checks. If normalization results in a relative path allowed by policy — success; otherwise failure with `blocked-redirect-external` or `sanitizer-iteration-limit` if iterations cap reached without stabilization.

      - Test: repeated-encoding DoS defense (iteration cap)
        - Input: app://open?redirect=%25%25%25%25%25%252Fsecret (crafted many layers)
        - Expect: sanitizer stops after configured max iterations and returns validation failure with reason `sanitizer-iteration-limit`

      - Test: unknown query parameter containing an absolute external URL (fail when key implies navigation)
        - Input: app://open?next=https://evil.com/win
        - Expect: validation failure, reason `blocked-redirect-external` (or `blocked-unknown-external-param` depending on validator naming; tests should assert the agreed code)

      - Test: complex nested case — percent-encoded URL containing a punycode host and a forbidden scheme
        - Input: app://open?redirect=https%3A%2F%2Fxn--evil-abc.com%2F%3Fq%3Djavascript%253Aalert(1)
        - Expect: validation failure, reason `forbidden-scheme-javascript` (detected after decoding nested param)

      - Test: allow relative redirect that normalizes out path-traversal
        - Input: app://open?redirect=%2Fprofile%2F..%2Fsettings%2F (encoded `/profile/../settings/`)

  - Expect: validation success if `/settings/` is allowed; otherwise `blocked-redirect-external` or `blocked-path-traversal`
    - Implementation notes for tests:
      - Cover both encoded and unencoded variants for each test case.
      - Assert that telemetry/validation returns one of the documented non-sensitive reason codes on failure: `forbidden-scheme-file`, `blocked-redirect-insecure-http`, `forbidden-userinfo`, `blocked-nondefault-port`, `blocked-idn`, `sanitizer-iteration-limit`, `blocked-redirect-external`, `forbidden-scheme-javascript`, `forbidden-scheme-intent`, `forbidden-scheme-data`, `blocked-unknown-external-param`.
      - Ensure tests exercise allowlist behavior (both positive and negative cases) and that non-default ports are only allowed when explicitly configured per-origin.
      - Verify that IDN names are converted to punycode for allowlist matching and that mixed Unicode/ASCII host representations are rejected.
      - Tests must also verify that nested URL decoding is bounded (e.g., max 3 iterations) and that when the bound is reached the validator returns `sanitizer-iteration-limit`.

  - Test implementation notes:
    - Tests should include encoded and unencoded variants, and verify that telemetry reason codes are emitted for failures without exposing sensitive values.
    - Add unit tests in the URL parser/validator module (example file: `src/lib/url-validator.test.ts`) covering the matrix above.

- [x] 4.2 Create navigation handler with authentication gate
  - Implement deferred navigation pattern for protected content
  - Create authentication gate that stashes target URL during login
  - Add navigation service that integrates with Expo Router
  - Write tests for authentication flows and deferred navigation
  - _Requirements: 4.4, 8.3_

- [x] 4.3 Set up Universal Links and App Links with domain verification
  - Host AASA at /.well-known/apple-app-site-association (no file extension, correct content-type)
  - Host assetlinks.json at /.well-known/assetlinks.json with SHA-256 fingerprints for release keys
  - Implement domain verification checking and testing for both platforms
  - Create web fallback page with Smart App Banner (iOS) and store buttons (Android)
  - Write integration tests for link verification, fallback behavior, and store redirects
  - _Requirements: 8.1, 8.2, 8.6, 8.7, 8.8_

- [ ] 5. Build notification preference management system
  - Create preference service with channel/category mapping
  - Implement quiet hours functionality with app-level suppression
  - Add permission management with educational flows and deep links to settings
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 5.7, 10.1, 10.2, 10.3, 10.5, 10.7_

- [x] 5.1 Implement notification preference service with platform mapping
  - Create preference management service that maps to Android channels and iOS categories
  - Implement preference validation and default value handling
  - Add preference sync with WatermelonDB and Supabase backend
  - Write unit tests for preference operations and platform mapping
  - _Requirements: 3.3, 10.3, 10.7_

- [x] 5.2 Create permission management with educational flows
  - Implement pre-permission education screens following Apple HIG
  - Add contextual permission requests for community and cultivation features
  - Create deep links to system settings for denied permissions
  - Write tests for permission flows and educational UI
  - _Requirements: 3.1, 3.2, 3.7, 5.7, 10.1, 10.2, 10.5_

- [x] 5.3 Build quiet hours functionality with app-level suppression
  - Implement quiet hours configuration with time range selection
  - Add app-level notification suppression during quiet hours
  - Create quiet hours validation and timezone handling
  - Write tests for quiet hours logic and edge cases
  - _Requirements: 3.4_

- [x] 6. Create in-app notification center with offline support
  - Implement notification storage and retrieval with WatermelonDB
  - Create notification list UI with read/unread states and badge management
  - Add pagination and archiving for notification history
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 6.1 Implement notification storage service with WatermelonDB
  - Create notification storage service with read/unread tracking
  - Implement notification archiving after 30 days (configurable)
  - Add notification cleanup and GDPR deletion functionality
  - Write unit tests for storage operations and data lifecycle
  - _Requirements: 6.1, 6.3, 6.5, 6.7_

- [x] 6.2 Build notification list UI with pagination and filtering
  - Create notification list component with date organization
  - Implement cursor-based pagination for efficient loading
  - Add read/unread visual states and mark-as-read functionality
  - Write component tests for UI interactions and state management
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 6.3 Create badge management system with platform constraints
  - Implement badge count calculation based on unread notifications
  - Add badge display for in-app notification center (Android: no numeric icon badges)
  - Create badge sync with server unread count
  - Write tests for badge counting and platform-specific behavior
  - _Requirements: 6.4_

- [ ] 7. Implement push notification handling with grouping and deduplication
  - Create push notification receiver with foreground/background handling
  - Implement notification grouping for Android and threading for iOS
  - Add notification deduplication using collapse keys and thread IDs
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 9.1, 9.2, 9.3, 9.6, 9.7_

- [ ] 7.1 Create push notification receiver service
  - Implement foreground and background message handling
  - Add notification presentation logic with channel/category routing
  - Create notification tap handling with deep link integration
  - Write tests for message handling and notification presentation
  - _Requirements: 1.1, 9.1, 9.2_

- [ ] 7.2 Implement notification grouping and deduplication
  - Server sets collapse_key (Android) and apns-collapse-id (iOS) with per-post thread-id
  - Create Android notification grouping with group summary notifications on client
  - Implement iOS notification threading with thread identifiers for visual grouping
  - Add unit tests that verify 5 notifications in 5 minutes coalesce properly
  - Write tests for grouping behavior and server-side deduplication logic
  - _Requirements: 1.4, 1.5_

- [ ] 7.3 Build background notification processing with platform constraints
  - Implement background message handling respecting platform limitations
  - Add data sync operations for background notifications
  - Create background processing with Doze mode and battery optimization handling
  - Write tests for background processing and platform constraint handling
  - _Requirements: 9.3, 9.5, 9.6, 9.7_

- [ ] 8. Create Supabase Edge Function for push notification delivery
  - Implement Edge Function for FCM/APNs integration with user preference checking
  - Create notification payload formatting for Android and iOS platforms
  - Add delivery tracking and analytics with database logging
  - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6_

- [ ] 8.1 Implement Supabase Edge Function for Expo Push Service delivery
  - Create Edge Function that posts to Expo Push API with user token retrieval and preference checking
  - Implement Expo push ticket handling and receipt polling for delivery status
  - Add token invalidation on DeviceNotRegistered errors from Expo receipts
  - Write Edge Function tests for Expo Push integration and error handling
  - _Requirements: 7.1, 7.5_

- [ ] 8.2 Create notification delivery tracking with Expo receipts
  - Implement delivery tracking using Expo push tickets and receipts
  - Add notification_queue status transitions: pending → sent → opened/failed
  - Create analytics service with "delivery rate" = sent/attempted (document receipt limitations)
  - Alert if sent/attempted ratio falls below 95%
  - Write tests for Expo receipt processing and analytics data collection
  - _Requirements: 7.1, 7.2, 7.4, 7.6_

- [ ] 8.3 Set up database triggers for automatic community notifications
  - Create database triggers for post replies and likes
  - Implement automatic Edge Function calls from database events
  - Add trigger configuration for different notification types
  - Write integration tests for trigger-based notifications
  - _Requirements: 1.1, 1.2_

- [ ] 9. Build notification analytics and monitoring system
  - Implement delivery and engagement tracking with platform limitations
  - Create analytics dashboard for notification performance metrics
  - Add error tracking and alerting for delivery failures
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [ ] 9.1 Implement analytics tracking service with platform constraints
  - Create analytics service using notification_queue for server acceptance tracking and client open events
  - Add platform-specific tracking limitations (no per-device delivery receipts on iOS; Expo receipts report handoff only)
  - Implement message ID correlation for push-to-open tracking in Supabase
  - Write tests for analytics collection and platform-specific behavior
  - _Requirements: 7.1, 7.2, 7.6_

- [ ] 9.2 Create notification performance monitoring
  - Implement delivery rate monitoring with 95% threshold alerting
  - Add latency tracking for end-to-end notification delivery
  - Create error tracking for failed deliveries and token issues
  - Write monitoring tests and alert validation
  - _Requirements: 7.6, 11.1_

- [ ] 10. Implement error handling and graceful degradation
  - Create comprehensive error handling for all notification scenarios
  - Implement fallback strategies for permission denials and delivery failures
  - Add user-friendly error messages and recovery flows
  - _Requirements: All error handling scenarios from requirements_

- [ ] 10.1 Create notification error handling service
  - Implement error categorization and handling strategies
  - Add graceful degradation for permission denials and delivery failures
  - Create user-friendly error messages and recovery flows
  - Write tests for error scenarios and fallback behavior
  - _Requirements: Error Handling section from design_

- [ ] 10.2 Implement fallback notification strategies
  - Create in-app notification fallbacks when push notifications fail
  - Add local notification fallbacks for critical reminders
  - Implement badge-only mode for users who opt out of notifications
  - Write tests for fallback scenarios and degraded functionality
  - _Requirements: Error Handling section from design_

- [ ] 11. Create comprehensive testing suite for all notification scenarios
  - Implement unit tests for all notification services and components
  - Create integration tests for end-to-end notification flows
  - Add platform-specific testing for Android channels and iOS categories
  - _Requirements: Testing Strategy from design_

- [ ] 11.1 Write unit tests for notification services
  - Create comprehensive unit tests for all notification service classes
  - Add mock implementations for platform-specific APIs
  - Test error scenarios and edge cases for each service
  - Achieve >90% code coverage for notification system
  - _Requirements: Testing Strategy from design_

- [ ] 11.2 Create integration tests for notification flows
  - Implement end-to-end tests for push notification delivery and handling
  - Add tests for deep link navigation from notifications
  - Create tests for preference changes affecting notification behavior
  - Test offline/online scenarios and data synchronization
  - _Requirements: Testing Strategy from design_

- [ ] 11.3 Build platform-specific testing suite
  - Create Android-specific tests for channels, permissions, and exact alarms
  - Implement iOS-specific tests for categories, actions, and notification limits
  - Add tests for Universal Links and App Links verification
  - Test background processing and platform constraint handling
  - _Requirements: Testing Strategy from design_

- [ ] 12. Integrate notification system with existing GrowBro features
  - Connect notification system with community features (posts, replies, likes)
  - Integrate with cultivation calendar for task reminders
  - Add notification preferences to user settings screens
  - _Requirements: Integration with existing app features_

- [ ] 12.1 Integrate with community features
  - Connect notification system to post reply and like events
  - Add notification triggers for community interactions
  - Implement community notification preferences in user settings
  - Write integration tests for community notification flows
  - _Requirements: 1.1, 1.2_

- [ ] 12.2 Integrate with cultivation calendar system
  - Connect notification system to task scheduling and reminders
  - Add cultivation reminder preferences and scheduling options
  - Implement task completion notification cancellation
  - Write integration tests for cultivation notification flows
  - _Requirements: 2.1, 2.4, 2.5_

- [ ] 12.3 Add notification preferences to user settings UI
  - Create notification settings screen with category toggles
  - Add quiet hours configuration UI
  - Implement permission management UI with deep links to system settings
  - Write UI tests for settings interactions and preference updates
  - _Requirements: 3.2, 3.4, 3.7, 5.7, 10.5_

- [ ] 13. Implement additional platform-specific constraints and optimizations
  - Add payload size limits and truncation policies
  - Implement PendingIntent audit for Android 12+ trampoline compliance
  - Create badge count limitations for Android launchers
  - _Requirements: Platform-specific constraints from design_

- [ ] 13.1 Implement payload size limits and truncation policy
  - Add server-side payload validation with 4KB limit for APNs and FCM
  - Implement automatic body truncation and move long content behind deep links
  - Create payload size testing and validation
  - Write tests for payload truncation and size limit enforcement
  - _Requirements: Platform-specific constraints_

- [ ] 13.2 Implement PendingIntent audit for Android 12+ compliance
  - Ensure FLAG_IMMUTABLE default for all PendingIntents
  - Remove notification trampolines and use direct Activity launches
  - Add PendingIntent validation and compliance checking
  - Write tests for Android 12+ trampoline compliance
  - _Requirements: Android 12+ trampoline restrictions_

- [ ] 13.3 Handle platform-specific badge limitations
  - Document that numeric icon badges aren't guaranteed across Android launchers
  - Implement in-app badge counts only for Android
  - Add iOS badge count management with proper clearing
  - Write tests for badge behavior across platforms
  - _Requirements: Platform-specific badge constraints_

- [ ] 13.4 Add background processing constraints and realistic SLAs
  - Document iOS background updates as best-effort with reconciliation on foreground
  - Implement realistic SLAs for background notification processing
  - Add foreground reconciliation for missed background updates
  - Write tests for background processing limitations and recovery
  - _Requirements: 9.5, Background processing constraints_
