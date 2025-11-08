# Implementation Plan

- [x] 1. Setup Performance Monitoring Infrastructure
  - Install and configure Sentry RN Performance with tracesSampleRate: 0.1 (10% sampling)
  - Install and configure @shopify/react-native-performance for deterministic TTI/TTFD + render spans
  - Enable React Navigation instrumentation for transition spans in release builds
  - Create standardized transaction naming: app.startup, agenda.scroll, navigation.push:<Screen>, sync.pull, sync.push, ai.infer, image.decode
  - Link RN Performance JSON reports into CI artifacts
  - _Requirements: 5.1, 5.2_

- [ ] 2. Enable React Native New Architecture
  - Configure EAS builds to enable Fabric/TurboModules/bridgeless (Expo SDK 53 enables by default)
  - Verify New Architecture enablement in EAS build logs and keep one-line toggle for rollback
  - Test all core app flows under New Architecture on target devices with no NA warnings
  - Document library audit using Expo's NA guide + expo doctor for compatibility checks
  - _Requirements: 3.1, 3.4_

- [ ] 3. Audit and Replace FlatList Components with FlashList v2
  - Identify all FlatList usage across the codebase
  - Create OptimizedFlashList wrapper component with performance monitoring
  - Migrate agenda/calendar list components to FlashList v2
  - Migrate community feed list components to FlashList v2
  - Implement stable keyExtractor functions for all lists
  - Run performance tests on release builds only (dev builds skew FlashList metrics)
  - _Requirements: 1.3, 1.5_

- [x] 4. Implement FlashList v2 Optimization Patterns
  - Create getItemType handlers for heterogeneous list content (v2 does not require item size estimates)
  - Implement React.memo for all list item components ( not sure if we really need to, cause of react compiler)
  - Create ESLint rule that errors on FlatList imports in src/\*\* and CI fails if found
  - Ensure all production lists use FlashList v2 with stable keyExtractor and getItemType for mixed rows
  - _Requirements: 1.3, 1.4_

- [x] 5. Optimize Image Handling in Lists
  - [x] **Server: post creation pipeline** — Update Supabase `create-post` function to upload resized (~1280px) and thumbnail (~200px) variants, compute BlurHash/ThumbHash, capture dimensions/bytes, and persist all new metadata columns. Ensure storage paths are deterministic and old posts degrade gracefully.
  - [x] **Mobile upload service** — Extend community post attachment flow to call the variant generator (reusing `captureAndStore`/`generatePhotoVariants` patterns), upload assets to storage, and send metadata to the server. Guard against large originals and add retryable upload logic.
  - [x] **Metadata propagation** — Update Supabase client queries, Watermelon schema, and community API client to hydrate `media_resized_uri`, `media_thumbnail_uri`, hashes, and dimension fields. Provide fallbacks for legacy rows.
  - [x] **UI integration** — Replace FlashList item images (feed, user posts, moderator views) with `OptimizedImage`, wiring placeholders, recycling keys, and cache policies. Verify no component still imports React Native `Image` inside lists. ✅ Verified: All React Native `Image` imports replaced with expo-image based components. Community feed uses `OptimizedImage` with full metadata support.
  - [x] **Performance enforcement** — Add release-mode Maestro/Perfetto scroll test using seeded 1k-item dataset to confirm ≤50 MB RSS delta, ≤10 MB post-GC, avg FPS ≥58, and 0 blank cells. Capture RN Performance JSON + Perfetto artifacts. ✅ Created: `.maestro/community/scroll-performance.yaml` (30s continuous scroll test), `scripts/ci/performance-validation.js` (budget enforcement), `.github/workflows/performance-tests.yml` (CI integration).
  - [x] **Visual QA** — Document manual checklist for BlurHash/ThumbHash behavior (light/dark modes, slow network) and ensure design review sign-off before closing. ✅ Created: `docs/performance/image-optimization-visual-qa.md` (comprehensive manual testing checklist with 60+ acceptance criteria covering placeholders, dark mode, network conditions, memory, edge cases, and design sign-off).
  - _Requirements: 1.2, 5.4_

- [x] 6. Audit and Optimize Reanimated Worklets
  - Verify Reanimated setup; worklets are short-running, pure, and marked with 'worklet'
  - Create ESLint rules to ban console.log/network IO inside worklets
  - Refactor heavy computations out of worklets using runOnJS for scheduling
  - Implement worklet performance monitoring for input-to-render latency
  - _Requirements: 2.1, 2.2, 2.5_

- [x] 7. Implement Gesture Performance Optimization
  - Optimize pan/scroll/drag gesture handlers for P95 input→render ≤50ms on target devices
  - Ensure all shared values use useSharedValue/useDerivedValue patterns
  - Replace animation polling loops with callback-based completions
  - Add Perfetto FrameTimeline trace collection for gesture performance proof
  - _Requirements: 2.3, 2.4_

