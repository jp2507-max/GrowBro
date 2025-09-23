# iOS Store Complianc- [x] 4. Push notifications aren't required for core use

- Add a pre-submit check that the app remains fully usable with notifications denied. We already defer channel creation until grant; add a simple functional test that the calendar/tasks core works with permission denied.— Essential Remaining Tasks (2025)

This list is trimmed to only what’s still needed in our codebase. Verified against Apple docs:

- App Review Guidelines — `https://developer.apple.com/app-store/review/guidelines/`
- Account deletion — `https://developer.apple.com/support/offering-account-deletion-in-your-app/`
- Privacy manifests & Required Reason APIs — `https://developer.apple.com/documentation/bundleresources/privacy-manifest-files/`
- PHPicker — `https://developer.apple.com/documentation/photosui/phpickerviewcontroller`
- App Tracking Transparency — `https://developer.apple.com/documentation/apptrackingtransparency`

- [x] 1. Privacy manifest guardrails in CI (minimal)
  - Add CI task to run `scripts/validate-privacy-manifest.js` and fail on mismatch.
  - Ensure the script checks `app.config.cjs` (we don’t use `app.config.ts`).
  - Implemented via `.github/workflows/privacy-manifest-validate.yml`. Validator updated to read `app.config.cjs`. Dependency snapshot refreshed.

- [x] 2. ATT prompt policy guard
  - Added `scripts/ci-att-guard.js` and `pnpm run compliance:att-guard` to enforce no ATT/IDFA code and ensure `NSUserTrackingUsageDescription` is absent in config/Info.plist. Wired into `check-all` and aggregated in compliance audit.

- [x] 3. Photos access via PHPicker path
  - Replace `src/lib/media/photo-access.ts` stub with a real PHPicker-based flow (Expo 54 recommended path) and ensure no full library permission is requested. Add one integration test.

- [x] 4. Push notifications aren’t required for core use
  - Add a pre-submit check that the app remains fully usable with notifications denied. We already defer channel creation until grant; add a simple functional test that the calendar/tasks core works with permission denied.

- [x] 5. In‑app account deletion discoverability (≤3 taps)
  - Kept current flow in `settings -> privacy-and-data`.
  - Added/validated tests:
    - `src/lib/privacy/deletion-gate.test.ts` asserts `validateDeletionPathAccessibility()` stays within `MAX_ALLOWED_TAPS` (3) and web deletion URL consistency.
    - `src/app/(app)/settings/__tests__/privacy-and-data.test.tsx` ensures deletion is reachable within ≤3 taps and triggers `deleteAccountInApp` (queues `dsr-delete`) and signs out.
    - `src/lib/privacy/deletion-manager.test.ts` verifies Supabase `functions.invoke('dsr-delete')` and audit logging.
  - Constant: `MAX_ALLOWED_TAPS = 3` in `src/lib/privacy/deletion-manager.ts`.

- [ ] 6. SIWA readiness (only if adding third‑party login later)
  - We don’t currently ship any third‑party login. Add a repo guard (lint/script) to fail CI if Google/Facebook auth is introduced without SIWA.

- [x] 7. Commerce/consumption guardrails (content‑only)
  - Added CI workflow `.github/workflows/content-compliance.yml` to run `pnpm run compliance:cannabis` on PRs/pushes and upload reports.
  - Expanded `compliance/cannabis-policy.config.json` denylist to include affiliate/referral/promo/discount terms and allowlist disclaimers (EN/DE) to reduce false positives.
  - Scanner already blocks on violations and is aggregated in `ci-compliance-audit.js`.

- [ ] 8. Review kit
  - Add minimal reviewer notes generator: demo login, age‑gate note, UGC safeguards (report/mute/block), permissions copy, and deletion path. Store at `docs/review-notes-ios.md`.

Notes on what’s already covered:

- Privacy manifest wired in `app.config.cjs` with `apple-privacy-manifest.json` present.
- Notification permission handling defers until primer/grant (`PermissionManager`, `NotificationHandler`).
- In‑app deletion implemented (`deletion-manager.ts`, settings screens) + tests present.
- UGC moderation framework exists (`moderation-manager`, queues). Further expansions not required for submission.
