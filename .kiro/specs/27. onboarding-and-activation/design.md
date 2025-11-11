# Onboarding & Activation — Design

Flow overview

1. Welcome + Age Gate
   - Reuse `src/app/age-gate.tsx` with localized copy
   - Underage → polite block + help link; adults → proceed

2. Legal Confirmation (one modal)
   - Reuse `LegalConfirmationModal`
   - Require acceptance of Terms, Privacy, Cannabis Policy (versioned)

3. Consent Modal (granular, equal prominence)
   - Reuse existing ConsentModal per privacy spec
   - “Accept all”, “Reject all”, toggles for telemetry/experiments/AI training/crash diagnostics

4. Pre‑permission Primers (inline)
   - Notifications: explain benefit; allow “Not now”; core app remains fully usable
   - Photos/Camera: explain usage with PHPicker/camera, optional

5. Activation Checklist (inline on Home)
   - Quick actions: “Create first task”, “Open a playbook”, “Try AI diagnosis (demo)”, “Explore strains”
   - Show progress (0/4 completed); dismissible when 2+ done

6. Empty States with sample content
   - Calendar: show example recurring task with educational copy
   - Strains: promote search tips and saved strains cache behavior
   - Community: invite to share update; explain moderation controls

Animation & interaction framework (makeitanimated)

- Adopt the makeitanimated onboarding design patterns for motion, transitions, and component choreography across steps.
- Motion tokens (to be finalized after code handoff): durations, easing curves, stagger rules, and enter/exit presets defined by makeitanimated.
- Reduce Motion: honor system setting and gate animations via Reanimated’s ReduceMotion API; provide functional, non-animated fallbacks.
- Implementation approach:
  - Create motion primitives (enter, exit, shared transitions) under `src/lib/animations/` that wrap makeitanimated patterns.
  - Keep classNames static; apply animation via `useAnimatedStyle`/entering/exiting presets, never toggling Tailwind classes per frame.
  - Sequence steps with lightweight state machines; keep UI-thread worklets pure; use runOnJS only for side-effects post-animation.
- Reference: to be appended after you share the makeitanimated code sample; we will link exact components/patterns here.

Reference implementation file map (from provided code)

Note: We will copy the style and motion system, not the exact UI. Components below are grouped by purpose with key techniques to adopt in GrowBro.

- lib/animated-index-context.tsx
  - SharedValue `activeIndex` context to synchronize animations across slides without prop drilling.

- lib/constants.ts
  - `BASE_SPRING_CONFIG` baseline for withSpring() across components: `{ mass:1, stiffness:240, damping:20 }`.

- lib/types.ts
  - `SlideItemProps { index:number }` convention for per-slide animations.

- routes/onboarding.tsx
  - Horizontal `Animated.ScrollView` with `pagingEnabled`, `scrollEventThrottle={16}`.
  - Shared `activeIndex` = offsetX / width, drives all animations.
  - Animated CTA button with opacity gated to last slide; `pointerEvents` toggled to avoid premature taps.
  - Palette-driven background glow tied to slide index.

- components/bottom-glow.tsx
  - Skia `Canvas` oval glow, `interpolateColor(..., 'HSV')` against palette; large blur radius; positioned near bottom.

- components/onboarding-slide-container.tsx
  - Layout wrapper splitting visual (top) and copy (bottom) halves per slide.

- components/pagination-dots.tsx
  - Dots whose `backgroundColor` interpolates around the active index `[i-1, i, i+1]`.

- components/slide-container.tsx
  - Crossfade wrapper for slide groups: opacity interpolates `[i-0.5, i, i+0.5] → [0,1,0]`.

- components/slide-text-container.tsx
  - Glassmorphism text chip; iOS BlurView; Android semi-transparent fallback; `borderCurve:'continuous'`.

- slides/welcome/\* (blue-card, red-card, stone-card, protocols-text)
  - Card transforms per slide (translateX/rotate/scale) using `withSpring` and `interpolate`.
  - Example: long-travel exit (2× width), dynamic rotation sequences, staggered text chip.

- slides/essentials/\* (five-per-week, once-a-week, hundred-ten..., eighty-three..., stone-card)
  - Multiple text chips sliding off/on per slide; consistent `translateX` patterns.

- slides/backed-info/\* (updated-today, temperatures, podcasts)
  - Text enters from right at varying offsets (0.25/0.5/0.75 × width) → center → exit left for pleasing stagger.

- slides/share/\* (blue-card, stone-card, hbot-text)
  - Zoom-in then settle patterns; mid-transition starts `[i-0.5]` for smooth entry.

- slides/not-medical-advice/\* (blue-card, stone-card, attention-text)
  - Opacity crossfade combined with translate/rotate/scale; attention text chips with center focus.

GrowBro adaptation guidelines

- Replace palette and card styling with GrowBro tokens (tailwind + theme roles).
- Keep className static; use Reanimated styles for motion.
- Prefer motion primitives under `src/lib/animations/` wrapping these patterns:
  - index-driven transforms (translateX/rotate/scale)
  - opacity crossfades
  - color interpolation helpers (HSV)
  - CTA gating (opacity + pointerEvents)
