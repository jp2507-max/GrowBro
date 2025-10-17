# Requirements Document

## Introduction

This document outlines the requirements for a comprehensive Authentication & Account Lifecycle system for GrowBro. The system will provide secure, privacy-focused authentication with multiple sign-in methods, account management capabilities, and robust security features including session management, device tracking, and brute-force protection.

The current implementation has basic Zustand-based auth state management with token storage, Supabase client configuration, and age-gate verification. This spec will extend the system to include full Supabase Auth integration with email/password, OAuth providers (Apple/Google), password reset, email verification, MFA (backlog), device/session management, offline session handling, brute-force protection, and consent-aware telemetry gating.

### Technical Context

**Supabase Auth Capabilities:**

- Supabase Auth provides built-in email/password, OAuth, password reset, and email verification
- Device metadata (IP, user agent) is available via Supabase Auth hooks but requires custom Edge Functions to persist
- Rate limiting is handled by Supabase Auth (60 requests/hour per IP for password attempts)
- Custom lockout logic requires a Supabase table (`auth_lockouts`) and RPC functions for enforcement

**Deep Link Configuration:**

- URI scheme: `growbro://` (production), `growbro-dev://` (development)
- Allowed hosts: `auth`, `verify-email`, `reset-password`
- Redirect allowlist stored in `src/lib/navigation/deep-link-allowlist.ts`
- Invalid/expired tokens surface localized errors via i18n keys (`auth.error_*`)

**Offline Session Policy:**

- Session validity tracked via `lastValidatedAt` timestamp in AsyncStorage
- 0-7 days: full read/write access
- 7-30 days: read-only mode (mutations queued, UI shows "Offline - changes will sync later")
- 30+ days: force re-authentication on next connectivity
- Enforcement logic in `src/lib/auth/offline-session-manager.ts`

**Consent & Telemetry:**

- Consent state stored in Zustand (`src/lib/privacy-consent.ts`) and persisted to SecureStore
- Analytics SDK initialization deferred until consent granted (via `SDKGate` in `src/app/_layout.tsx`)
- Sentry PII redaction via `beforeSend` hook (checks consent state before sending)
- Auth events only logged if `telemetry` consent is `true`

**MFA Prerequisites (Backlog):**

- Supabase supports TOTP via `supabase.auth.mfa.enroll()` and `supabase.auth.mfa.verify()`
- Backup codes stored in custom `user_mfa_backup_codes` table (encrypted)
- UI flows require QR code generation and recovery code display/download

## Requirements

### Requirement 1: Email/Password Authentication

**User Story:** As a user, I want to sign up and sign in with my email and password, so that I can securely access my grow data.

#### Acceptance Criteria

1. WHEN a user provides a valid email and password on the sign-up screen THEN the system SHALL create a new account via Supabase Auth and send a verification email
2. WHEN a user provides valid credentials on the login screen THEN the system SHALL authenticate the user and establish a session
3. WHEN a user provides invalid credentials THEN the system SHALL display an appropriate error message without revealing whether the email exists
4. WHEN a user signs up THEN the system SHALL enforce password requirements (minimum 8 characters, at least one uppercase, one lowercase, one number)
5. WHEN authentication succeeds THEN the system SHALL store the session tokens securely in AsyncStorage and update the Zustand auth state
6. WHEN authentication succeeds THEN the system SHALL redirect the user to the age gate if not verified, or to the main app if verified

### Requirement 2: OAuth Authentication (Apple & Google)

**User Story:** As a user, I want to sign in with my Apple or Google account, so that I can quickly access the app without creating a new password.

#### Acceptance Criteria

1. WHEN a user taps "Sign in with Apple" THEN the system SHALL initiate the Apple OAuth flow via Supabase Auth
2. WHEN a user taps "Sign in with Google" THEN the system SHALL initiate the Google OAuth flow via Supabase Auth
3. WHEN OAuth redirect returns to the app with authorization code THEN the system SHALL exchange the code via `supabase.auth.exchangeCodeForSession()` to create or link the account and establish a session
4. WHEN OAuth authentication fails or is cancelled THEN the system SHALL display an appropriate error message and remain on the login screen
5. WHEN a user signs in with OAuth for the first time THEN the system SHALL create a new account with the provider's email
6. WHEN a user signs in with OAuth and the email already exists THEN the system SHALL link the OAuth provider to the existing account if the email is verified

### Requirement 3: Password Reset & Recovery

