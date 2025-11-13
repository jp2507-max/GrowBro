# Implementation Plan

- [x] 0. Entry conditions & routing (first-run only)
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

- [x] 2. Pre‑permission primers
  - Add notifications primer screen with "Allow"/"Not now"; never block core
  - Add photos/camera primer before first use; PHPicker/camera only on demand
  - Created `PermissionPrimerScreen` base component with Reanimated animations
  - Created `NotificationPermissionPrimer` with iOS/Android handling
  - Created `CameraPermissionPrimer` with PHPicker/camera support
  - Added `/notification-primer` and `/camera-primer` routes
  - Updated onboarding state to include permission primer steps
  - Added EN/DE translations for all permission primer content
  - Integrated with consent modal completion to trigger primer flow
  - Unit tests for permission primer components
  - Core app remains fully functional without permissions (requirement met)

- [x] 3. Integrate makeitanimated onboarding design
  - ✅ Reviewed makeitanimated code and extracted motion tokens (durations, easings, stagger, presets)
  - ✅ Built motion primitives under `src/lib/animations/`:
    - `index-context.tsx` - Shared activeIndex context for synchronized animations
    - `stagger.ts` - Sequential enter animations with presets (header, content, actions, list)
    - Enhanced `motion.ts` with onboarding-specific motion tokens
    - Enhanced `primitives.ts` with index-driven transforms (translateX, rotate, scale, crossfade, ctaGate)
    - Enhanced `constants.ts` with BASE_SPRING_CONFIG
  - ✅ Applied primitives to all onboarding screens:
    - Age Gate: Staggered title → body → disclaimers → inputs → button sequence
    - Legal Confirmation Modal: Header → list items → action buttons
    - Consent Modal: Header → content → actions
    - Permission Primer Screen: Icon → title/description → benefits list → CTAs
  - ✅ Implemented Reduced Motion variants via `.reduceMotion(ReduceMotion.System)` for every animation
  - ✅ Documented component mapping in `docs/onboarding/makeitanimated-mapping.md`
  - ✅ Note: Using `FadeIn` instead of `FadeInUp` for Reanimated 4.x compatibility
  - Reference: see Design "Reference implementation file map (from provided code)" for per-file techniques

- [x] 3.1 Custom onboarding pager (Custom Implementation)
  - ✅ Built custom horizontal pager using `Animated.ScrollView` with `pagingEnabled`
  - ✅ Bridged scroll progress to `activeIndex: SharedValue<number>` via `AnimatedIndexContext`
  - ✅ Implemented pagination dots with color interpolation
  - ✅ Created three onboarding slides (Welcome, Community, Guidance)
  - ✅ Animations use stagger primitives and honor Reduced Motion
  - ✅ Skip/Done buttons integrate with onboarding-state (`markAsCompleted`)
  - ✅ Full accessibility support (labels, touch targets, screen readers)
  - ✅ Comprehensive test suite for pager, pagination dots, and slide container
  - ✅ EN/DE translations for all slide content

- [x] 4. Activation checklist widget (Home)
  - Show 4 suggested actions; mark as complete when action done; hide after 2+ complete
  - Persist dismissal; respect offline mode

- [x] 5. Empty states with educational samples
  - Calendar: sample recurring task (local only) with "convert to real task" CTA
  - Strains: search tips + "Saved strains available offline" banner
  - Community: moderation guidance and "Share an update" CTA
  - Created CalendarEmptyState component with animated sample task display
  - Enhanced StrainsEmptyState with educational tips and offline banner
  - Enhanced CommunityEmptyState with moderation guidance
  - Added EN/DE translations for all empty state content
  - Comprehensive unit tests for all three empty state components (27 tests passing)

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
