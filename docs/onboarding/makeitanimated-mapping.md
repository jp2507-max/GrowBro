# MakeItAnimated Onboarding Design — GrowBro Implementation Mapping

## Overview

This document maps the makeitanimated onboarding design patterns to GrowBro's implementation using React Native Reanimated 4.x. All animations respect system Reduced Motion preferences and follow WCAG accessibility guidelines.

## Motion Primitives (`src/lib/animations/`)

### Core Files

#### `index-context.tsx`

- **Purpose**: Provides shared `activeIndex` context for synchronized animations across pager slides
- **Based on**: `lib/animated-index-context.tsx` from makeitanimated
- **Usage**: Wrap pager components with `AnimatedIndexProvider` and access via `useAnimatedIndex()`
- **Key Feature**: Eliminates prop drilling for scroll-driven animations

```tsx
import { AnimatedIndexProvider, useAnimatedIndex } from '@/lib/animations';

// In pager screen:
const activeIndex = useSharedValue(0);
<AnimatedIndexProvider activeIndex={activeIndex}>
  {/* Slide content */}
</AnimatedIndexProvider>;

// In slide component:
const activeIndex = useAnimatedIndex();
```

#### `stagger.ts`

- **Purpose**: Sequential enter animations for content choreography
- **Pattern**: Index-based delays for natural, staggered appearance
- **API**: `createStaggeredFadeIn(index, config)`
- **Presets**:
  - `onboardingMotion.stagger.header` — Title/hero elements (0ms base, 60ms stagger)
  - `onboardingMotion.stagger.content` — Body text (100ms base, 40ms stagger)
  - `onboardingMotion.stagger.actions` — CTAs/buttons (300ms base, 50ms stagger)
  - `onboardingMotion.stagger.list` — List items (150ms base, 35ms stagger)
- **Reduced Motion**: Automatically applied via `.reduceMotion(ReduceMotion.System)`

```tsx
import { createStaggeredFadeIn, onboardingMotion } from '@/lib/animations';

<Animated.View
  entering={createStaggeredFadeIn(0, onboardingMotion.stagger.header)}
>
  <Text>Title</Text>
</Animated.View>;
```

#### `motion.ts`

- **Purpose**: Motion tokens (durations, easings) for consistent timing
- **Based on**: `lib/constants.ts` from makeitanimated (`BASE_SPRING_CONFIG`)
- **Tokens**:
  - `motion.dur.xs` — 120ms (micro-interactions, quick feedback)
  - `motion.dur.sm` — 180ms (standard transitions, content enter)
  - `motion.dur.md` — 260ms (emphasized transitions, navigation)
  - `motion.dur.lg` — 360ms (complex animations, layout changes)
- **Easings**:
  - `motion.ease.standard` — `bezier(0.2, 0, 0, 1)` (default easing)
  - `motion.ease.emphasized` — `bezier(0.4, 0, 0.2, 1)` (attention-grabbing)
  - `motion.ease.decel` — `bezier(0, 0, 0.2, 1)` (settling)
- **Helper**: `withRM(animation)` wraps any animation with Reduced Motion support

```tsx
import { motion, withRM } from '@/lib/animations';

entering={withRM(FadeIn.duration(motion.dur.md).easing(motion.ease.standard))}
```

#### `primitives.ts`

- **Purpose**: Index-driven transform utilities for pager-based animations
- **Based on**: Slide transform patterns from makeitanimated (`slides/welcome/*`, `slides/essentials/*`)
- **Functions**:
  - `indexDrivenTranslateX` — Horizontal movement tied to scroll position
  - `indexDrivenRotate` — Rotation based on active index
  - `indexDrivenScale` — Scale transforms for depth effects
  - `crossfadeAroundIndex` — Opacity crossfade centered on specific slide
  - `hsvInterpolateColor` — HSV color interpolation for smooth gradients
  - `ctaGateToLastIndex` — Opacity + enabled state for final CTA button
- **Spring Support**: All primitives support `withSpring` via `opts.spring` flag
- **Usage**: Primarily for future pager-based onboarding screens (task 3.1)

```tsx
import { indexDrivenScale, SPRING } from '@/lib/animations';

const rStyle = useAnimatedStyle(() => ({
  transform: [
    {
      scale: indexDrivenScale({
        activeIndex,
        inputRange: [i, i + 1],
        outputRange: [1, 0.9],
        opts: { springConfig: SPRING },
      }),
    },
  ],
}));
```

#### `constants.ts`

- **Purpose**: Baseline spring physics configuration
- **Based on**: `BASE_SPRING_CONFIG` from makeitanimated
- **Value**: `{ mass: 1, stiffness: 240, damping: 20 }`
- **Usage**: Pass to `withSpring` or animation primitives for consistent bounce feel

---

## Component Implementation Map

### 1. Age Gate (`src/app/age-gate.tsx`)