**User Story:** As a user, I want to reset my password if I forget it, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a user taps "Forgot Password" on the login screen THEN the system SHALL navigate to the password reset screen
2. WHEN a user enters their email on the password reset screen THEN the system SHALL send a password reset email via Supabase Auth
3. WHEN a user clicks the reset link in the email THEN the system SHALL open the app with a deep link to the password reset confirmation screen
4. WHEN a user enters a new password on the reset confirmation screen THEN the system SHALL update the password and authenticate the user
5. WHEN the password reset link expires (after 1 hour) THEN the system SHALL display an error and prompt the user to request a new link
6. WHEN a password reset is requested THEN the system SHALL always display a success message regardless of whether the email exists (to prevent email enumeration)

### Requirement 4: Email Verification

**User Story:** As a user, I want to verify my email address, so that I can ensure my account is secure and recover it if needed.

#### Acceptance Criteria

1. WHEN a user signs up with email/password THEN the system SHALL send a verification email via Supabase Auth
2. WHEN a user clicks the verification link in the email THEN the system SHALL open the app with a deep link and mark the email as verified
3. WHEN a user's email is not verified THEN the system SHALL display a banner prompting them to verify their email
4. WHEN a user taps "Resend verification email" THEN the system SHALL send a new verification email
5. WHEN a user signs in with an unverified email THEN the system SHALL allow access but display the verification prompt
6. WHEN email verification succeeds THEN the system SHALL update the user's profile and dismiss the verification banner

### Requirement 5: Session Management & Persistence

**User Story:** As a user, I want my session to persist across app restarts, so that I don't have to log in every time I open the app.

#### Acceptance Criteria

1. WHEN a user successfully authenticates THEN the system SHALL store the session tokens in AsyncStorage with encryption
2. WHEN the app starts THEN the system SHALL hydrate the auth state from AsyncStorage and validate the session with Supabase
3. WHEN the session token expires THEN the system SHALL automatically refresh it using the refresh token
4. WHEN the refresh token expires or is invalid THEN the system SHALL sign out the user and redirect to the login screen
5. WHEN a user is offline THEN the system SHALL allow access using the cached session if it was valid within the last 7 days
6. WHEN a user signs out THEN the system SHALL clear all session data from AsyncStorage and Zustand state

### Requirement 6: Device & Session Tracking

**User Story:** As a user, I want to see which devices are signed into my account, so that I can manage my security and revoke access if needed.

#### Acceptance Criteria

1. WHEN a user signs in on a new device THEN the system SHALL record the device information (device name, OS, app version, truncated IP, timestamp) via a Supabase Edge Function that persists to a custom `user_sessions` table with session_key (hash of refresh token)
2. WHEN a user navigates to the "Active Sessions" screen in settings THEN the system SHALL display a list of all active sessions with device details fetched from the `user_sessions` table
3. WHEN a user taps "Revoke" on a session THEN the system SHALL call Edge Function to revoke that specific refresh token via GoTrue Admin API and update `revoked_at` in `user_sessions` table
4. WHEN a user taps "Revoke All Other Sessions" THEN the system SHALL call Edge Function to revoke all refresh tokens except current via GoTrue Admin API
5. WHEN a session is revoked THEN the system SHALL force the affected device to sign out on next app start (by checking if current session_key is revoked)
6. WHEN a user views their sessions THEN the system SHALL highlight the current session (matched by session ID) and display the last active timestamp for each
7. WHEN device metadata is captured THEN the system SHALL use Supabase Auth hooks (`auth.users` table metadata) and custom Edge Function to extract IP, user agent, and app version from request headers

### Requirement 7: Offline Session Handling

**User Story:** As a user, I want to continue using the app offline with my existing session, so that I can track my grows without an internet connection.

#### Acceptance Criteria

1. WHEN a user is offline and has a valid cached session (validated within last 7 days) THEN the system SHALL allow full read/write app access
2. WHEN a user is offline and the cached session is 7-30 days old THEN the system SHALL enable read-only mode: display banner "Offline - changes will sync later", disable mutations in UI, queue write operations in WatermelonDB sync queue
3. WHEN a user is offline and the cached session is older than 30 days THEN the system SHALL display "Session expired - please reconnect to continue" and block app access until connectivity is restored
4. WHEN connectivity is restored THEN the system SHALL validate the cached session with Supabase (`supabase.auth.getSession()`), refresh tokens if needed, and flush queued operations
5. WHEN a user attempts to sign in while offline THEN the system SHALL display localized error `auth.error_offline_login` ("Authentication requires internet connection")
6. WHEN session age is checked THEN the system SHALL read `lastValidatedAt` timestamp from AsyncStorage key `auth.session.lastValidated` and compare to current time
7. WHEN read-only mode is active THEN the system SHALL disable all mutation buttons (add plant, create task, etc.) and show tooltip "Reconnect to make changes"

### Requirement 8: Brute-Force Protection & Account Lockout

**User Story:** As a user, I want my account protected from brute-force attacks, so that unauthorized users cannot guess my password.

#### Acceptance Criteria

