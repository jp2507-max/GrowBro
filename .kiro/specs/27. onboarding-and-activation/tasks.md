# Implementation Plan

- [ ] 0. Entry conditions & routing (first-run only)
  - Show onboarding once on first app open after Age Gate + Legal acceptance
  - Use `useIsFirstTime()` and `onboarding-state` to decide: `not-started → '/onboarding'`, else skip
  - Persist completion in `onboarding-state` with `{ status: 'completed', completedAt, version }`
  - Re‑show policy: only on major onboarding version bump (e.g., `ONBOARDING_VERSION` env or const)
  - Settings entry point: `Settings → About → Rewatch onboarding` (manual trigger; does not flip first‑run flag)
  - Telemetry: `onboarding_start`, `onboarding_complete`, `onboarding_skipped` (guarded by consent)
  - Tests: gating, completion persistence, no repeat on next launch, re‑show on version bump

- [x] 1. Age gate + legal acceptance wiring
  - Reuse `src/app/age-gate.tsx` and `LegalConfirmationModal`
  - Verify integration tests: `src/app/__tests__/onboarding-flow.test.tsx`

- [x] 1.1 Persist onboarding steps
  - Reuse `src/lib/compliance/onboarding-state.ts` to mark `age-gate` and `legal-confirmation`

- [x] 1.2 Consent gating
  - Ensure ConsentModal shows post-legal when needed; guard SDK init via consent service

- [ ] 2. Pre‑permission primers
  - Add notifications primer screen with “Allow”/“Not now”; never block core
  - Add photos/camera primer before first use; PHPicker/camera only on demand

- [ ] 3. Integrate makeitanimated onboarding design
  - Review provided makeitanimated code and extract motion tokens (durations, easings, stagger, presets)
  - Build motion primitives under `src/lib/animations/` mirroring makeitanimated API
  - Apply primitives to Age Gate, Legal, Consent, and Primers (enter/exit/sequence)
  - Implement Reduced Motion variants for every animated step
  - Document component mapping in `docs/onboarding/makeitanimated-mapping.md`
  - Reference: see Design “Reference implementation file map (from provided code)” for per-file techniques

- [ ] 4. Activation checklist widget (Home)
  - Show 4 suggested actions; mark as complete when action done; hide after 2+ complete
  - Persist dismissal; respect offline mode

- [ ] 5. Empty states with educational samples
  - Calendar: sample recurring task (local only) with “convert to real task” CTA
  - Strains: search tips + “Saved strains available offline” banner
  - Community: moderation guidance and “Share an update” CTA

- [ ] 6. Analytics taxonomy and events (guarded by consent)
  - Track: onboarding_start/complete, primer_shown/accepted, activation_action
  - Noop if telemetry consent = false

- [x] 7. Accessibility pass
  - Inputs get `accessibilityLabel` from `label`
  - Buttons default `accessibilityLabel` from `label/tx`

- [ ] 8. Documentation
  - Add onboarding playbook to Help Center
  - Reviewer notes (iOS) generated in docs
  - Add makeitanimated mapping reference and code links
