---
name: GrowBro onboarding revamp
overview: Evaluate Software Mansion’s react-native-onboarding and implement a more polished first-run onboarding for GrowBro (slides + permission primers) without breaking compliance gating, i18n, telemetry, or a11y.
todos:
  - id: spike-onboarding-lib
    content: Prototype @blazejkustra/react-native-onboarding in a temporary onboarding-v2 screen; validate theming, Reduced Motion, a11y, telemetry, and navigation.
    status: done
  - id: choose-approach
    content: Decide library adoption vs keeping the existing pager; document decision + criteria.
    status: done
    decision: KEEP existing pager. Library requires awkward type assertions for custom components (image/position props required even when unused). Our pager already handles telemetry, Reduced Motion, a11y. No significant benefit to switching.
  - id: redesign-slides
    content: Create new intro/step visuals (illustrations + backgrounds) and apply to chosen onboarding implementation with full light/dark parity.
    status: done
  - id: harden-gating
    content: Fix first-run routing order so age gate/legal/consent cannot be bypassed; add/adjust tests.
    status: done
  - id: align-permission-primers
    content: Refresh permission primer visuals to match the new onboarding while preserving request logic.
    status: done
  - id: update-i18n-telemetry-tests
    content: Update EN/DE strings, telemetry step naming if needed, tests, and docs; run the verification commands.
    status: done
---

# GrowBro onboarding revamp plan

## What we have today (baseline)

- **Marketing slides**: [`src/app/onboarding.tsx`](src/app/onboarding.tsx) renders a custom Reanimated pager ([`src/components/onboarding/onboarding-pager.tsx`](src/components/onboarding/onboarding-pager.tsx)) with 3 slides:
- [`src/components/onboarding/slides/welcome-slide.tsx`](src/components/onboarding/slides/welcome-slide.tsx)
- [`src/components/onboarding/slides/community-slide.tsx`](src/components/onboarding/slides/community-slide.tsx)
- [`src/components/onboarding/slides/guidance-slide.tsx`](src/components/onboarding/slides/guidance-slide.tsx)
- **Permission primers (good!)**: notification → camera
- [`src/app/notification-primer.tsx`](src/app/notification-primer.tsx) → [`src/app/camera-primer.tsx`](src/app/camera-primer.tsx)
- Shared UI: [`src/components/onboarding/permission-primer-screen.tsx`](src/components/onboarding/permission-primer-screen.tsx)
- **First-run flag**: [`src/lib/hooks/use-is-first-time.tsx`](src/lib/hooks/use-is-first-time.tsx)
- **Compliance onboarding gating/versioning** (age gate/legal/consent + version bump): [`src/lib/compliance/onboarding-state.ts`](src/lib/compliance/onboarding-state.ts)
- **Telemetry**: [`src/lib/compliance/onboarding-telemetry.ts`](src/lib/compliance/onboarding-telemetry.ts), docs: [`docs/onboarding/analytics-events.md`](docs/onboarding/analytics-events.md)
- **Routing that we must not regress**:
- Root: [`src/app/_layout.tsx`](src/app/_layout.tsx)
- Tabs: [`src/app/(app)/_layout.tsx`](<src/app/(app)/_layout.tsx>)

## Package to consider

