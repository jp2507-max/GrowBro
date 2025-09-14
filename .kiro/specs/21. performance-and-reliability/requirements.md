# Requirements Document

## Introduction

This feature focuses on implementing comprehensive performance optimizations and reliability improvements for the GrowBro mobile application. The goal is to ensure smooth 60 FPS performance across all user interactions, eliminate rendering issues like blank cells in lists, and establish robust performance monitoring through CI/CD pipelines. This includes upgrading to FlashList v2 with proper optimization patterns, auditing Reanimated worklets for performance bottlenecks, validating React Native New Architecture compatibility, and implementing automated performance budgets in continuous integration.

## Global Performance Context

**Build & Device Matrix:** All performance SLAs apply to release builds (Hermes enabled, no dev menu/remote debug) on Expo SDK 53 (RN 0.79) targeting Pixel 6a (Android 14), Moto G Power/G Play (Android 13), and iPhone 12 (iOS 17/18).

**Frame Budget Definitions:** "60 FPS" equals ≤16.7 ms per frame; track jank (missed deadlines) and dropped frame percentage in reports.

**Measurement Stack:** Sentry RN Performance for app.startup/navigation/sync spans, @shopify/react-native-performance for TTI/TTFD + render spans, Android Perfetto/FrameTimeline for jank confirmation, React Navigation instrumentation enabled.

## Requirements

### Requirement 1

**User Story:** As a user, I want all list interfaces to scroll smoothly at 60 FPS without blank cells or rendering glitches, so that I can navigate through my cultivation data seamlessly.

#### Acceptance Criteria

1. WHEN scrolling any list for 30 seconds on target devices THEN average FPS MUST be ≥58, dropped frames ≤1%, P95 frame time ≤16.7 ms, jank count ≤5 per 1k frames, captured from release builds and attached to CI artifact
2. WHEN performing 10 rapid top↔bottom scrolls of 1,000-item datasets with mixed row types THEN 0 blank cells SHALL be observed; if images pending, show cached thumbnail or BlurHash/ThumbHash placeholder (not empty)
3. WHEN lists are implemented THEN all production lists MUST use FlashList v2 with stable keyExtractor, getItemType for heterogeneous rows, memoized renderItem; no FlatList in production screens
4. WHEN lists contain performance-sensitive content THEN per screen limits MUST be enforced: ≤1 JSON parse >1 MB, ≤3 DB reads on first paint, no layout thrash (≤1 layout pass per frame while scrolling)
5. WHEN performance tests run THEN they MUST execute on release builds only; CI MUST fail if **DEV** is true during performance validation

### Requirement 2

**User Story:** As a developer, I want all Reanimated worklets to be optimized and audited for performance, so that animations run smoothly on the UI thread without blocking JavaScript execution.

#### Acceptance Criteria

1. WHEN Reanimated is configured THEN Babel plugin MUST be enabled; all UI-thread functions MUST be marked with 'worklet'; lint rule MUST forbid console.log/network calls inside worklets
2. WHEN worklets are implemented THEN they MUST be pure and short-running; no large closures/objects captured; heavy math MUST be precomputed or deferred to JS thread via runOnJS
3. WHEN continuous pan/scroll/drag gestures occur THEN input-to-render latency MUST be ≤50 ms (P95); no dropped frames >1% on target devices (release build); Perfetto trace attached
4. WHEN shared values are accessed THEN they MUST use useSharedValue/useDerivedValue; no cross-thread data races; animation completions MUST use callbacks (not busy loops)
5. WHEN animation performance issues are fixed THEN a minimal repro MUST exist; after fix, a Reassure test MUST lock the interaction budget

### Requirement 3

**User Story:** As a developer, I want the app to be fully compatible with React Native New Architecture (Turbo Modules and JSI), so that we can leverage improved performance and future-proof the codebase.

#### Acceptance Criteria

1. WHEN EAS builds are created THEN New Architecture MUST be enabled (Fabric/Turbo/bridgeless); Expo SDK 53 supports NA across expo-\* modules; build logs MUST show NA enabled
2. WHEN full app test suite runs under NA THEN it MUST pass on all target devices with no NA warnings in logs and no bridge fallback for our modules
3. WHEN third-party libraries are evaluated THEN any incompatible library MUST be either upgraded or replaced; decision log MUST link to upstream issue/PR
4. WHEN comparing startup performance THEN cold-start TTI pre/post NA MUST be measured; RN Performance report MUST be attached to CI (expect improvement with RN 0.79 + Expo 53)
5. WHEN New Architecture is enabled THEN TurboModules and Fabric MUST be enabled together (enabling only TurboModules without Fabric is not supported)

### Requirement 4

**User Story:** As a developer, I want automated performance budgets in CI/CD pipelines, so that performance regressions are caught before reaching production.

#### Acceptance Criteria

1. WHEN CI performance budgets are enforced THEN they MUST fail if exceeded: Agenda scroll P95 frame time ≤16.7 ms with dropped frames ≤1%; Startup TTI ≤1.8s (Pixel 6a), ≤1.3s (iPhone 12); Navigation transition P95 ≤250ms; Sync (500 items) P95 ≤2.5s on LTE
2. WHEN performance tests run THEN deterministic scroll/interaction scripts (Maestro/Detox) MUST execute in release on emulators + 1 physical Android; artifacts MUST include Sentry trace URLs + Perfetto trace on Android
3. WHEN performance metrics are tracked THEN CI MUST upload time series to Sentry Performance dashboards (Navigation, Startup, Sync) and gate on 7-day moving average deltas >10%
4. WHEN component-level regression testing occurs THEN Reassure MUST be integrated with Jest to compare render timings for critical components (Agenda row, Post card) vs. locked baseline
5. WHEN performance reports are generated THEN they MUST include device, OS, build hash, commit, dataset size, FPS, dropped frame %, jank count, memory delta, CPU peak

### Requirement 5

**User Story:** As a developer, I want comprehensive performance monitoring and profiling tools integrated into the development workflow, so that I can identify and resolve performance bottlenecks efficiently.

#### Acceptance Criteria

1. WHEN local profiling is needed THEN `pnpm perf:profile` MUST launch a release build with Sentry tracing on, RN Performance markers, and Android System Trace; output MUST include Sentry link + Perfetto file
2. WHEN navigation occurs THEN React Navigation perf instrumentation MUST be enabled; every screen mount MUST report a transaction with child spans (DB read, network, image decode)
3. WHEN flamegraphs are generated THEN RN Performance exporter MUST produce JS render flamegraphs per screen; attached to CI artifacts on main branch
4. WHEN memory usage is monitored THEN scrolling any media-rich list for 60s MUST increase process RSS by ≤50 MB and return within ≤10 MB of baseline after GC; thumbnails MUST be served via expo-image caching/placeholder to avoid decoding full-res on scroll
5. WHEN performance incidents occur THEN each MUST link a Perfetto trace (Android) or Instruments capture (iOS), the Sentry transaction, and the PR that fixed it
