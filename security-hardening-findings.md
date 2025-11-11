# Security Hardening Findings – November 2025

This document captures the critical issues uncovered while validating GrowBro against `.github/prompts/plan-securityHardening.prompt.md` and outlines a remediation plan.

## Summary

- **Critical exposures (resolved)** – leaked signing key, insecure token storage, unauthenticated service role edge function, non-functional database lockout trigger.
- **Remaining high-risk gap** – security feature flags & certificate pinning still need implementation; other previously identified high-risk issues have been addressed.
- **Medium issues (4)** – destructive storage audit routine, broken rate-limit import, unregistered key-rotation task, unsigned OTA updates.

## Detailed Findings

| Severity | Finding                                                                                                      | Evidence                                                                                                                                                                                                                                             | Impact / Notes                                                                                                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| critical | **Apple private key committed to repo**                                                                      | `AuthKey_255J447A73.p8:1-4`                                                                                                                                                                                                                          | Anyone with code access can impersonate our App Store Connect account. Needs immediate removal, key revocation, and secret rotation.                                                              |
| critical | **(Resolved Nov 2025)** Auth tokens stored in plaintext MMKV                                                 | `src/lib/auth/utils.tsx:1-90` now routes `getToken`/`setToken` through the encrypted `mmkvAuthStorageSync`, isolating secrets from the unencrypted general store.                                                                                    | Tokens are encrypted at rest and corrupted payloads are purged automatically; legacy exposure is mitigated for future builds.                                                                     |
| critical | **(Resolved Nov 2025)** `capture-device-metadata` accepted unauthenticated traffic                           | `supabase/functions/capture-device-metadata/index.ts:29-200` now requires a bearer token, verifies `userId`, and scopes inserts/updates to the authenticated user before invoking the service-role client.                                           | Prevents spoofed session rows and forces attackers to present valid Supabase credentials before any write occurs.                                                                                 |
| critical | **(Resolved Nov 2025)** Database lockout trigger pointed to `public.auth_lockout` instead of `auth_lockouts` | `supabase/migrations/20251103_fix_auth_lockout_trigger.sql` recreates the trigger/function to reference `auth_lockouts` and reinstalls the trigger on `auth.users`.                                                                                  | Brute-force attempts are once again blocked at the database layer whenever a hashed email remains locked.                                                                                         |
| high     | **(Resolved Nov 2025)** Email hash salt falls back to public constant                                        | `supabase/functions/delete-account/index.ts:23-31` and `enforce-auth-lockout/index.ts:391-402` now throw when `EMAIL_HASH_SALT` is absent.                                                                                                           | Functions fail closed unless the salt env var is configured, preventing predictable hashes in any environment.                                                                                    |
| high     | **(Mitigated Nov 2025) Session “revocation” only sets `revoked_at`**                                         | `supabase/config.toml:1-20` now enforces `jwt_expiry = 300` and `_layout.tsx:36-225` wires in `useSessionAutoRefresh`/`useOfflineModeMonitor` to refresh tokens proactively.                                                                         | Shorter JWT lifetimes and automatic refresh reduce the post-revocation window; still dependent on GoTrue exposing per-session refresh-token invalidation.                                         |
| high     | **(Resolved Nov 2025) MFA still “coming soon”**                                                              | `src/api/auth/use-mfa.ts` adds Supabase MFA helpers and `src/app/settings/security.tsx:1-240` provides enable/verify/disable UI with translations.                                                                                                   | Users can now enroll TOTP factors, verify codes, and unenroll from the Security screen, unlocking `aal2` coverage for sensitive operations.                                                       |
| high     | **(Resolved Nov 2025) Security feature flags unused**                                                        | `src/lib/security/certificate-pinner.ts` now enforces host allow-listing whenever pinning is enabled, and Android bundles a generated `network_security_config.xml` with the pinned SHA-256 digests from `SECURITY_PIN_DOMAINS/SECURITY_PIN_HASHES`. | Certificate pinning can be toggled per environment, axios refuses requests to non-pinned hosts, and Android enforces the configured pins at the OS layer (iOS pinning documented as a follow-up). |
| high     | **(Resolved Nov 2025) Android backups/screenshots enabled**                                                  | `android/app/src/main/AndroidManifest.xml:1-20` disables backups and `MainActivity.kt:1-60` applies `FLAG_SECURE` during `onCreate`.                                                                                                                 | Prevents sensitive data from appearing in system backups or screen recordings; a dev-only override can be added later if screenshot support is required.                                          |
| medium   | **(Resolved Nov 2025) Storage auditor wipes encrypted stores**                                               | `src/lib/security/storage-auditor.ts:1-200` now inspects initialized MMKV instances and key metadata via `keyManager` instead of instantiating unencrypted stores.                                                                                   | Audit runs are safe again—domains missing encryption metadata are reported without risking data loss.                                                                                             |
| medium   | **(Resolved Nov 2025) Broken rate-limit import in `profanity-check`**                                        | `supabase/functions/profanity-check/index.ts:1-40` now imports `../_shared/rate-limit.ts`.                                                                                                                                                           | Function bundles correctly and rate limiting works again.                                                                                                                                         |
| medium   | **(Resolved Nov 2025) Key-rotation background task never registered**                                        | `_layout.tsx:1-220` registers `registerKeyRotationTask()` on boot so BackgroundFetch keeps running.                                                                                                                                                  | Users now get rotation warnings automatically; logs document registration failures.                                                                                                               |
| medium   | **(Resolved Nov 2025) OTA updates not code-signed**                                                          | `app.config.cjs:1-260` reads `CODE_SIGNING_CERT_PATH` env vars, and `.env.*` templates document required values.                                                                                                                                     | Expo OTA bundles can now be signed; add the PEM via `certs/` and populate the env vars before running production builds.                                                                          |