**makeitanimated patterns applied:**

- **Staggered text enter**: Title → body → disclaimers (header + content presets)
- **Input reveal**: Birth date fields animate in after copy
- **Error feedback**: Quick fade-in for validation errors (`motion.dur.xs`)
- **CTA staging**: Submit button enters last in sequence

**Key changes:**

- Replaced single container `FadeIn` with per-element stagger
- Added `createStaggeredFadeIn` to each text block (0-4 index sequence)
- Birth date inputs: single group animation (index 5)
- Error message: instant feedback with quick duration
- Submit button: action preset delay (index 4)

**Before/After:**

```tsx
// Before: Single container fade
<Animated.View entering={FadeIn.duration(220)}>
  <AgeGateCopy />
  <BirthDateInputs />
  <Button />
</Animated.View>

// After: Staggered choreography
<View>
  <AgeGateCopy /> {/* Each line staggered */}
  <BirthDateInputs /> {/* Group animation */}
  <Button /> {/* Action delay */}
</View>
```

**Reduced Motion:** All animations honor system preference; fallback to immediate appearance.

---

### 2. Legal Confirmation Modal (`src/components/legal-confirmation-modal.tsx`)

**makeitanimated patterns applied:**

- **Header sequence**: Title → subtitle (header preset, 0-1 index)
- **List items**: Three legal sections stagger in (list preset, 0-2 index)
- **Actions**: Accept/Decline buttons sequence (actions preset, 0-1 index)
- **Conditional error**: Warning message appears instantly if validation fails

**Key changes:**

- Split header into two separate animated views for title/subtitle stagger
- Applied list preset to each `LegalDocumentSection` wrapper
- Actions now sequence with 300ms base delay + 50ms stagger
- Error message uses quick duration (120ms) for immediate feedback

**Pattern:** List-heavy UI benefits from subtle sequential reveals to guide attention without overwhelming.

---

### 3. Consent Modal (`src/components/consent-modal.tsx`)

**makeitanimated patterns applied:**

- **Header enter**: Title fades in first (header preset, index 0)
- **Content block**: Toggle group appears next (content preset, index 1)
- **Action buttons**: Dual CTAs + Save button sequence (actions preset, 0-1 index)

**Key changes:**

- Header, content, actions now three distinct animation groups
- Button row enters as single unit, followed by Save button
- Simplified from nested delays to preset-based stagger

**Pattern:** Modal animations are subtle (shorter durations) to respect user attention and avoid feeling "in the way."

---

### 4. Permission Primer Screen (`src/components/onboarding/permission-primer-screen.tsx`)

**makeitanimated patterns applied:**

- **Icon hero**: Large circular icon enters first (header preset, index 0)
- **Title + description**: Sequential text reveals (header + content presets, 1-2 index)
- **Benefits list**: Each benefit item staggers individually (custom 300ms base + 50ms stagger)
- **CTAs**: Allow → Not Now → Privacy note (custom 450ms base for bottom-heavy timing)

**Key changes:**

- Replaced fixed delays (100/200/300ms) with preset-driven stagger
- Benefits list now maps over items with individual `createStaggeredFadeIn` calls
- Action buttons use longer base delay (450ms) to ensure content reads first
- Privacy note enters last with standard duration

**Pattern:** Permission primers emphasize _why_ before _what_ — benefits list gets extra stagger time for comprehension.

---

## Animation Hierarchy & Timing Strategy

### Onboarding Flow Timing Ladder

1. **Hero/Icon** (0ms base) — Immediate anchor
2. **Title** (60ms stagger) — Primary message
3. **Body/Description** (100ms base, 40ms stagger) — Supporting details
4. **Interactive elements** (150-300ms base, 35-50ms stagger) — Lists, inputs, toggles
5. **CTAs** (300-450ms base, 50ms stagger) — Action buttons appear last

### Duration Guidelines

- **Micro-feedback** (120ms) — Errors, validation, instant responses
- **Content enter** (180ms) — Text, images, standard UI
- **Emphasized** (260ms) — Navigation, modals, major transitions
- **Complex** (360ms) — Layout shifts, multi-step sequences

### Reduced Motion Behavior

- All animations use `.reduceMotion(ReduceMotion.System)`
- Fallback: Instant appearance with no motion (accessibility requirement met)
- No functionality is gated behind animations (privacy-first principle)

---

## Future Patterns (Task 3.1: Pager Library Integration)

When implementing horizontal pager onboarding (using `react-native-onboarding` or custom):

### 1. Scroll-Driven Card Transforms

**makeitanimated reference**: `slides/welcome/blue-card.tsx`, `slides/essentials/stone-card.tsx`

