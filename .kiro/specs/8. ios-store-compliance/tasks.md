# iOS Store Compliance — Essential Remaining Tasks (2025)

This list is trimmed to only what’s still needed in our codebase. Verified against Apple docs:

- App Review Guidelines — `https://developer.apple.com/app-store/review/guidelines/`
- Account deletion — `https://developer.apple.com/support/offering-account-deletion-in-your-app/`
- Privacy manifests & Required Reason APIs — `https://developer.apple.com/documentation/bundleresources/privacy-manifest-files/`
- PHPicker — `https://developer.apple.com/documentation/photosui/phpickerviewcontroller`
- App Tracking Transparency — `https://developer.apple.com/documentation/apptrackingtransparency`

- [ ] 1. Privacy manifest guardrails in CI (minimal)
  - Add CI task to run `scripts/validate-privacy-manifest.js` and fail on mismatch.
  - Ensure the script checks `app.config.cjs` (we don’t use `app.config.ts`).

- [ ] 2. ATT prompt policy guard
  - Add a tiny guard to ensure we never show ATT on iOS (we don’t track/IDFA). Keep `NSUserTrackingUsageDescription` absent.

- [ ] 3. Photos access via PHPicker path
  - Replace `src/lib/media/photo-access.ts` stub with a real PHPicker-based flow (Expo 54 recommended path) and ensure no full library permission is requested. Add one integration test.

- [ ] 4. Push notifications aren’t required for core use
  - Add a pre-submit check that the app remains fully usable with notifications denied. We already defer channel creation until grant; add a simple functional test that the calendar/tasks core works with permission denied.

- [ ] 5. In‑app account deletion discoverability (≤3 taps)
  - Keep current flow in `settings -> privacy-and-data`; add a test asserting `MAX_ALLOWED_TAPS` policy and that deletion is reachable within 3 taps and queues `dsr-delete`.

- [ ] 6. SIWA readiness (only if adding third‑party login later)
  - We don’t currently ship any third‑party login. Add a repo guard (lint/script) to fail CI if Google/Facebook auth is introduced without SIWA.

- [ ] 7. Commerce/consumption guardrails (content‑only)
  - Keep `scripts/lib/cannabis-policy.js` in pre-submit to scan strings for ordering/delivery/affiliate promotion and consumption encouragement. Block on violations.

- [ ] 8. Review kit
  - Add minimal reviewer notes generator: demo login, age‑gate note, UGC safeguards (report/mute/block), permissions copy, and deletion path. Store at `docs/review-notes-ios.md`.

Notes on what’s already covered:

- Privacy manifest wired in `app.config.cjs` with `apple-privacy-manifest.json` present.
- Notification permission handling defers until primer/grant (`PermissionManager`, `NotificationHandler`).
- In‑app deletion implemented (`deletion-manager.ts`, settings screens) + tests present.
- UGC moderation framework exists (`moderation-manager`, queues). Further expansions not required for submission.
