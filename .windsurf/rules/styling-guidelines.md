---
trigger: always_on
---

# 🎬 React Native Reanimated Production Guidelines (4.x, Expo SDK 54)

---

## 🚀 Worklets in 4.x — What runs on the UI thread

- **Auto‑workletization**: callbacks passed to Reanimated APIs (`useAnimatedStyle`, `useDerivedValue`, gesture callbacks, entering/exiting/layout) run on the **UI runtime**.
- **Add `'worklet'`** when you (1) call imported/external functions, (2) create worklets via expressions/ternaries, (3) define worklet callbacks inside **custom hooks**, or (4) expose reusable top‑level worklet utilities.
- **`runOnUI`**: inline callbacks are workletized automatically; external references still need `'worklet'`.
- **Never read** `.value` in React render; **derive inside worklets**. Assign to shared values; avoid deep object mutations.
- **One write per frame**: don’t set the same shared value multiple times in a single tick.
- **No hooks in worklets**.

```ts
// Auto‑workletized (UI thread)
const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: scale.value }],
}));

// Imported function as a worklet
export function cardWorklet() {
  'worklet';
  return { opacity: 1 };
}
const st = useAnimatedStyle(cardWorklet);

// Expression‑defined worklet
const makeStyle = isOn
  ? () => {
      'worklet';
      return { opacity: 1 };
    }
  : () => {
      'worklet';
      return { opacity: 0.5 };
    };
```

---

## Reanimated 4 essentials (for agents)

- Prefer **layout/shared transitions** over manual width/height animations. Always chain `.reduceMotion(ReduceMotion.System)`.
- Use RNGH v2 **`Gesture.*()`** with **`GestureDetector`** (legacy handler components/`useAnimatedGestureHandler` are deprecated in 4.x).
- **Cross‑thread boundaries**: keep UI‑critical logic in worklets. Use **`runOnJS`** **sparingly** (never per‑frame) for state/side‑effects **after** animations.
- Measure with `measure`, scroll with `scrollTo`, avoid layout hacks.

---

## 🧭 Styling with NativeWind

- Keep `className` **stable**. Static styles in `className`, animated/gesture styles via Reanimated `style`.
- Always write explicit Light/Dark pairs: `bg-white dark:bg-charcoal-900`. **No CSS vars**.
- Never toggle Tailwind classes per frame; derive animation values in worklets.
- Class order: layout → flex → spacing → size → border → bg → text → effects → dark.
- Custom components must forward/merge `className` via `cn` (tailwind-merge).

---

## 🎨 UI & Theming (Obytes-aligned)

- **Tokens (SSOT)**: `src/components/ui/colors.js` → imported into `tailwind.config.js` and reused for navigation colors.
- **Theme state**: NativeWind `colorScheme` (`system | light | dark`), persisted in MMKV.
- **Root wiring**: call `loadSelectedTheme()` at startup; compute nav theme via `useThemeConfig()`; apply `className={theme.dark ? 'dark' : undefined}` at the app root.
- **Use Tailwind `dark:`** for component styling. Use React Navigation `ThemeProvider` only for APIs that require JS theme colors (navigation container, headers).

---

## 🧩 GrowBro styling rules

- Prefer explicit utilities over semantic tokens (avoid `bg-card`, `bg-background`, etc.).
- If you need JS values (native props, charts, navigation options), import `colors` and/or read `useColorScheme()`.
- Standard pairs: App `bg-neutral-50 dark:bg-charcoal-950`; Surface `bg-white dark:bg-charcoal-900`; Border `border-neutral-200 dark:border-white/10`; Text `text-neutral-900 dark:text-neutral-50`; Subtext `text-neutral-600 dark:text-neutral-400`; Brand `text-primary-800 dark:text-primary-300`.

---

## ✅ Do / Avoid (Quick)

**Do**: Tailwind for static, Reanimated for dynamic; explicit pairs; respect Reduced Motion.