## Remediation Plan

### Immediate (blocker) actions

1. **Purge and rotate leaked Apple key**
   - Delete `AuthKey_255J447A73.p8` from git history, revoke the key in App Store Connect, issue a new private key, and store it securely (e.g., CI secret manager).
2. **Secure token storage**
   - Replace `setToken`/`getToken` usage with the existing encrypted `mmkvAuthStorage` or Expo SecureStore. Provide a migration that clears legacy MMKV entries after confirming login works.
3. **Lock down `capture-device-metadata`**
   - Require a valid Authorization header or shared secret; validate `userId` against JWT; reject unauthenticated requests before touching DB.
4. **Fix DB lockout trigger**
   - Update migration to reference `auth_lockouts`, re-run in all environments, and add regression tests to ensure trigger fires.

### Near-term (before next release)

5. **Eliminate fallback salts**
   - Modify all edge functions to throw if `EMAIL_HASH_SALT`/`PROCESS_SHARED_SECRET` is missing; document env requirements.
6. **Make session revocation effective** _(partially completed Nov 2025)_
   - JWT lifetime reduced to 5 minutes and the root layout now auto-refreshes/validates sessions; still waiting on GoTrue support for per-session refresh-token invalidation.
7. **Ship MFA + `aal` enforcement** _(completed Nov 2025)_
   - Supabase TOTP enrollment/verification now lives in `src/api/auth/use-mfa.ts` and the Security screen surfaces enable/disable flows with code verification.
8. **Implement certificate pinning / integrity checks** _(completed Nov 2025 for Android & client gating)_
   - Axios now blocks non-pinned hosts and Android consumes `network_security_config.xml` generated from the `SECURITY_PIN_*` env vars. Documented TODO: add iOS TrustKit equivalent + server-provided attestation.
9. **Harden Android client** _(completed Nov 2025)_
   - `android:allowBackup` is disabled and `FLAG_SECURE` is applied in `MainActivity`, preventing backups and screenshots for sensitive views.

### Follow-up

10. **Fix storage auditor** _(completed Nov 2025)_ – auditor now inspects initialized instances + key metadata rather than reopening MMKV files.
11. **Repair `profanity-check` bundle** _(completed Nov 2025)_ – import path fixed; redeploy the function to pick up rate limiting.
12. **Enable key-rotation automation** _(completed Nov 2025)_ – root layout registers the background task; warnings fire automatically once BackgroundFetch runs.
13. **Enable Expo OTA code signing** _(completed Nov 2025, requires PEMs)_ – config reads `CODE_SIGNING_*` env vars and `certs/README.md` documents how to generate the PEM. Populate the vars + certificate before the next production build.

Progress on these items should be tracked in the security-hardening sheet referenced by the original prompt; each fix should include evidence (diffs, configs, logs) before closing.
