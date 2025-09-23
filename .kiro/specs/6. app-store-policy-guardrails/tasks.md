# App Store policy guardrails — lean, actionable plan (2025‑09)

This plan tightens scope to what’s required by Apple/Google policies and what we already ship in this repo. It fixes inaccuracies and prioritizes high‑impact work.

References

- Apple: App Store Review Guidelines (incl. 1.2 UGC, 5.1.1(v) account deletion), Age ratings values 4+/9+/12+/17+
- Google Play: UGC policy (reporting/blocking, timely action), Target API level policy (API 35), Photo & Video Permissions (2025)

## 0) What’s already covered in this repo

- CI/Docs/Data safety
  - scripts/ci-compliance-docs-validate.js — required docs presence
  - scripts/ci-data-safety-validate.js, scripts/generate-data-safety-draft.js — Data Safety alignment
  - scripts/ci-android-manifest-scan.js — flags restricted/exact alarm and READ*MEDIA*\*; requires justification files
  - scripts/ci-cannabis-policy-scan.js (+ compliance/cannabis-policy.config.json) — scans EN/DE translations, docs, store listings for commerce terms and blocked domains
  - scripts/ci-compliance-audit.js — aggregates compliance checks
- In‑app features
  - Age gate screen and store (src/app/age-gate.tsx, src/lib/compliance/age-gate.ts + tests)
  - UGC moderation actions (report/block/mute/delete) UI + API hooks
  - Account deletion: in‑app (≤3 taps) and web portal (src/app/(app)/settings/privacy-and-data.tsx, src/app/delete-account.tsx, compliance/deletion-methods.json)

## 1) Quick fixes (accuracy & scope)

- Apple age ratings: use official tiers 4+ / 9+ / 12+ / 17+ (not 13/16/18). Map cannabis content to 17+ with clear educational disclaimers.
- Remove “D‑U‑N‑S as submission hard gate.” Keep Seller/legal entity consistency and support/privacy URLs validation.
- Don’t cite 5.1.1(iv) for age gating. Keep 5.1.1(v) for account deletion. Avoid “randomized Q&A” adult tests unless legally required.

## 2) High‑priority (must‑haves)

- Ensure report + block are discoverable on UGC items; add a minimal SLA timer for “timely action” and a basic auto‑hide threshold (e.g., 3 reports → hide) with an admin review queue stub.
- Add 2 tests: rendering (buttons visible), and flows (report → queued; block → success).
- Keep current in‑app path (≤3 taps) + web portal. Add a UI test to verify in‑app discoverability and happy‑path deletion.
- Add CI check to hard‑fail if targetSdkVersion < 35 after enforcement date (extend from docs/compliance/policy-deadlines.md). Emit clear remediation.
- Prefer Android Photo Picker; if READ*MEDIA*\* present, require justification file (already enforced). Add lint that suggests migration when feasible.

## 3) Medium priority

- Keep existing scanner; expand terms for “cart/checkout/price/DM to buy/WhatsApp/Telegram/phone” where appropriate in config.
- Keep “educational only / not medical advice” messaging for AI guidance and playbooks; version acknowledgments if text changes. Persist in i18n EN/DE.

[x] Photos/Videos policy: prefer Android Photo Picker across image pick flows; add CI hint to migrate if READ*MEDIA* present

- Conservative Mode & region fallback
- Reviewer Notes & kill switch
- Security hardening (stretch)

## 5) Privacy extras

- Photo privacy: add EXIF GPS stripping for uploads (expo-image-manipulator) and an opt‑in for cloud processing; add purge tools. Align with Data Safety/App Privacy.

---

## Concise task list (still to do)

- [x] Update Apple age tiers in copy/specs to 4+/9+/12+/17+; set cannabis areas to 17+ with “educational only” disclaimers
  - Files: `src/translations/*.json`, store listing JSON in `docs/compliance/`
- [x] Remove D‑U‑N‑S as submission gate; keep Seller/support/privacy URL validations
  - Files: this spec + any CI messaging mentioning D‑U‑N‑S
- [x] UGC moderation: add basic auto‑hide (≥3 reports) and a review queue stub; add tests
  - Impl: `src/lib/moderation/*` (+ persistence), `src/components/moderation-actions.tsx`
  - Tests: `src/components/moderation-actions.test.tsx` (render + flow)
- [x] Account deletion: add UI/E2E test to verify discoverability (≤3 taps) and success path
  - Tests: add RTL spec under `src/app/(app)/settings/__tests__/privacy-and-data.test.tsx` and/or Maestro flow
- [ ] Add Target API 35 CI gate with clear failure text post‑enforcement
  - New: `scripts/ci-target-api-gate.js`; wire in `package.json` and CI
- [ ] Photos/Videos policy: prefer Android Photo Picker across image pick flows; add CI hint to migrate if READ*MEDIA*\* present
  - Impl audit: ensure usages go through `src/lib/media/photo-access.ts`
  - CI: extend `scripts/ci-android-manifest-scan.js` message with migration advice
- [x] Expand cannabis scanner denylist/phrases in config; include “cart/checkout/price/DM to buy/WhatsApp/Telegram/phone” and equivalents (DE)
  - File: `compliance/cannabis-policy.config.json`
- [ ] Strip EXIF GPS on photo uploads and add local/cloud processing toggle with consent
  - Impl: add utility (e.g., `src/lib/media/exif.ts`) using `expo-image-manipulator`; integrate in upload path(s)
- [ ] Optional: Conservative Mode + manual region picker + mode telemetry
  - New: `src/lib/compliance/region-policy.ts`, UI picker under settings
- [ ] Optional: Reviewer Notes screen + simple master kill switch for review
  - New: `src/app/reviewer-notes.tsx`, simple feature flag in `src/lib/compliance/*`

## How to verify (repo commands)

- pnpm run compliance:docs:validate
- pnpm run data-safety:generate ; pnpm run data-safety:validate
- pnpm run compliance:scan:android
- pnpm run compliance:cannabis
- pnpm run compliance:audit
- pnpm test -- age-gate
- pnpm test -- app-access-gate.test.ts (or add tests for moderation/report/block)

## Notes

- Keep UGC moderation aligned with Play UGC (reporting/blocking + timely action). Apple 1.2 mirrors the need for moderation and reporting.
- Keep policy citations in CI errors where possible for reviewer clarity.