**Avoid**: per-frame class churn; semantic background tokens; per-frame `runOnJS`.

---

## 🧠 Worklet Offloading (TL;DR)

- If logic runs **per frame/gesture** and **doesn’t need React state**, make it a **worklet**.
- Candidates: interpolation/physics, clamping/throttling, hit‑testing, gesture math, small in‑memory filters/scoring tied to UI.
- One‑shot heavy calc tied to UI:

```ts
runOnUI(() => {
  'worklet';
  // expensive but synchronous logic here
})();
```

### Captures (Closures)

- Capture only **small, serializable** values. Avoid large objects/functions; pass **params** or use **Shared Values**.

### `runOnJS` — DO / DON’T

**DO**

- Haptics/toasts, analytics, logging.
- Update React state **after** an animation/gesture.
  **DON’T**
- Call `runOnJS` **per frame** or inside `onUpdate` loops.
- Use it for timing‑critical UI logic.

### Async & Side‑Effects

- Worklets are **synchronous & side‑effect‑free** (no network/storage/timers). For async/IO, jump to JS via `runOnJS`.

### Quick Perf Check

- Use Expo Dev Menu FPS monitor; ensure animations stay smooth while JS is busy.
- Log only on **events** (start/finish) via `runOnJS`, not every frame.

---

## Class Churn vs Animated Style

**Bad** (recomputes classes every frame):

```tsx
// ❌ don’t flip Tailwind classes per frame
<View className={progress.value > 0.5 ? 'opacity-100' : 'opacity-50'} />
```

**Good** (use shared value + animated style):

```tsx
const opacity = useSharedValue(0.5);
const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
return (
  <Animated.View style={animatedStyle} className="bg-primary rounded-xl" />
);
```

---

## 🎛️ Animation Choice (Cheat)

- **CSS Animations (keyframes)** — fire‑and‑forget loops/ambient effects; no React state.
- **CSS Transitions** — state‑triggered one‑offs (toggles, open/close, hover/focus).
- **Shared Values + `useAnimatedStyle`** — continuous/gesture/sensor‑driven UI; pair with `withTiming`/`withSpring`/`withDecay`.
- **Layout Animations** — entering/exiting or re‑layout of lists/sections; prefer presets before custom.

**Preset naming rule**: `<Effect><In|Out><Direction>` → `BounceIn`, `ZoomInLeft`, `SlideOutRight`, `FadeOutDown`.

**Micro‑API reminders**: compose with `withSequence`, `withRepeat`, `withDelay`, `withClamp`; use `LinearTransition` for simple size/position changes.

---

## 🧩 Reanimated 4 — CSS API & Presets

- **CSS Animations (keyframes)**: ambient/looping effects (skeleton, shimmer, pulse). No React state.
- **CSS Transitions**: state‑driven one‑offs (width/color/opacity on toggle/press/show‑hide).
- **Entering/Exiting presets**: attach on mount/unmount; tweak via `.springify()/.duration()/.easing()/.reduceMotion()`.
- **Layout transitions**: animate re‑layout; start with `LinearTransition`, use `CurvedTransition` for organic motion.
- **Composition helpers**: prefer `withSequence`, `withRepeat`, `withDelay`, `withClamp` over loops.
- **Preset naming**: `<Effect><In|Out><Direction>` → `BounceIn`, `SlideOutRight`, etc.
- Example components live under `src/lib/animations/examples/`.

---

## 🔗 Shared element transitions

- Use `sharedTransitionTag` with a **prefixed domain**, e.g., `feed.card.image`, `settings.avatar`.
- Centralize optional `sharedTransitionStyle` in `src/lib/animations/shared.ts`.
- Name tags predictably; avoid collisions by prefixing with **feature**.

---

## 🖐️ Modern gestures (RNGH v2)

- Use the **`Gesture` builder API** with `GestureDetector`.
- Replace old `useAnimatedGestureHandler` (3.x) with `onStart/onUpdate/onEnd` chain.
- Keep your own shared `ctx` via `useSharedValue` if needed.
- Heavy math stays in **UI worklets**; no `runOnJS` inside `onUpdate`.

