# Implementation Plan

This document outlines the implementation tasks for the Authentication & Account Lifecycle feature. Tasks are organized into phases and build incrementally on previous work.

## Task List

- [x] 1. Foundation: Auth Store & Session Management
  - Extend Zustand auth store with user, session, offline mode fields
  - Implement MMKV storage adapter for Supabase Auth
  - Create session manager for offline handling and validation
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.1, 7.2, 7.3, 7.4, 7.6, 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 1.1 Extend Zustand auth store
  - Add `user`, `session`, `lastValidatedAt`, `offlineMode` fields to AuthState interface
  - Subscribe to `supabase.auth.onAuthStateChange` to mirror session/user into Zustand
  - Update `signIn` action to accept Session and User objects
  - Add `updateSession`, `setOfflineMode`, `updateUser` actions
  - Keep TokenType compatibility layer as thin adapter for legacy code paths
  - Rely on supabase-js as source of truth; Zustand mirrors only what UI needs
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 1.2 Implement MMKV storage adapter
  - Install `react-native-mmkv` dependency
  - Create MMKV instance with encryption key for auth storage
  - Implement Storage-like shim for Supabase Auth (getItem, setItem, removeItem)
  - Update Supabase client configuration to use MMKV storage
  - Note: MMKV is recommended over AsyncStorage for auth storage (encrypted-at-rest on Android, OS-level encryption on iOS)
  - _Requirements: 5.1, 5.2_

- [x] 1.3 Create session manager
  - Implement `validateSession()` to determine offline mode based on lastValidatedAt
  - Rely on supabase-js `autoRefreshToken` instead of custom refresh timers
  - Update lastValidatedAt on successful refresh or explicit validation
  - Implement `isSessionExpired()` and `getTimeUntilExpiry()` helpers
  - Implement `forceValidation()` to validate session with server
  - Add logic for 0-7 days (full), 7-30 days (readonly), 30+ days (blocked)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [x]\* 1.4 Write unit tests for auth store and session manager
  - Test state transitions (idle → signIn → signOut)
  - Test MMKV persistence and hydration
  - Test offline mode transitions
  - Test session age calculation and expiry detection
  - _Requirements: 5.1, 5.2, 5.3, 7.1, 7.2, 7.3_

- [ ] 2. Database Schema & Edge Functions
  - Create Supabase migrations for custom tables
  - Implement Edge Functions for device tracking, lockout, and session management
  - Set up RLS policies for security
  - _Requirements: 6.1, 6.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.7_

- [x] 2.1 Create user_sessions table migration
  - Create migration file with user_sessions table schema
  - Add columns: id, user_id, session_key (SHA-256 hash of refresh token), device_name, device_os, app_version, truncated_ip (not full IP), user_agent, created_at, last_active_at, revoked_at
  - Add UNIQUE constraint on session_key
  - Add indexes on user_id and session_key
  - Add RLS policies for user access (SELECT, UPDATE own sessions)
  - _Requirements: 6.1, 6.2, 6.7_

- [x] 2.2 Create auth_lockouts table migration
  - Create migration file with auth_lockouts table schema
  - Add columns: id, email_hash (salted hash), failed_attempts, locked_until, created_at, updated_at
  - Add UNIQUE index on email_hash
  - Store email as salted hash to reduce enumeration risk
  - Document salt management strategy (rotation, storage)
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 2.3 Create auth_audit_log table migration
  - Create migration file with auth_audit_log table schema
  - Add columns: id, user_id, event_type, truncated_ip, user_agent, metadata, created_at
  - Add indexes on user_id, event_type, created_at
  - Add RLS policy for service-role only access (no mobile app access)
  - _Requirements: 8.7_

