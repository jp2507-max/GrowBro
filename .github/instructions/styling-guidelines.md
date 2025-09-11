---
title: Styling & Animation Guidelines
scope: nativewind + reanimated v4 (expo sdk 54)
audience: internal + ai-agent
status: active
updated: 2025-09-11
---

# Goal

Consistent, accessible, and performant styling & animations using NativeWind (Tailwind on RN) + Reanimated 4 (Expo SDK 54). Keep base styles declarative (`className`) and isolate dynamic/animated concerns in Reanimated worklets.

## 1. Layering Strategy

1. Static foundation: Tailwind utility classes via `className` (colors, spacing, layout, typography). These should be as constant as possible.
2. Variants/state: Conditional class composition (feature flags, dark mode, size, tone). Prefer a small variant helper instead of long ternaries inside JSX. (Add one if needed: e.g. `cva`-style or simple utility.)
3. High‑frequency change (interactive / gesture / scroll / progress): Reanimated shared values + `useAnimatedStyle`.
4. One responsibility per layer: Avoid mixing large inline style objects with animated transforms—keep transforms in the animated style only.

## 2. NativeWind Conventions

- Order classes (loosely): layout → flex/grid → spacing → sizing → border/radius → background → text/font → effects (shadow/opacity) → state/dark.
- Use design tokens mapped in `tailwind.config.js` (e.g. colors from `src/components/colors.tsx`). Do **not** hardcode hex values or arbitrary spacing if a scale token exists.
- Prefer semantic component wrappers (e.g. a `Button` that applies its base `className`) instead of repeating class strings across screens.
- Keep `className` stable: compute once outside render if it depends only on props; avoid changing class lists per frame (that forces a new style object each render).
- For custom components to accept styling: forward `className` and merge it with internal base styles (`styled()` from NativeWind or manual `useMemo`).

## 3. Reanimated 4 Key Points (Expo SDK 54)

- Reanimated 4 introduces improved layout & shared element transitions plus early CSS animation interoperability. We standardize on Reanimated primitives (`withTiming`, `withSpring`, `withDecay`) & layout transitions for performance.
- Layout animations: prefer `CurvedTransition` or `EntryExitTransition` via `layout={...}` for list insert/remove/reorder instead of manually animating width/height in a loop.
- Shared element transitions: use `sharedTransitionTag` with a domain prefix (`feed.card.image`, `settings.avatar`). Optional custom: `sharedTransitionStyle={MySharedTransition}` defined in a central `src/lib/animations/shared.ts` (create if needed). Keep tags unique per conceptual element.
- Reduced motion: Always chain `.reduceMotion(ReduceMotion.System)` (or `.Never` if essential). Provide a functional experience when motion is disabled—no layout jank.
- Avoid heavy logic inside worklets. Compute constants outside, pass primitives in. If deriving styles from theme (e.g. color), resolve before entering the worklet and feed as captured value.
- Do not mutate shared values in rapid succession inside normal React callbacks if you can batch them; derive multiple animated styles from a single shared value where possible.

## 4. Patterns

Static + Animated merge:

```tsx
const progress = useSharedValue(0);
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: progress.value * 100 }],
  opacity: progress.value < 0.1 ? 0 : 1,
}));

<Animated.View
  className="w-4 h-4 rounded-full bg-primary"
  style={animatedStyle}
/>;
```

Layout transition (enter/exit):

```tsx
import { EntryExitTransition, ReduceMotion } from 'react-native-reanimated';

const itemLayout = EntryExitTransition.entering(FadeInUp.duration(180))
  .exiting(FadeOutDown.duration(120))
  .reduceMotion(ReduceMotion.System);

<Animated.View
  layout={itemLayout}
  className="px-4 py-2 rounded-md bg-surface"
/>;
```

Shared element (e.g. feed image → detail header):

```tsx
// feed card
<Animated.Image sharedTransitionTag="feed.card.image" className="w-full aspect-video rounded-lg" />
// detail screen
<Animated.Image sharedTransitionTag="feed.card.image" className="w-full aspect-video" />
```

