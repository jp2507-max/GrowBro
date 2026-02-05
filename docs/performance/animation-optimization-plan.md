# Animation Optimization Plan (Reanimated v4 + Worklets)

Scope: Audit and optimize all animation-related code (Reanimated, Worklets scheduling, RNGH gestures, animated lists/scroll, keyboard-aware animated wrappers, Moti/Lottie).

Source of truth for practices: `.codex/skills/animation-performance/SKILL.md`, `.codex/skills/animation-with-worklets/SKILL.md`, `.codex/skills/building-ui/references/animations.md`.

## Standards (decisions to lock in)

1. **Cross-thread scheduling**
   - Prefer `scheduleOnRN` / `scheduleOnUI` from `react-native-worklets`.
   - Avoid `runOnJS` / `runOnUI` in app code except where a library API requires it.
   - Never schedule JS work from per-frame callbacks (`onUpdate`, `onScroll`) unless heavily throttled and only when strictly necessary.

2. **Worklet purity**
   - UI-thread callbacks stay pure: no logging, no network, no heavy JS object captures.
   - Heavy computations move to `useDerivedValue` or the JS thread (then feed results back via shared values).

3. **Re-renders**
   - Animation state uses `SharedValue` (not React state) where possible.
   - Memoize gesture objects, animation builders, and handler references.

4. **Scroll + list**
   - Throttle or coalesce scroll/gesture-driven side effects.
   - Cap list entering animations (already done in some lists) to avoid too many simultaneous animated components.

## P0 (highest ROI / highest risk of jank)

### `src/components/compose-btn.tsx`

- Problem: `withTiming(...)` is created inside `useAnimatedStyle` that re-runs during scroll, which can repeatedly create/restart animations.
- Plan: Move timing to a single `useDerivedValue` “progress” (0→1) driven by `isHiddenOrCollapsed`, then `interpolate`/`clamp` in styles.

### `src/components/calendar/draggable-agenda-item.tsx`

- Problem: Cross-thread calls from `.onUpdate` (currently throttled) are still a hotspot; any JS congestion will cause jank.
- Plan:
  - Replace `runOnJS` with `scheduleOnRN`.
  - Avoid scheduling unless the finger is near auto-scroll edges (compute edge state on UI thread using shared values for `viewportHeight` + current scroll offset).
  - Keep throttling, but gate the scheduling more aggressively (only when `dir !== 0`).

### `src/lib/performance/worklet-monitor.ts`

- Problem: `runOnJS` is called in a per-update tracker (`trackGestureUpdate`), which can _create_ jank while measuring it.
- Plan: If this is used at runtime, refactor to (a) sample at a low frequency, (b) store metrics in shared values, (c) only `scheduleOnRN` at gesture end or on a coarse timer.

### `scripts/eslint/worklet-rules/no-worklet-side-effects.js`

- Problem: The rule detects some worklet boundaries (Reanimated hooks, `runOnUI`) but not `scheduleOnUI` or RNGH v2 gesture callbacks, so UI-thread side effects can slip through.
- Plan:
  - Treat callbacks passed to `scheduleOnUI(...)` as worklets.
  - Treat callbacks passed to `Gesture.*().onStart/onUpdate/onEnd/onFinalize(...)` as worklets (walk the callee chain back to `Gesture.*()`).
  - Update messaging to recommend `scheduleOnRN` instead of `runOnJS`.

## P1 (quick wins / consistency)

### Replace remaining `runOnJS` usages with `scheduleOnRN`

- `src/components/ui/compliance-banner.tsx`
- `src/components/calendar/day-sortable-list.tsx`
- `src/lib/strains/use-list-scrolling.ts`

### Align docs with chosen standards

- `docs/performance/worklet-optimization-guide.md`: Update guidance to reflect `scheduleOnRN/scheduleOnUI` and the “no JS scheduling per-frame” rule.

## P2 (correctness + polish)

### `src/components/plants/plants-card.tsx`

- Problem: `reduceMotion` (JS boolean) is captured inside a worklet without explicit dependencies; it may not react to changes.
- Plan: Provide dependencies to `useAnimatedStyle` (or convert reduce-motion state into a shared value) so the worklet updates correctly.

### `src/app/(app)/strains/favorites.tsx`

- Plan: Precompute first `MAX_ENTERING_ANIMATIONS` entering animations once (like `src/components/strains/strains-list-with-cache.tsx`) and consider lowering the cap if profiling shows dropped frames.

### Infinite-loop onboarding animations

- `src/components/onboarding/animated-hero.tsx`
- `src/components/onboarding/animated-lottie-hero.tsx`
- `src/components/onboarding/animated-primer-icon.tsx`
- `src/components/onboarding/floating-particles.tsx`
- Plan: Gate the start of infinite `withRepeat(...)` loops behind reduced-motion checks (avoid running the loops at all when reduced motion is enabled).

### `src/components/ui/progress-bar.tsx`

- Plan: Normalize `withTiming` usage to a single config shape (`{ duration, easing, reduceMotion }`) to match the rest of the codebase and avoid signature drift.

## Inventory (files to review / keep consistent)

### Core infra

- `src/lib/animations/animated-scroll-list-provider.tsx`
- `src/lib/animations/use-scroll-direction.ts`
- `src/lib/animations/motion.ts`
- `src/lib/animations/stagger.ts`
- `src/lib/animations/primitives.ts`
- `src/lib/animations/shared.ts`
- `src/types/reanimated-compat.d.ts`

### Calendar / drag / sortables

- `src/components/calendar/draggable-agenda-item.tsx`
- `src/components/calendar/day-sortable-list.tsx`
- `src/components/calendar/week-strip.tsx`
- `src/components/calendar/day-task-row.tsx`
- `src/components/calendar/sortable-day-view.example.tsx`

### Scroll-driven UI

- `src/components/navigation/shared-header.tsx`
- `src/components/compose-btn.tsx`

### Lists + shared transitions

- `src/components/strains/strains-list-with-cache.tsx`
- `src/components/strains/strain-card.tsx`
- `src/components/community/post-card-hero-image.tsx`
- `src/components/community/post-detail-hero-image.tsx`

### UI components

- `src/components/ui/button.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/modal.tsx`
- `src/components/ui/modal-keyboard-aware-scroll-view.tsx`
- `src/components/ui/checkbox.tsx` (Moti)

## “Done” checklist

- [x] No `runOnJS` usage in app code (or justified exceptions).
- [x] No cross-thread scheduling from per-frame callbacks unless gated + throttled and strictly necessary.
- [x] Scroll-driven animations don’t construct timing/spring animations inside per-frame style worklets.
- [x] ESLint worklet rule correctly detects `scheduleOnUI` + RNGH gesture callbacks.
- [x] Reduced motion reliably disables infinite-loop animations.
