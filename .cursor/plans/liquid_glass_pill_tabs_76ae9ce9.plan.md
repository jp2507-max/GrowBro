---
name: Liquid glass pill tabs
overview: Implement an iOS-26-style floating “liquid glass” bottom tab bar with a draggable sliding capsule using your existing Expo Router JS Tabs + CustomTabBar (no new packages).
todos:
  - id: tabs-data
    content: Align CustomTabBar visible tabs with TabLayout (add inventory, 5 tabs) and keep order consistent.
    status: pending
  - id: pill-ui
    content: Redesign CustomTabBar into a floating rounded glass pill using OptionalBlurView + gradient + border tokens.
    status: pending
    dependencies:
      - tabs-data
  - id: pill-animation
    content: Add Reanimated sliding active capsule (spring) and integrate scroll-hide behavior.
    status: pending
    dependencies:
      - pill-ui
  - id: pill-gesture
    content: Implement draggable capsule with RNGH v2 Pan gesture (clamp, snap, navigate via runOnJS onEnd).
    status: pending
    dependencies:
      - pill-animation
  - id: i18n-accessibility
    content: Add missing EN/DE accessibility hints for inventory tab and ensure labels/hints are wired.
    status: pending
    dependencies:
      - tabs-data
  - id: tests
    content: Update CustomTabBar and TabLayout tests; add pure helper tests for snap math.
    status: pending
    dependencies:
      - pill-gesture
      - i18n-accessibility
---

# Liquid glass pill bottom tabs (draggable)

## Why Expo Router Native Tabs won’t work for this UI

- **Native Tabs is platform-native system tabs** (alpha in SDK 54) with a **styling API** (e.g. `backgroundColor`, `blurEffect`, per-trigger tab bar overrides) — it does **not** provide a way to render a fully custom tab bar layout/shape or a draggable sliding capsule.
- For a floating “pill” + **animated + draggable** active capsule like your reference image, we need a **custom tab bar** rendered in React Native.

References:

- Expo docs: Native tabs (alpha) API `expo-router/unstable-native-tabs` (`backgroundColor`, `blurEffect`, etc.)
- Expo docs: Custom tab layouts via **headless** components (`expo-router/ui`) for complex UI patterns

## What we’ll build in this repo (no new packages)

You already have:

- Expo Router JS tabs + a custom renderer: `tabBar={(p) => <CustomTabBar {...p} />}` in [`src/app/(app)/_layout.tsx`](<src/app/(app)/_layout.tsx>)
- `react-native-reanimated` + RNGH v2 + `GestureHandlerRootView`
- `expo-blur` and `expo-linear-gradient`
- Motion tokens in [`src/lib/animations/motion.ts`](src/lib/animations/motion.ts)

So we’ll implement the “liquid glass pill” by **upgrading** [`src/components/navigation/custom-tab-bar.tsx`](src/components/navigation/custom-tab-bar.tsx).

## Implementation plan

### 1) Update tab list to match your desired visible tabs (5 tabs)

- Add the missing **Inventory** tab button to `TAB_ITEMS` (you selected 5 visible tabs).
- Ensure the order matches your `Tabs.Screen` order in [`src/app/(app)/_layout.tsx`](<src/app/(app)/_layout.tsx>).

### 2) Redesign `CustomTabBar` visuals into a floating glass pill

- Keep the current **scroll-hide** behavior (animated `bottom` offset) but change the rendered bar from full-width to a centered/floating pill.
- Use `AnimatedOptionalBlurView` (from [`src/components/shared/optional-blur-view.tsx`](src/components/shared/optional-blur-view.tsx)) as the pill background.
- iOS: use `tint` like `'systemChromeMaterial'` / light/dark variants.
- Android: accept that blur may degrade to translucency; layer a subtle gradient overlay.
- Add:
- Rounded pill container (`borderRadius: 999`, `overflow: 'hidden'`) with a thin border using existing tokens (`colors.darkSurface.border`, `colors.neutral[200]`, etc.).
- Icon + label per tab to match the reference (labels from existing `tabs.*` translations).

### 3) Implement the sliding “active capsule” + liquid motion

- Measure pill width via `onLayout` (store width in state/ref) and derive `segmentWidth = (pillInnerWidth / tabCount)`.
- Render an `Animated.View` active capsule positioned absolutely within the pill.
- Animate capsule X with `withSpring` (slightly bouncy) for the “liquid” feel.
- Optional micro-effect (still lightweight): scale capsule slightly based on drag velocity (worklet-only).

### 4) Make the capsule draggable (pan + snap + navigate)

- Add a `GestureDetector` with `Gesture.Pan()` on the capsule:
- **onBegin**: capture starting X.
- **onUpdate**: update capsule X (clamped to bounds) on UI thread.
- **onEnd**: snap to nearest tab index and **runOnJS** to navigate (only in `onEnd`, never per-frame).
- Reuse your existing `handleTabPress` logic for emitting `tabPress` + canPreventDefault.

### 5) Accessibility + testIDs

- Keep/extend stable `testID`s for each tab button.
- Ensure each tab has `accessibilityRole="tab"`, correct `accessibilityState.selected`, labels/hints.

### 6) I18n updates (EN/DE)

- Add missing hints for the new visible inventory tab:
- `accessibility.tabs.inventory_hint` in [`src/translations/en.json`](src/translations/en.json) and [`src/translations/de.json`](src/translations/de.json)
- Keep existing keys; don’t break current ones (e.g. `plants_hint` can remain if still used elsewhere).

### 7) Update and extend unit tests

- Update [`src/components/navigation/custom-tab-bar.test.tsx`](src/components/navigation/custom-tab-bar.test.tsx):
- Expect **5** tabs.
- Add focused/unfocused press coverage for `inventory`.
- Prefer testing pure helpers: extract `getNearestTabIndex(x, segmentWidth, count)` and test snap math without needing to simulate RNGH pan events.
- Fix outdated tab layout test [`src/app/(app)/__tests__/_layout.test.tsx`](<src/app/(app)/**tests**/_layout.test.tsx>) (it currently expects `plants`, but the layout registers `inventory`).

## Web inspiration (patterns we’ll emulate, not necessarily install)

- GitHub: `moeen-mahmud/react-native-floating-tab` (floating tabs; supports Expo Router)
- GitHub: `torgeadelin/react-native-animated-nav-tab-bar` (floating + animated)
- GitHub: `gorhom/react-native-animated-tabbar` (animated presets; older but good patterns)

## How you’ll verify (Windows-friendly)

- **Unit tests**:
- `pnpm test custom-tab-bar -- --coverage --coverageReporters="text"`
- **Manual**:
- Run Metro: `pnpm start`
- Use an iOS dev build from EAS (cloud-compiled) on a real device; verify drag + snap + blur.

## Risks / constraints

- **Android blur fidelity**: `expo-blur` can degrade to translucency on SDK 54; we’ll design a graceful fallback (gradient + translucent fill) but it won’t be identical to iOS.
- **Gesture conflicts**: we’ll tune pan activation (minDistance) so taps on icons remain reliable.