1. WHEN a user enters incorrect credentials 5 times within 15 minutes THEN the system SHALL temporarily lock the account for 15 minutes via Edge Function wrapper that enforces lockout checks before calling Supabase Auth
2. WHEN an account is locked THEN the system SHALL display localized message `auth.error_account_locked` ("Too many failed attempts. Try again in {minutes} minutes")
3. WHEN the lockout period expires THEN the system SHALL automatically unlock the account (lockout record TTL expires or RPC checks `locked_until` timestamp)
4. WHEN a user successfully authenticates THEN the system SHALL reset the failed login attempt counter via RPC `reset_lockout_counter(email)`
5. WHEN a user is locked out THEN the system SHALL send an email notification via Edge Function using external email provider (Resend/Mailgun/SMTP) with timestamp and truncated IP address
6. WHEN a user attempts to sign in during lockout THEN the system SHALL return generic error "Invalid email or password" (no timing or existence hints)
7. WHEN lockout events occur THEN the system SHALL log to `auth_audit_log` table (service-role accessible only, not by mobile app) with user_id, event_type, truncated_ip, timestamp
8. WHEN Supabase Auth rate limit (60 req/hour per IP) is exceeded THEN the system SHALL display `auth.error_rate_limit` ("Too many requests. Please try again later")

### Requirement 9: Multi-Factor Authentication (MFA) - Backlog

**User Story:** As a user, I want to enable two-factor authentication, so that my account has an additional layer of security.

#### Acceptance Criteria

1. WHEN a user navigates to security settings THEN the system SHALL display an option to enable MFA (marked as "Coming Soon")
2. WHEN MFA is implemented THEN the system SHALL support TOTP-based authentication (Google Authenticator, Authy, etc.)
3. WHEN a user enables MFA THEN the system SHALL generate a QR code and backup codes
4. WHEN a user signs in with MFA enabled THEN the system SHALL prompt for the TOTP code after password verification
5. WHEN a user enters an invalid TOTP code 3 times THEN the system SHALL temporarily lock MFA verification for 5 minutes
6. WHEN a user loses access to their MFA device THEN the system SHALL allow recovery using backup codes

### Requirement 10: Account Deletion & Data Cleanup

**User Story:** As a user, I want to permanently delete my account and all associated data, so that I can exercise my right to be forgotten.

#### Acceptance Criteria

1. WHEN a user navigates to account settings THEN the system SHALL display a "Delete Account" option
2. WHEN a user taps "Delete Account" THEN the system SHALL display a confirmation dialog explaining the consequences
3. WHEN a user confirms account deletion THEN the system SHALL require re-authentication to verify identity
4. WHEN account deletion is confirmed THEN the system SHALL delete all user data from Supabase (plants, harvests, posts, photos, etc.)
5. WHEN account deletion is confirmed THEN the system SHALL delete all local data from WatermelonDB and file system
6. WHEN account deletion completes THEN the system SHALL sign out the user and redirect to the login screen with a confirmation message

### Requirement 11: Consent-Aware Telemetry & Analytics

**User Story:** As a user, I want my authentication events to respect my privacy preferences, so that my data is only collected if I consent.

#### Acceptance Criteria

1. WHEN a user signs in THEN the system SHALL only log analytics events (`auth.sign_in`, `auth.sign_up`) if `analytics` consent is `true` in Zustand store (`src/lib/privacy-consent.ts`)
2. WHEN a user has not consented to telemetry THEN the system SHALL use `NoopAnalytics` client (no network calls) for authentication events
3. WHEN a user grants analytics consent THEN the system SHALL initialize analytics SDK via `SDKGate.initializeSDK('analytics')` and begin logging authentication events
4. WHEN a user revokes analytics consent THEN the system SHALL call `SDKGate.shutdownSDK('analytics')` and replace client with `NoopAnalytics`
5. WHEN a user has consented to crash diagnostics but not telemetry THEN the system SHALL only log authentication errors to Sentry (via `beforeSend` hook that checks `crashReporting` consent)
6. WHEN authentication events are logged THEN the system SHALL sanitize PII: hash email with SHA-256, truncate IP to /24 subnet, replace device ID with session ID
7. WHEN Sentry captures auth errors THEN the system SHALL redact email/password fields via `beforeSend` hook (replace with `[REDACTED]`); if `crashReporting` consent is `false` THEN return `null` to drop the event; PII redaction is gated by `personalizedData` consent
8. WHEN consent state changes THEN the system SHALL persist to SecureStore key `privacy-consent.v1` and emit event to update SDK initialization

### Requirement 12: Deep Link Handling for Auth Flows

**User Story:** As a user, I want to seamlessly handle email verification and password reset links, so that I can complete these flows without friction.

#### Acceptance Criteria