```tsx
import {
  useAnimatedIndex,
  indexDrivenScale,
  indexDrivenRotate,
} from '@/lib/animations';

function CardSlide({ index }: { index: number }) {
  const activeIndex = useAnimatedIndex();

  const rStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: indexDrivenScale({
          activeIndex,
          inputRange: [index, index + 1],
          outputRange: [1, 0.95],
        }),
      },
      {
        rotate: `${indexDrivenRotate({ activeIndex, inputRange: [index, index + 0.5], outputRange: [0, -3] })}deg`,
      },
    ],
  }));

  return (
    <Animated.View style={rStyle} className="rounded-3xl bg-primary-600" />
  );
}
```

### 2. Pagination Dots with Color Interpolation

**makeitanimated reference**: `components/pagination-dots.tsx`

```tsx
import { hsvInterpolateColor } from '@/lib/animations';

function Dot({
  i,
  activeIndex,
}: {
  i: number;
  activeIndex: SharedValue<number>;
}) {
  const rStyle = useAnimatedStyle(() => ({
    backgroundColor: hsvInterpolateColor(
      activeIndex,
      [i - 1, i, i + 1],
      ['#666', '#fff', '#666']
    ),
  }));
  return <Animated.View style={rStyle} className="size-2 rounded-full" />;
}
```

### 3. CTA Gating on Last Slide

**makeitanimated reference**: `routes/onboarding.tsx` (CTA button opacity + pointerEvents)

```tsx
import { ctaGateToLastIndex } from '@/lib/animations';

function FinalCTA({ total, activeIndex, onPress }: Props) {
  const last = total - 1;
  const rStyle = useAnimatedStyle(() => {
    const { opacity, enabled } = ctaGateToLastIndex(activeIndex, last);
    return { opacity };
  });
  const enabled = activeIndex.value >= last - 0.001;

  return (
    <Animated.View style={rStyle} pointerEvents={enabled ? 'auto' : 'none'}>
      <Button label="Continue" onPress={onPress} />
    </Animated.View>
  );
}
```

---

## Testing Reduced Motion

### Manual Test (iOS Simulator)

1. Settings → Accessibility → Motion → Reduce Motion → ON
2. Launch GrowBro → Age Gate
3. **Expected**: All content appears instantly without animation
4. **Verify**: No frame drops, no visual artifacts, full functionality

### Manual Test (Android Emulator)

1. Settings → Accessibility → Remove animations → ON
2. Launch GrowBro → Age Gate
3. **Expected**: Same as iOS (instant appearance)

### Automated Test (Jest + RNTL)

```tsx
// src/app/__tests__/onboarding-flow.test.tsx
test('Age Gate renders instantly with Reduced Motion', async () => {
  // Mock system Reduced Motion preference
  jest.mock('react-native-reanimated', () => ({
    ...jest.requireActual('react-native-reanimated'),
    ReduceMotion: { System: 'system' },
  }));

  setup(<AgeGateScreen />);

  // All elements should be immediately visible
  expect(await screen.findByText(/age gate title/i)).toBeOnTheScreen();
  expect(await screen.findByTestId('age-gate-day')).toBeOnTheScreen();
  expect(await screen.findByTestId('age-gate-submit')).toBeOnTheScreen();

  // No animation delays
});
```

---

## Performance Checklist

- [ ] No per-frame `runOnJS` calls (all animations stay on UI thread)
- [ ] No `className` flipping based on animation state (static Tailwind)
- [ ] One shared value write per frame max
- [ ] Spring configs centralized in `constants.ts`
- [ ] `cancelAnimation` not needed (entering/exiting animations auto-cleanup)
- [ ] Tested on low-end Android (< 2GB RAM) — no frame drops
- [ ] Tested with Reduced Motion ON — instant appearance
- [ ] Tested with screen reader (TalkBack/VoiceOver) — no motion interrupts navigation

---

## References

- **Design Spec**: `.kiro/specs/27. onboarding-and-activation/design.md`
- **Requirements**: `.kiro/specs/27. onboarding-and-activation/requirements.md`
- **GrowBro Reanimated Guidelines**: `.cursor/rules/projectrules.mdc` (section: "React Native Reanimated Production Guidelines")
- **makeitanimated Source**: Provided reference implementation (file-by-file mapping in design spec lines 41-101)

---

## Migration Notes (v3 → v4)

- **FadeInUp**: Not available in some Reanimated 4.x builds; use `FadeIn` instead (provides same fade effect, slightly different exit vector)
- **Auto-workletization**: Removed explicit `'worklet'` directives from animation callbacks (v4 handles automatically)
- **Gesture Handler**: All gesture-based animations use RNGH v2 `Gesture` API (no legacy handlers)
- **Layout Animations**: Prefer `Layout.duration()` and `EntryExitTransition` over manual size/position tweening

---

**Document Version**: 1.0  
**Last Updated**: Task 3 completion (onboarding motion primitives integration)  
**Maintainer**: GrowBro Engineering Team