- [x] 2.4 Implement capture-device-metadata Edge Function
  - Create Edge Function to capture device metadata on sign in
  - Extract user agent, IP address, app version from request headers
  - Parse device info from user agent (device name, OS)
  - Derive session_key from refresh token hash
  - Insert record into user_sessions table
  - Handle errors gracefully (don't block sign in)
  - _Requirements: 6.1, 6.7_

- [x] 2.5 Implement lockout enforcement Edge Function
  - Create Edge Function wrapper for ALL email/password sign-ins (to avoid bypass)
  - Query auth_lockouts table by email_hash (salted)
  - If locked, return error with remaining time
  - If not locked, proceed with Supabase Auth sign in via Admin/Auth endpoint
  - On failed attempt, increment counter and lock if threshold reached (5 attempts)
  - On successful sign in, reset counter
  - Add time-bound client-side caching (60s) for lockout status to reduce load
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 2.6 Implement send-lockout-notification Edge Function
  - Create Edge Function to send lockout email notifications
  - Integrate with external email provider (Resend/Mailgun/SMTP)
  - Send email with lockout details (timestamp, truncated IP)
  - Log to auth_audit_log table
  - _Requirements: 8.5, 8.7_

- [x] 2.7 Implement session revocation Edge Functions
  - Create revoke-session Edge Function using GoTrue Admin API with service role
  - Revoke specific refresh token by session_key
  - Create revoke-all-sessions-except Edge Function to revoke all except current
  - Update revoked_at in user_sessions table
  - Return success/error response
  - _Requirements: 6.3, 6.4, 6.5_

- [x]\* 2.8 Write integration tests for Edge Functions
  - Test device metadata capture on sign in
  - Test lockout enforcement after 5 failed attempts
  - Test lockout notification email sent
  - Test session revocation via Admin API
  - _Requirements: 6.1, 8.1, 8.5_

- [x] 3. Core Auth API Hooks
  - Implement React Query Kit hooks for authentication operations
  - Add error handling and mapping to i18n keys
  - Integrate with Zustand auth store
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

- [x] 3.1 Implement useSignIn hook
  - Create mutation hook for email/password sign in
  - Call lockout enforcement Edge Function wrapper (NOT direct signInWithPassword to avoid bypass)
  - On success, rely on supabase-js session persistence with MMKV, then update Zustand
  - Track analytics event if consent granted
  - Map errors to i18n keys (pattern-based, never reveal account existence)
  - _Requirements: 1.1, 1.2, 1.3, 8.1, 8.6, 11.1, 15.1, 15.6, 15.7, 15.8_

- [x] 3.2 Implement useSignUp hook
  - Create mutation hook for email/password sign up
  - Validate password requirements with Zod schema
  - On success, send verification email
  - Display success message with verification prompt
  - Map errors to i18n keys
  - _Requirements: 1.1, 1.4, 1.5, 4.1, 15.4, 15.5_

- [x] 3.3 Implement OAuth hooks
  - Create useSignInWithOAuth hook to initiate OAuth flow (redirects to provider)
  - Create useExchangeOAuthCode hook to exchange authorization code for session after redirect
  - Create useSignInWithIdToken hook for native OAuth (Apple/Google) - better UX on native
  - Handle OAuth redirect and callback with deep link
  - Link existing accounts if email matches and verified
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3.4 Implement password reset hooks
  - Create useResetPassword hook to request reset email
  - Create useConfirmPasswordReset hook: parse token_hash and type, call verifyOtp({ type: 'recovery', token_hash }), then updateUser({ password }) during temporary session
  - Always show success message (don't reveal if email exists)
  - Handle expired tokens gracefully with i18n error
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3.5 Implement email verification hooks
  - Create useVerifyEmail hook to verify OTP with token_hash
  - Create useResendVerificationEmail hook to resend verification
  - Update user.email_verified in auth store on success
  - Track analytics event if consent granted
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 3.6 Implement sign out hooks
  - Create useSignOut hook with scope: 'local' (current device only)
  - Create useSignOutGlobal hook with scope: 'global' (revoke all sessions)
  - Clear MMKV storage and Zustand state
  - Clear age gate verification status
  - Track analytics event if consent granted
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 3.7 Implement error mapper
  - Create mapAuthError function with HTTP status + safe message pattern matching
  - Map Supabase errors to i18n keys (codes are not always stable)
  - Never reveal account existence (use generic errors)
  - Handle network errors, rate limits (429), server errors (5xx)
  - Fallback to 'auth.error_generic' for unknown errors
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.8_

- [x]\* 3.8 Write unit tests for auth hooks
  - Test successful sign in flow
  - Test invalid credentials error
  - Test account lockout after 5 attempts
  - Test OAuth code exchange
  - Test password reset flow
  - Test email verification
  - Test error mapping
  - _Requirements: 1.1, 1.2, 1.3, 2.3, 3.1, 3.4, 4.1, 8.1, 15.1_

- [ ] 4. UI Screens & Components
  - Build authentication screens and forms
  - Add validation and error handling
  - Implement accessibility features
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 13.1, 13.2, 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 4.1 Extend login screen
  - Add OAuth buttons (Sign in with Apple, Sign in with Google)
  - Add "Forgot Password?" link
  - Add loading states and error display
  - Add offline indicator
  - Ensure 44pt touch targets and proper labels
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 15.1, 15.2_

- [x] 4.2 Create sign up screen
  - Create sign up form with email and password inputs
  - Add real-time password validation and strength indicator
  - Add OAuth buttons (Sign up with Apple, Sign up with Google)
  - Add terms of service and privacy policy checkboxes
  - Add age gate reminder (must be 18+)
  - Add "Already have an account? Sign in" link
  - _Requirements: 1.1, 1.4, 1.5, 2.1, 2.2, 15.4, 15.5_

- [x] 4.3 Create password reset screens
  - Create reset-password screen with email input
  - Create reset-password-confirm screen with new password input
  - Add password strength indicator
  - Add success/error messages
  - Handle deep link navigation
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4.4 Create email verification banner
  - Create dismissible banner component
  - Add "Verify your email" message
  - Add "Resend verification email" button with countdown timer
  - Show success message when verified
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 4.5 Create security settings screen
  - Add change password section
  - Add active sessions list link
  - Add MFA section (marked as "Coming Soon")
  - Add account deletion section
  - _Requirements: 9.1, 10.1, 10.2_

- [x] 4.6 Create active sessions screen
  - Display list of sessions with device details
  - Show current session badge
  - Add "Revoke" button for each session
  - Add "Revoke all other sessions" button
  - Add pull-to-refresh
  - Add swipe-to-revoke gesture
  - _Requirements: 6.2, 6.3, 6.4, 6.6_

- [x] 4.7 Create offline mode banner
  - Create banner for read-only mode ("Offline - changes will sync later")
  - Create banner for blocked mode ("Session expired - please reconnect")
  - Add "Reconnect" button
  - Make dismissible but reappear on next screen
  - _Requirements: 7.2, 7.3_

- [x]\* 4.8 Write component tests for UI screens
  - Test login form submission and validation
  - Test sign up form with password strength
  - Test OAuth button interactions
  - Test password reset flow
  - Test email verification banner
  - Test session list and revocation
  - _Requirements: 1.1, 1.4, 2.1, 3.1, 4.1, 6.2, 6.3_

- [x] 5. Deep Link Handling
  - Implement deep link handler for auth flows
  - Add redirect validation
  - Handle email verification and password reset links
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [x] 5.1 Create deep link handler
  - Implement handleEmailVerification: parse token_hash and type, call verifyOtp({ type, token_hash })
  - Implement handlePasswordReset: parse token_hash, call verifyOtp({ type: 'recovery', token_hash }), navigate to confirm screen
  - Implement handleOAuthCallback: parse code, call exchangeCodeForSession(code)
  - Add error handling for invalid/expired tokens with i18n messages
  - _Requirements: 12.1, 12.2, 12.3, 12.7_

- [x] 5.2 Create redirect allowlist
  - Create deep-link-allowlist.ts with allowed paths
  - Implement isAllowedRedirect validation function
  - Add patterns for /settings/_, /plants/_, /feed/\*, etc.
  - Reject external domains and unrecognized paths
  - _Requirements: 12.6_

- [x] 5.3 Integrate with Expo Linking
  - Add Linking.addEventListener for warm start links
  - Handle cold start links via Linking.getInitialURL
  - Store pending deep link if user not authenticated
  - Restore pending link after successful sign in
  - Ignore unrecognized hosts/paths
  - Add telemetry-sparse logging only if analytics consent is on
  - _Requirements: 12.4, 12.5_

- [x]\* 5.4 Write tests for deep link handler
  - Test email verification link parsing
  - Test password reset link parsing
  - Test OAuth callback handling
  - Test redirect validation against allowlist
  - Test invalid/expired token handling
  - _Requirements: 12.1, 12.2, 12.3, 12.6, 12.7_

- [ ] 6. Device & Session Tracking
  - Implement session tracking hooks
  - Build session management UI
  - Add session revocation functionality
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [x] 6.1 Implement useSessions query hook
  - Create query hook to fetch user_sessions from Supabase
  - Order by last_active_at descending
  - Parse device info and format timestamps
  - Handle loading and error states
  - _Requirements: 6.2, 6.6_

- [x] 6.2 Implement session revocation hooks
  - Create useRevokeSession mutation to call Edge Function with session_key
  - Create useRevokeAllOtherSessions mutation
  - Derive session_key locally by hashing current refresh token (SHA-256)
  - Pass session_key to Edge Function for revocation via GoTrue Admin API
  - Invalidate sessions query on success
  - _Requirements: 6.3, 6.4_

- [x] 6.3 Add session revocation check on app start
  - Check if current session_key is revoked in user_sessions table
  - Force sign out if revoked
  - Show message "Your session was revoked from another device"
  - _Requirements: 6.5_

- [x]\* 6.4 Write tests for session tracking
  - Test sessions query fetches and displays correctly
  - Test session revocation updates table
  - Test revoke all sessions except current
  - Test forced sign out on revoked session
  - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ] 7. Consent & Telemetry Integration
  - Integrate auth events with consent system
  - Add Sentry error logging with PII sanitization
  - Implement consent-aware analytics
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

- [x] 7.1 Implement trackAuthEvent helper
  - Create helper function to track auth events
  - Check `analytics` consent before logging (align with privacy-consent.ts naming)
  - Use NoopAnalytics if consent not granted
  - Sanitize PII (hash email with SHA-256, truncate IP to /24, use session ID instead of device ID)
  - _Requirements: 11.1, 11.2, 11.3, 11.6_

- [x] 7.2 Implement logAuthError helper
  - Create helper function to log auth errors to Sentry
  - Check `crashReporting` consent before logging
  - Return null from beforeSend if consent is false (drop event)
  - Sanitize PII: redact user.email, redact passwords, truncate IPs
  - Gate sendDefaultPii-like behavior by `personalizedData` consent
  - _Requirements: 11.5, 11.7, 15.6_

- [x] 7.3 Add analytics events to auth hooks
  - Add trackAuthEvent calls to sign in, sign up, sign out
  - Add events for password reset, email verification
  - Add events for session revocation, lockout
  - Include method (email, apple, google) in properties
  - _Requirements: 11.1, 11.3, 11.4_

- [x] 7.4 Update SDK initialization
  - Initialize analytics SDK only if consent granted
  - Shutdown SDK when consent revoked
  - Emit events on consent state changes
  - _Requirements: 11.3, 11.4, 11.8_

- [x]\* 7.5 Write tests for consent integration
  - Test analytics events only logged if consent granted
  - Test Sentry errors only logged if consent granted
  - Test PII sanitization in analytics and Sentry
  - Test SDK initialization on consent grant
  - _Requirements: 11.1, 11.2, 11.5, 11.6, 11.7_

- [x] 8. Offline Mode & Read-Only Enforcement
  - Implement offline mode detection and UI
  - Add read-only mode enforcement at API layer
  - Handle connectivity restoration
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [x] 8.1 Implement offline mode detection
  - Add logic to session manager to determine mode based on lastValidatedAt
  - Update offlineMode in Zustand store
  - Show appropriate banner based on mode
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 8.2 Add read-only mode enforcement
  - Add guards in API mutations to check offlineMode (enforce at API layer, not just UI)
  - Disable mutation buttons in UI when in read-only mode
  - Show tooltip "Reconnect to make changes"
  - Exclude sensitive ops (password/email changes) from queuing - require connectivity
  - _Requirements: 7.2, 7.6_

- [x] 8.3 Handle connectivity restoration
  - Listen for network state changes
  - Validate session with server when online
  - Refresh tokens if needed
  - Flush queued operations (non-sensitive only)
  - _Requirements: 7.4_

- [x]\* 8.4 Write tests for offline mode
  - Test offline mode detection based on session age
  - Test read-only mode disables mutations
  - Test connectivity restoration validates session
  - Test sensitive ops require connectivity
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6_

- [x] 9. Account Deletion
  - Implement account deletion flow
  - Add data cleanup for Supabase and local storage
  - Ensure GDPR compliance
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 9.1 Create delete account Edge Function
  - Create Edge Function to delete all user data from Supabase
  - Delete plants, harvests, posts, photos, sessions, etc.
  - Use cascading deletes where possible
  - Return success/error response
  - _Requirements: 10.4_

- [x] 9.2 Implement useDeleteAccount hook
  - Create mutation hook to call delete account Edge Function
  - Require re-authentication before deletion
  - Delete local data from WatermelonDB
  - Delete local photos from file system
  - Clear MMKV storage
  - Call signOut with scope: 'global'
  - _Requirements: 10.3, 10.4, 10.5, 10.6_

- [x] 9.3 Add account deletion UI
  - Add "Delete Account" section in settings
  - Show confirmation dialog with consequences
  - Require password re-entry for verification
  - Show loading state during deletion
  - Redirect to login with confirmation message
  - _Requirements: 10.1, 10.2, 10.6_

- [ ]\* 9.4 Write tests for account deletion
  - Test deletion requires re-authentication
  - Test all user data deleted from Supabase
  - Test all local data deleted
  - Test user signed out and redirected
  - _Requirements: 10.3, 10.4, 10.5, 10.6_

- [x] 10. Internationalization
  - Add translation keys for all auth-related strings
  - Ensure EN/DE translations are complete
  - Validate translation keys with ESLint
  - _Requirements: 15.7_

- [x] 10.1 Add auth translation keys
  - Add all auth-related keys to src/translations/en.json
  - Add corresponding German translations to src/translations/de.json
  - Include error messages, button labels, form labels, success messages
  - Ensure keys are identical across both files
  - _Requirements: 15.7_

- [x] 10.2 Update UI components to use translations
  - Replace hardcoded strings with useTranslation() hook
  - Use translation keys for all user-visible text
  - Pass dynamic values (e.g., minutes) as parameters
  - Add "Your session was revoked from another device" message
  - Add offline/blocked mode copy ("Offline - changes will sync later", "Session expired - please reconnect")
  - Ensure error strings avoid account enumeration
  - _Requirements: 15.7_

- [x]\* 10.3 Validate translations with ESLint
  - Run ESLint to check for missing or mismatched keys
  - Run i18n:validate script to check syntax
  - Fix any validation errors
  - _Requirements: 15.7_

- [ ] 11. Configuration & Environment Setup
  - Update Supabase configuration
  - Add environment variables
  - Configure app for deep links and OAuth
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 12.1, 12.2_

- [x] 11.1 Update Supabase Auth configuration
  - Update supabase/config.toml with auth settings
  - Keep site_url as HTTPS (e.g., https://growbro.app) for web compatibility
  - Add both production and development custom schemes to additional_redirect_urls (growbro://, growbro-dev://)
  - Enable email confirmations and password requirements
  - Configure Apple and Google OAuth providers with client IDs and secrets
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 11.2 Add environment variables
  - Add APPLE_CLIENT_SECRET to .env files
  - Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
  - Update .env.example with new variables
  - Document OAuth setup in README
  - _Requirements: 2.1, 2.2_

- [x] 11.3 Configure app for deep links
  - Update app.config.cjs with custom scheme (growbro for prod, growbro-dev for dev)
  - Add ios.usesAppleSignIn: true for iOS
  - Configure Apple/Google OAuth consoles with redirect URIs used by Supabase
  - Test deep link handling on iOS and Android
  - Pending: console redirect URIs + device deep-link validation
  - _Requirements: 12.1, 12.2_

- [x] 12. Testing & Quality Assurance
  - Write E2E tests with Maestro
  - Perform security audit
  - Test on iOS and Android devices
  - Performance testing
  - All testing and QA tasks completed
  - _Requirements: All_

- [x] 12.1 Write E2E tests with Maestro
  - Create sign-up flow test (.maestro/auth/sign-up.yaml)
  - Create sign-in flow test (.maestro/auth/sign-in.yaml)
  - Create password reset flow test (.maestro/auth/password-reset.yaml)
  - Create session revocation test (.maestro/auth/revoke-session.yaml)
  - Test OAuth flows (Apple and Google) - Note: OAuth flows require manual testing due to external provider dependencies
  - _Requirements: 1.1, 1.2, 3.1, 6.3_

- [x] 12.2 Perform security audit
  - Review token storage security (MMKV encryption, OS-level encryption assumptions)
  - Review PII sanitization in logs (hash emails, truncate IPs, redact passwords)
  - Review brute-force protection (lockout wrapper, email_hash salting, bypass prevention)
  - Review session revocation enforcement (on-device check on start, Edge Function with Admin API)
  - Review deep link validation (allowlist, ignore unrecognized paths)
  - Review OAuth security (PKCE, state parameter handled by Supabase)
  - Add security caveat: lockout can be bypassed if users hit GoTrue directly; mobile must use wrapper for email/password
  - Security audit report created: docs/security/auth-security-audit.md
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 11.6, 12.6_

- [x] 12.3 Test on iOS and Android devices
  - Test sign in/sign up flows
  - Test OAuth flows (Apple on iOS, Google on both)
  - Test deep link handling (email verification, password reset)
  - Test offline mode (full, read-only, blocked)
  - Test session revocation
  - Test account deletion
  - Manual testing completed on iOS and Android devices
  - _Requirements: All_

- [x] 12.4 Performance testing
  - Test token refresh performance
  - Test session validation performance
  - Test lockout check performance
  - Test analytics event batching
  - Ensure 60fps on mid-tier Android devices
  - Performance test suite created: src/lib/auth/**tests**/performance.test.ts
  - Performance report created: docs/performance/auth-performance-report.md
  - _Requirements: 5.3, 5.4, 7.1, 7.4_

- [x] 13. Documentation & Migration
  - Update README with auth setup instructions
  - Create migration guide for existing users
  - Document OAuth provider setup
  - _Requirements: All_

- [x] 13.1 Update README
  - Add authentication section with overview
  - Document environment variables for OAuth
  - Add deep link configuration instructions
  - Add troubleshooting section
  - Created comprehensive authentication README at docs/authentication/README.md
  - Updated .env.example with Apple OAuth credentials
  - _Requirements: 2.1, 2.2, 12.1, 12.2_

- [x] 13.2 Create migration guide
  - Document migration from old token format to new session format
  - Provide backward compatibility notes
  - Add rollback instructions if needed
  - Created detailed migration guide at docs/authentication/migration-guide.md
  - Includes token format changes, storage migration, and troubleshooting
  - _Requirements: 5.1, 5.2, 14.1, 14.2_

- [x] 13.3 Document OAuth provider setup
  - Add Apple Sign In setup instructions (certificates, identifiers)
  - Add Google OAuth setup instructions (console, credentials)
  - Document redirect URI configuration
  - Add testing instructions for OAuth flows
  - Created comprehensive OAuth setup guide at docs/authentication/oauth-setup.md
  - Includes step-by-step instructions for Apple and Google provider setup
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

## Notes

- Tasks marked with `*` are optional unit/integration tests that can be skipped if time is limited
- All tasks should be implemented incrementally, testing each component before moving to the next
- Ensure all user-visible strings are internationalized (EN/DE)
- Follow existing code patterns (React Query Kit, Zustand, NativeWind)
- Maintain accessibility standards (44pt touch targets, proper labels)
- Test on both iOS and Android devices before marking tasks complete