- **Library**: Software Mansion Labs `react-native-onboarding` ([README](https://github.com/software-mansion-labs/react-native-onboarding?tab=readme-ov-file))
- **NPM package**: `@blazejkustra/react-native-onboarding` (per README)
- **What it provides**:
- A single `<Onboarding />` with `introPanel` + `steps[]`, `onComplete`, `onSkip`, `onStepChange`
- Custom renderers for intro/steps/background/skip button, plus theming (`colors`, `fonts`) and `animationDuration`
- Requires `react-native-reanimated` + `react-native-safe-area-context` (already in GrowBro)
- Optional image support via `expo-image` or `react-native-svg` (we already have both)

## Decision gate (recommended)

Because GrowBro already has a custom Reanimated pager, we should run a **small in-app spike** to confirm the library actually improves: (a) visual polish, (b) theming with NativeWind, (c) Reduced Motion, (d) a11y, and (e) telemetry wiring.

- **Pass criteria**: the library can be fully themed to match GrowBro, supports Reduced Motion (or we can set duration to 0), doesn’t complicate web, and doesn’t fight our NativeWind UI.
- **Fail criteria**: too hard to match design system, limited layout control, or it adds constraints vs our current pager.

## Implementation plan

### 1) Prototype (1–2 sessions)

- Add `@blazejkustra/react-native-onboarding` and create a **temporary** screen (e.g. `onboarding-v2`) that:
- Uses custom intro/step renderers implemented with GrowBro UI primitives (`Button`, `Text`, `View`)
- Reuses existing copy (i18n keys) and routes to `/notification-primer` on complete
- Wires telemetry:
- `onStepChange` → `trackOnboardingStepComplete('slide_X', duration)` (track durations in JS)
- `onSkip` → `trackOnboardingSkipped('slide_X', 'user_skip')`
- `onComplete` → `trackOnboardingComplete(totalDuration, stepsCount)`
- Honors Reduced Motion by setting `animationDuration={0}` when Reduce Motion is enabled

### 2) Choose approach

- **If spike passes**: replace the current pager in [`src/app/onboarding.tsx`](src/app/onboarding.tsx) with the library-based implementation.
- **If spike fails**: keep the existing pager and do a UI revamp by updating the slide components + background while preserving the pager logic/telemetry/tests.

### 3) Visual redesign (applies to either approach)

- Replace emoji “icons” with consistent illustrations (SVG or `expo-image` assets) and add more visual depth:
- Gradient / soft blobs background (static NativeWind + optional light Reanimated parallax)
- Stronger typography hierarchy and spacing
- Better feature cards (icons, short benefit bullets)
- Add an **Intro panel** (either as the library’s `introPanel` or as a new first slide in our pager) to improve the “first impression” moment.
- Ensure **light/dark** parity for every background/text color.

### 4) Flow & gating hardening (important)

- Ensure first-run cannot bypass age gate/legal/consent. Today, Tabs routing prioritizes `isFirstTime` before `ageGateStatus`.
- Update [`src/app/(app)/_layout.tsx`](<src/app/(app)/_layout.tsx>) so age gate is checked **before** redirecting to `/onboarding`.
- Add/adjust tests around this behavior (see [`src/app/__tests__/age-gate-guard.test.tsx`](src/app/__tests__/age-gate-guard.test.tsx)).

### 5) Keep permission primers, but match the new look

- Preserve the existing permission primer flow/screens (already privacy-first), but align visuals:
- Update icons/illustrations, spacing, and background styling in [`src/components/onboarding/permission-primer-screen.tsx`](src/components/onboarding/permission-primer-screen.tsx)
- Keep the existing permission request logic in [`src/components/onboarding/notification-permission-primer.tsx`](src/components/onboarding/notification-permission-primer.tsx) and [`src/components/onboarding/camera-permission-primer.tsx`](src/components/onboarding/camera-permission-primer.tsx)

### 6) i18n + QA + tests

- Update copy and add any new onboarding keys in:
- [`src/translations/en.json`](src/translations/en.json)
- [`src/translations/de.json`](src/translations/de.json)
- Update/extend tests for whichever approach we choose:
- Existing onboarding unit tests under [`src/components/onboarding/`](src/components/onboarding/)
- Routing tests if gating changes
- Update docs if telemetry step naming changes:
- [`docs/onboarding/analytics-events.md`](docs/onboarding/analytics-events.md)

## Local verification commands

- `pnpm run lint`
- `pnpm run type-check`
- `pnpm run i18n:validate`
- `pnpm test onboarding -- --coverage --coverageReporters="text"`
- `pnpm start` (manual: Reduced Motion ON/OFF, VoiceOver/TalkBack, dark mode)