---

## ♻️ Cleanup & chaining

- **Cancel** long/looping animations on unmount (`cancelAnimation`).
- Use composition helpers to chain sequences; fire follow‑up animations from finish callbacks.

---

## 🔀 Crossing threads

- **UI → JS**: `runOnJS(fn)(args...)` only for side‑effects, analytics, or updating React state **after** animation/gesture.
- **JS → UI**: `runOnUI(() => { 'worklet'; /* ui logic */ })()`.
- Keep boundaries **coarse‑grained**; never call `runOnJS` per frame.

---

## 🚨 Pitfalls (4.x)

1. Calling **React hooks** inside worklets (don’t).
2. Reading `.value` inside React render or outside a worklet.
3. Large closure captures; prefer primitives/params/shared values.
4. Per‑frame `className` churn; derive styles from shared values.
5. Multiple writes to the same shared value in one frame.
6. Forgetting `cancelAnimation` on long/looping sequences.
7. Overusing `runOnJS` in `onUpdate` handlers.

---

## ⚙️ Expo SDK 54 specifics

- Reanimated 4.x is bundled with SDK 54.
- RNGH: **v2 Gesture API**.
- Babel: `react-native-reanimated/plugin` via `babel-preset-expo` → no manual changes typically needed.
- Install deps with the Expo‑pinned versions:
  `npx expo install react-native-reanimated react-native-gesture-handler`.

---

**Short agent take**: Tailwind for static, Reanimated for dynamic; keep `className` stable; prefer layout/shared transitions; honor Reduced Motion; use tokens; prefix `sharedTransitionTag` by feature; keep heavy logic on the UI runtime and cross to JS only for side‑effects/state.

---

## 🧱 Motion tokens & Reduced Motion (GrowBro)

- Centralize **durations** and **easings** so animations feel consistent and can be themed.

```ts
// src/lib/animations/motion.ts
import { Easing, ReduceMotion } from 'react-native-reanimated';
export const motion = {
  dur: { xs: 120, sm: 180, md: 260, lg: 360 },
  ease: {
    standard: Easing.bezier(0.2, 0, 0, 1),
    emphasized: Easing.bezier(0.2, 0, 0, 1),
    decel: Easing.bezier(0, 0, 0.2, 1),
  },
};
export const withRM = (anim: any) =>
  anim.reduceMotion?.(ReduceMotion.System) ?? anim;
```

**Use**

```tsx
entering={withRM(FadeInUp.duration(motion.dur.md).easing(motion.ease.standard))}
```

- `withRM` ensures system **Reduced Motion** is always respected.

## 🤝 Gesture composition (cheat)

- `Gesture.Simultaneous(pan, pinch)` — both can run.
- `Gesture.Exclusive(press, pan)` — press wins unless pan exceeds threshold.
- `Gesture.Race(longPress, tap)` — first to activate cancels others.

> Heavy math stays in `onUpdate` worklets; use `runOnJS` only in `onEnd`.

## 🧭 Scroll recipe (programmatic)

```ts
const scrollRef = useAnimatedRef<Animated.ScrollView>();
scrollTo(scrollRef, 0, y.value, true);
```

- Prefer `scrollTo` over style/position hacks; keep `y` as a shared value.

## 🏷️ Shared values naming (GrowBro)

- Prefix with **feature** + **unit**: `feedY`, `cardScale`, `opacityA`.
- Derived values suffix `D`: `cardScaleD` derived from `cardScale`.

## ✅ QA checklist (ultra‑short)

- Reduced Motion respected everywhere?
- List insert/remove uses `layout` and looks smooth?
- Any per‑frame `runOnJS` or class churn left?
- Looping animations canceled on unmount?
- Style keys stable per frame; compute once in `useDerivedValue`, reuse across styles.