- Always provide Reduced Motion variants; fall back to non-animated state changes.
- Maintain 60fps budget: one shared-value write per frame; no console/logging inside worklets.

Pattern gallery (examples to achieve the native feel)

These short, self-contained examples show how to reproduce the “cards + chips + copy” feel in GrowBro using our primitives and Reduced Motion. Copy the style, not the visuals.

1. Pager skeleton + shared activeIndex

```tsx
// src/app/onboarding.tsx (skeleton)
import React from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { AnimatedIndexContext } from '@/lib/animations/index-context'; // create as in mapping doc

export default function Onboarding() {
  const { width } = useWindowDimensions();
  const activeIndex = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    const x = e.contentOffset.x;
    activeIndex.set(x / width);
  });
  return (
    <AnimatedIndexContext.Provider value={{ activeIndex }}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
      >
        {/* Slides go here */}
      </Animated.ScrollView>
    </AnimatedIndexContext.Provider>
  );
}
```

2. Card transform (translateX + rotate + scale)

```tsx
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import {
  SPRING,
  indexDrivenTranslateX,
  indexDrivenRotate,
  indexDrivenScale,
} from '@/lib/animations';

export function Card({
  index,
  activeIndex,
}: {
  index: number;
  activeIndex: SharedValue<number>;
}) {
  const rStyle = useAnimatedStyle(() => {
    const tx = indexDrivenTranslateX(
      activeIndex,
      [index, index + 1],
      [0, -300],
      { springConfig: SPRING }
    );
    const rot = indexDrivenRotate(activeIndex, [index, index + 0.5], [-6, 0]);
    const sc = indexDrivenScale(activeIndex, [index, index + 0.5], [1, 0.98]);
    return {
      transform: [{ translateX: tx }, { rotate: `${rot}deg` }, { scale: sc }],
    };
  });
  return (
    <Animated.View
      style={rStyle}
      className="rounded-3xl bg-primary-600 aspect-[1/1.2]"
    />
  );
}
```

3. Staggered text chips (Reduced Motion aware)

```tsx
import Animated, { FadeInUp, ReduceMotion } from 'react-native-reanimated';
import { Text } from '@/components/ui';

export function TextChip({
  label,
  delay = 40,
}: {
  label: string;
  delay?: number;
}) {
  return (
    <Animated.View
      entering={FadeInUp.delay(delay)
        .duration(160)
        .reduceMotion(ReduceMotion.System)}
    >
      <Text className="text-white text-sm rounded-full px-3 py-2 bg-neutral-900/40">
        {label}
      </Text>
    </Animated.View>
  );
}
```

4. Pagination dots (color around active index)

```tsx
import Animated, {
  useAnimatedStyle,
  interpolateColor,
} from 'react-native-reanimated';

function Dot({
  i,
  activeIndex,
}: {
  i: number;
  activeIndex: SharedValue<number>;
}) {
  const r = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      activeIndex.get(),
      [i - 1, i, i + 1],
      ['#666', '#fff', '#666']
    ),
  }));
  return <Animated.View style={r} className="size-2 rounded-full" />;
}
```

5. CTA gating on last slide

```tsx
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { ctaGateToLastIndex } from '@/lib/animations';
import { Button } from '@/components/ui';

function FinalCTA({
  total,
  activeIndex,
  onPress,
}: {
  total: number;
  activeIndex: SharedValue<number>;
  onPress: () => void;
}) {
  const last = total - 1;
  const r = useAnimatedStyle(() => {
    const { opacity } = ctaGateToLastIndex(activeIndex, last);
    return { opacity };
  });
  const enabled = activeIndex.get() >= last - 0.001;
  return (
    <Animated.View style={r} pointerEvents={enabled ? 'auto' : 'none'}>
      <Button label="Continue" onPress={onPress} />
    </Animated.View>
  );
}
```

6. Background gradient placeholder (no Skia)

```tsx
import { View } from 'react-native';
import { useThemeConfig } from '@/lib/use-theme-config';

export function Background() {
  const theme = useThemeConfig();
  return (
    <View
      className={theme.dark ? 'bg-neutral-900' : 'bg-white'}
      style={{ flex: 1 }}
    />
  );
}
```

Notes

- Keep className static and move motion into animated styles.
- For motion-heavy slides, prefer index-driven transforms over timers.
- Always provide Reduced Motion fallbacks (FadeIn/FadeInUp reduceMotion(System)).

Navigation & deep link behavior

- On first launch: AgeGate → Legal → Consent → Home (activation checklist visible)
- If age verified + legal accepted previously: skip to Consent (if versions changed) else Home
- Deep link to support/legal during onboarding must not break the flow; return to current step on back

Accessibility & offline

- All touch targets ≥44pt (iOS) / ≥48dp (Android) using hitSlop if needed
- Labels and hints for inputs/buttons; readable error/empty states
- Entire flow available offline (copy and sample content bundled)