## 5. Do / Avoid

Do:

- Use Tailwind utilities for static style; Reanimated only for what actually animates.
- Group related animated transforms in one `useAnimatedStyle` instead of multiple small ones.
- Respect platform differences with Tailwind platform prefixes (`ios:`, `android:`) instead of branching in JS where possible.
- Provide accessible tap targets (min height 44 / size tokens) directly in class names.
- Use `tailwind-variants` (tv) for component variants (already used in `Button`) instead of ad‑hoc string concatenation.
- For dark mode rely on `dark:` prefix; avoid runtime branching inside worklets—capture resolved color.

Avoid:

- Animating layout by recalculating class names each frame.
- Mount-time flicker: always supply a deterministic initial value in animated styles.
- Using shadow or border color animations every frame (costly); fade/scale instead.
- Nesting `Animated.View` needlessly—compose transforms in one container when feasible.
- Interpolating theme tokens directly as strings each frame—pre-map tokens to numeric channels if needed.

## 5.1 Color & Value Interpolation

- Prefer numeric domain interpolation on shared values: `interpolate(progress.value, [0,1], [0, 12])`.
- Color: either (a) pick discrete semantic colors at thresholds or (b) precompute rgba arrays and interpolate channels; avoid constructing large color strings in worklets repeatedly.
- Do not animate text color every frame if contrast might drop below AA—verify accessible endpoints.

## 5.2 SVG & Icons

- For `react-native-svg` elements wrapped with Reanimated, animate only transforms / opacity / strokeDashoffset. Avoid animating `d` path strings.
- Shared transitions: not for complex SVG morphing—use a simple fade/scale or static snapshot.

## 5.3 Animated Props

- Use `useAnimatedProps` for animating props (e.g., `strokeDashoffset`, `progress`) instead of mutating style when not style-related.
- Keep animated props isolated: `const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: dash.value }));`.

## 5.4 Coexisting Libraries

- `moti` is present—prefer Reanimated primitives for core/shared transitions; allow `moti` for quick one-off micro animations in prototypes only. Promote to Reanimated worklet before merging if performance critical.

## 5.5 Snapshot / Perf Audits

- When adding a new animated pattern, capture a quick performance profile (JS frame drops) on a mid-tier Android device. If > 4ms average JS frame during interaction → refactor/batch.
- If a component requires >2 animated styles, consider consolidating or using layout transitions.

## 6. Naming & Files

- Central animation helpers: `src/lib/animations/` (e.g. `transitions.ts`, `shared.ts`).
- Keep shared value names semantic (`scrollY`, `dragProgress`, `isPressed`, not `sv1`).
- Prefix shared transition tags with feature segment.

## 7. Performance Checklist

| Concern            | Action                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Re-renders         | Memoize variant class strings; keep animated changes outside React state.                       |
| JS thread blocking | Heavy calculations offload before updating shared values.                                       |
| Overdraw           | Avoid stacking semi-transparent backgrounds; reuse surfaces.                                    |
| Large lists        | Use `FlashList` / `RecyclerListView` (if introduced) + layout transitions for reorder feedback. |

## 8. Accessibility & Motion

- Honor system reduced motion: no gratuitous movement; layout transitions become instant; skip non-essential shared transitions.
- Keep focus/press states visible without animation (Tailwind `focus:*`, `active:*`).

## 9. Review Rules

PR checklist additions:

1. Static vs animated separation followed?
2. Reduced motion path considered?
3. No per-frame className churn?
4. Shared tags prefixed & unique?
5. Layout transitions used instead of manual width/height springs where possible?

## 10. Future Notes (Reanimated 4+)

- CSS animation interop is emerging; only adopt once stable & measurable benefit. Continue using worklets for deterministic perf.
- If migrating to Fabric concurrent features, re-validate layout transitions (expect stable, but retest).

---

Short version for agent: "Use Tailwind for static style, Reanimated for dynamic; keep className stable; prefer layout/shared transitions; respect reduced motion; minimize worklet logic; prefix sharedTransitionTag with feature; centralize animation helpers."
