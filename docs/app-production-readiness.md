#! App Production Readiness (Lean)

Status: v1 candidate

1. Crash/Release Health

- Sentry DSN configured in env (prod/staging)
- Metro uses `getSentryExpoConfig()` (Debug IDs)
- Native symbols: dSYMs (iOS) and R8 mappings (Android) uploaded in CI
- Health dashboards: crash-free sessions/users, ANR, Mobile Vitals

2. Performance Budgets

- TTID/TTFD targets by device tier (document in code comments)
- FlashList v2 used for production lists; no FlatList
- Perf tests artifacts linked from CI

3. Permissions & Consent

- Pre-permission primers (notifications/camera/photos)
- Consent gating (telemetry/experiments/AI training/crash)
- SDKs initialized only after consent

4. A11y & i18n

- Touch targets ≥ 44pt/48dp (hitSlop where appropriate)
- Labels/hints on inputs and buttons; readable empty/error states
- EN/DE coverage for new onboarding strings

5. Data & Compliance

- Account deletion path ≤ 3 taps (+ public web URL)
- Data Safety form generation up to date
- Compliance envs populated (DPO, legal entity, etc.)

6. App Store/Play Submission

- iOS Reviewer Notes generated at `docs/review-notes-ios.md`
- Store listing copy aligned with feature set
- Screenshots/video prepared (EN/DE)

7. Runbooks

- Incident response + rollback SOPs linked from `compliance/production-readiness-checklist.md`
- Support escalation paths documented

Checklist gate: `pnpm run check-all` should pass before tagging a release.