- [ ] 8. Create Performance Testing Infrastructure
  - Set up Maestro/Detox scripts for deterministic performance testing
  - Create synthetic data factory for 1k+ items + images and 30s scripted scroll
  - Implement automated scroll performance tests (30-second continuous scroll)
  - Configure one physical Android device for Perfetto trace collection (ground truth)
  - Consider pairing Maestro with Flashlight to automate FPS capture
  - _Requirements: 4.2, 4.4_

- [ ] 9. Implement CI Performance Budgets (CI FAIL if exceeded)
  - Startup TTI: Pixel 6a ≤1.8s, iPhone 12 ≤1.3s
  - Navigation: P95 transition ≤250ms
  - Scroll: P95 frame time ≤16.7ms, dropped frames ≤1%, avg FPS ≥58
  - Sync (500 changes): P95 ≤2.5s on LTE simulation
  - Add CI failure logic when performance budgets are exceeded
  - _Requirements: 4.1, 4.5_

- [ ] 10. Setup Performance Artifact Collection
  - Configure CI to collect RN Performance JSON reports + Sentry trace URLs
  - Implement Perfetto trace collection for Android performance tests
  - Create performance report generation with device/OS/build hash + dataset size metadata
  - Emit Sentry links + RN Performance JSON + Perfetto trace for each test run
  - _Requirements: 4.4, 4.5_

- [ ] 11. Implement Component-Level Performance Testing
  - Integrate Reassure with Jest for component render timing tests
  - Create baseline render timing tests for critical components (Agenda row, Post card)
  - Implement render timing regression detection against locked baselines
  - Add component performance tests to CI pipeline
  - _Requirements: 4.4_

- [ ] 12. Setup Performance Trend Analysis
  - Pin Sentry Performance dashboards for Startup/Navigation/Scroll/Sync metrics
  - Implement 7-day moving average performance trend analysis
  - Gate merges on 7-day moving average delta >10% (triggers investigation)
  - Setup performance metric time series upload to Sentry
  - _Requirements: 4.3, 5.1_

- [ ] 13. Create Local Performance Profiling Tools
  - Implement `pnpm perf:profile` command for local performance profiling
  - Configure release build launching with Sentry tracing enabled
  - Setup RN Performance markers and record Perfetto (Android 12+) traces
  - Create performance profiling output with Sentry links and Perfetto files
  - Add documentation on opening FrameTimeline in Perfetto UI
  - _Requirements: 5.1, 5.5_

- [ ] 14. Implement Memory Management Optimization
  - Add memory usage monitoring during list scrolling scenarios
  - Implement memory leak detection for 60-second scroll tests
  - Create memory budget enforcement (≤50MB RSS increase, ≤10MB post-GC)
  - Setup automated memory profiling in CI pipeline
  - _Requirements: 5.4_

- [ ] 15. Validate Third-Party Library New Architecture Compatibility
  - Audit all third-party dependencies using Expo's NA guide + expo doctor
  - Create compatibility table with upgrade/replacement plans
  - Replace or upgrade incompatible libraries with New Architecture alternatives
  - Document decision log with links to upstream issues/PRs and RN Directory status
  - _Requirements: 3.2, 3.3_

- [ ] 16. Create Performance Monitoring Dashboard Integration
  - Setup React Navigation performance instrumentation in release builds
  - Configure screen mount transaction reporting with child spans
  - Implement flamegraph generation for JS render performance per screen
  - Create performance incident triage playbook with trace links
  - _Requirements: 5.2, 5.3, 5.5_

- [ ] 17. Implement Performance Regression Prevention
  - Hard-fail performance jobs if **DEV** is true or Flipper/Remote Debug is enabled
  - Setup performance test execution validation (release builds only)
  - Attach device/OS/build hash + dataset size to every performance artifact
  - Create performance regression detection and alerting system
  - _Requirements: 1.5, 4.1, 4.3_

## Performance SLAs & Acceptance Criteria

### FlashList v2 Policy

"All production lists use FlashList v2 with stable keyExtractor and getItemType for heterogeneous rows. No FlatList in src/\*\* (ESLint rule + CI check). Perf tests run on release builds only."

### Scroll Performance SLA

"30s continuous scroll over 1,000 items: avg FPS ≥58, P95 frame ≤16.7ms, dropped frames ≤1%, 0 blank cells. Capture RN Performance JSON + Perfetto FrameTimeline; publish as CI artifacts."

### Image Pipeline Standard

"List images use expo-image with disk+memory cache and BlurHash/ThumbHash placeholders; thumbnails only during scroll."

### Gesture Performance SLA

"During pan/drag, P95 input→render ≤50ms (Perfetto trace proof)."

### New Architecture Gate

"Expo SDK 53 build logs confirm Fabric/Turbo/bridgeless. Incompatible libs tracked & replaced."

### Sentry Configuration Standard

"Use tracesSampleRate: 0.1 (or tracesSampler) and enable React Navigation instrumentation for transition spans."
