# makeitanimated Onboarding Mapping (Placeholder)

This document maps the provided makeitanimated onboarding patterns to GrowBro’s onboarding steps. We adopt the style and motion system, not the exact UI.

Library components (from reference)

- Context: `AnimatedIndexContext` (shared `activeIndex`)
- Motion tokens: `BASE_SPRING_CONFIG = { mass:1, stiffness:240, damping:20 }`
- Wrappers: `SlideContainer` (opacity crossfade), `OnboardingSlideContainer` (layout split)
- Elements: `SlideTextContainer` (blur chip, iOS/Android variants), `PaginationDots`
- Background: `BottomGlow` (Skia, HSV color interpolation)

GrowBro motion primitives (to implement under `src/lib/animations/`)

- indexDrivenTranslateX(idx, ranges)
- indexDrivenRotate(idx, ranges)
- indexDrivenScale(idx, ranges)
- crossfadeAroundIndex(idx, window = 0.5)
- hsvInterpolateColor(idx, palette)
- ctaGateToLastIndex(idx, lastIndex)

Component mapping (GrowBro)

- Age Gate screen
  - Enter: crossfade + slight scale-in for form panel
  - Text fields: minimal slide-in on first render; no per-frame class toggles
  - CTA: enable/opacity gate only after validation; Reduced Motion → no animation

- Legal Confirmation modal
  - Modal enter: fade + translateY small; blur backdrop if enabled
  - Switch rows: staggered slide-in (20–40ms steps); Reduced Motion → instant layout
  - Accept button: small spring on enabled state

- Consent Modal
  - Section headers: crossfade
  - Toggles: micro spring on value change only (no looping)
  - Footer CTAs: delayed fade-in

- Pre-permission Primers (Notifications, Photos/Camera)
  - Card reveal: translateY + fade; Reduced Motion → static
  - Primary/secondary CTAs with small press feedback via `withSpring`

- Activation Checklist (Home)
  - Items enter with small stagger; completed items tick with subtle scale
  - Reduced Motion: show instantly

Reduced Motion policy

- Default: honor system preference (ReduceMotion.System)
- Ensure non-animated functional fallbacks everywhere (visibility/opacity toggles only)

Performance constraints

- One shared-value write per frame; derive in worklets, no logging/IO
- Avoid toggling className per frame; use animated style props
- Target 60fps; validate via release-mode perf tests