1. WHEN a user clicks an email verification link (`growbro://verify-email?token_hash=...&type=signup`) THEN the system SHALL call `supabase.auth.verifyOtp({ type: 'signup', token_hash })` and display localized success message `auth.email_verified`
2. WHEN a user clicks a password reset link (`growbro://reset-password?token_hash=...&type=recovery`) THEN the system SHALL call `supabase.auth.verifyOtp({ type: 'recovery', token_hash })` to obtain temporary session, then navigate to `/reset-password-confirm` screen
3. WHEN a deep link token is invalid or expired THEN the system SHALL display localized error `auth.error_invalid_token` ("This link is invalid or has expired. Please request a new one.")
4. WHEN a user is not signed in and clicks a protected deep link THEN the system SHALL store path in `pendingDeepLink` (AsyncStorage), redirect to `/login`, and restore path after successful auth
5. WHEN a deep link is opened while the app is running THEN the system SHALL use Expo Linking `addEventListener` to handle without restart
6. WHEN a deep link contains a redirect parameter (`?redirect=/settings/profile`) THEN the system SHALL validate against allowlist in `src/lib/navigation/deep-link-allowlist.ts` (allowed paths: `/settings/*`, `/plants/*`, `/feed/*`) and reject with `auth.error_invalid_redirect`
7. WHEN deep link validation fails THEN the system SHALL log to Sentry (if crash diagnostics consent granted) with sanitized URL (token redacted)

### Requirement 13: Sign Out & Session Cleanup

**User Story:** As a user, I want to sign out of my account, so that I can secure my data when sharing my device.

#### Acceptance Criteria

1. WHEN a user taps "Sign Out" in settings THEN the system SHALL display a confirmation dialog
2. WHEN sign out is confirmed THEN the system SHALL call `supabase.auth.signOut({ scope: 'local' })` to revoke the current device session
3. WHEN sign out is confirmed THEN the system SHALL clear all session data from MMKV storage and Zustand state
4. WHEN sign out is confirmed THEN the system SHALL clear the age gate verification status
5. WHEN sign out is confirmed THEN the system SHALL redirect the user to the login screen
6. WHEN a user signs out THEN the system SHALL optionally offer to keep local data for offline access (with a warning about security)

### Requirement 14: Auth State Synchronization

**User Story:** As a developer, I want the auth state to be synchronized across all app components, so that the UI reflects the current authentication status.

#### Acceptance Criteria

1. WHEN the auth state changes THEN the system SHALL update the Zustand store and trigger re-renders in subscribed components
2. WHEN a user signs in THEN the system SHALL update the auth state to 'signIn' with the user's session tokens
3. WHEN a user signs out THEN the system SHALL update the auth state to 'signOut' and clear the tokens
4. WHEN the app starts THEN the system SHALL hydrate the auth state from AsyncStorage before rendering protected routes
5. WHEN a session expires THEN the system SHALL update the auth state to 'signOut' and redirect to login
6. WHEN auth state is updated THEN the system SHALL emit events that can be consumed by other services (analytics, sync engine, etc.)

### Requirement 15: Error Handling & User Feedback

**User Story:** As a user, I want clear error messages when authentication fails, so that I understand what went wrong and how to fix it.

#### Acceptance Criteria

1. WHEN authentication fails due to invalid credentials THEN the system SHALL display localized message `auth.error_invalid_credentials` (EN: "Invalid email or password", DE: "Ungültige E-Mail oder Passwort")
2. WHEN authentication fails due to network issues THEN the system SHALL display `auth.error_network` (EN: "Unable to connect. Please check your internet connection.", DE: "Verbindung fehlgeschlagen. Bitte überprüfen Sie Ihre Internetverbindung.")
3. WHEN authentication fails due to server errors (5xx) THEN the system SHALL display `auth.error_server` (EN: "Something went wrong. Please try again later.", DE: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.")
4. WHEN a user's email is already registered THEN the system SHALL display `auth.error_email_exists` (EN: "An account with this email already exists", DE: "Ein Konto mit dieser E-Mail existiert bereits")
5. WHEN a password doesn't meet requirements THEN the system SHALL display specific validation errors via Zod schema with i18n keys: `auth.error_password_min_length`, `auth.error_password_uppercase`, `auth.error_password_number`
6. WHEN an error occurs THEN the system SHALL log to Sentry (if `crashReporting` consent is `true`) with sanitized details: email replaced with hash, password redacted, IP truncated
7. WHEN error messages are displayed THEN the system SHALL use `react-i18next` `useTranslation()` hook to fetch localized strings from `src/translations/{en,de}.json`
8. WHEN Supabase returns error codes THEN the system SHALL map to i18n keys: `invalid_credentials` → `auth.error_invalid_credentials`, `email_not_confirmed` → `auth.error_email_not_verified`, `user_already_exists` → `auth.error_email_exists`
