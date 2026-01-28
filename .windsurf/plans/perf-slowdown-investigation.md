# Perf / Memory Leak Investigation (Slowdown after 2–3 minutes)

This plan outlines how we will reproduce, measure, isolate, and fix the gradual slowdown with minimal-risk, targeted changes.

## Current repro status

- Observed on **dev-client** so far.
- Platform: **iOS device**.
- Repro flow is currently broad ("going through all screens"), not a single stable screen.
- Unknown: remote JS debugging / external debugger attached.
- Symptom becomes noticeable after ~**1 minute** (not immediately on cold start).
- JS FPS can drop even early, and **recovers when you stop interacting**.
- Unknown: whether the symptom is primarily **memory growth** or **JS/UI FPS drop** at idle.
- Observed during **heavy scrolling on Strains screen**: UI FPS stays high while **JS FPS drops to single digits**.

## Latest experiment result

- Auto Sync **OFF** (Settings → Sync):
  - JS FPS still drops heavily.
  - UI FPS initially stayed closer to 60, but after ~1 minute the app still felt laggy.
  - After ~1 minute, **UI FPS also dips (<50) when JS dips**.
  - Interpretation: auto-sync contributes, but **does not fully explain** the recurring slowdown.

## What I already checked (static scan)

- Identified long-lived timers/polling that could accumulate work over time.
- Identified realtime subscription code paths that can trigger periodic invalidations.

### Top suspects (from code)

1. **SyncStatus polling (header)**
   - `src/components/sync/sync-status.tsx` schedules a loop every 5s while the app is active.
   - Each loop calls `getPendingChangesCount()`.
   - `src/lib/sync-engine.ts` implements `getPendingChangesCount()` by running multiple WatermelonDB `fetchCount()` queries across tables.
   - With an existing checkpoint, it runs **2 `fetchCount()` per table** per poll cycle (currently 9 tables → ~18 counts / 5s).
   - If this is shown globally (e.g. `SharedHeader`), it can become a steady background cost.
   - Confirm it is mounted in your build:
     - `SyncStatus` is currently only referenced by `src/components/navigation/shared-header.tsx` (and tests).
     - If you don't see a "Last sync" style row in the UI, this suspect may not apply.

2. **Community realtime + polling/invalidations**
   - `src/lib/community/use-community-feed-realtime.ts` + `src/lib/community/realtime-manager.ts` can:
     - start intervals (polling fallback / reconciliation)
     - invalidate multiple React Query keys
     - emit frequent `console.log()` in interval paths (dev perf hit)
   - Global wiring: `useCommunitySync()` is called in `src/app/(app)/_layout.tsx`.

3. **Strains list scroll jank (JS thread bottleneck)**
   - Symptom: UI remains responsive while **JS FPS drops hard** during heavy scroll.
   - Code path: `src/app/(app)/strains/index.tsx` → `src/components/strains/strains-list-with-cache.tsx`.
   - Candidate causes:
     - expensive `renderItem` / heavy `StrainCard` rendering during rapid cell churn
     - aggressive list config (e.g. large `drawDistance`) causing too much work off-screen
     - image decode/cache pressure while scrolling through many image cards
     - potential `runOnJS` usage from scroll performance monitoring (`src/lib/strains/use-list-scrolling.ts`)
       - `useAnimatedScrollHandler` docs support `onScroll`, `onBeginDrag`, `onEndDrag`, `onMomentumBegin`, `onMomentumEnd` (no `onEnd`)
       - any `runOnJS(...)` called too frequently during scroll can tank JS FPS

4. **Other periodic polling**
   - `src/lib/hooks/use-root-startup.ts` starts a 500ms UI responsiveness monitor (lightweight) and 60s timezone check.
   - `src/lib/community/use-community-health.ts` has a 30s polling interval (depends on usage).
   - `src/components/moderation/monitoring-dashboard.tsx` has 30s polling (likely not on normal user path).
   - Consent-gated: `src/lib/perf/ui-responsiveness-monitor.ts` runs every 500ms when **analytics consent** is enabled.

## Milestones

1. **Repro + baseline measurement (no code changes)**
   - Confirm environment:
     - platform (Android/iOS)
     - dev vs release/dev-client
     - remote JS debugging / JS debugger attached on/off
   - Measure:
     - Expo Dev Menu “Performance Monitor” (JS FPS, UI FPS, memory trend)
     - whether memory grows steadily vs FPS drops without memory growth
   - Tighten repro:
     - **Idle test**: stay on a single screen for 3–5 minutes.
     - **Navigation test**: do your usual "go through all screens" flow for 3–5 minutes.
     - Note which one reproduces first (this distinguishes global background work vs a specific screen).
     - **Strains scroll test**: stay on Strains and do 60–90s of continuous fast scrolling.
       - record UI FPS, JS FPS, and memory before/after
       - note whether JS FPS recovers quickly after you stop scrolling
   - Sync-specific isolate (no code changes):
     - Go to **Settings → Sync** and toggle **Auto Sync** OFF.
     - Fully close and reopen the app.
     - Repeat the idle + navigation tests.
     - If lag improves materially, the top suspect becomes the auto-sync pipeline.
     - Additional isolate:
       - Toggle **Background Sync** OFF as well.
       - This should remove any remaining scheduled sync work (even if OS timing makes it unlikely to run immediately).
   - Measurement hygiene (dev-client):
     - For more realistic FPS, run Metro with dev features disabled:
       - `pnpm start -- --dev-client --no-dev --minify`
     - Analytics isolate (no code changes):
       - Go to **Settings → Privacy** and toggle **Analytics** OFF.
       - This disables several consent-gated trackers started in `use-root-startup.ts`.
       - Re-test for 2–3 minutes and note whether the "~1 minute" lag changes.

2. **Isolate via controlled toggles (minimal changes, one at a time)**
   - Temporarily disable one suspect at a time to identify the main contributor:
     - `SyncStatus` polling
     - community realtime subscription
     - background sync triggers
   - Run each variant for ~5–10 minutes and record:
     - memory delta
     - JS/UI FPS trend

   - Next isolate checks to run before touching code:
     - Does the FPS dip have a **~5s cadence**? (matches `SyncStatus` poll interval)
     - Does the slowdown happen on **auth screens (signed out)**?
       - If not, it strongly suggests one of the signed-in-only background features (`setupSyncTriggers`, `SharedHeader`/`SyncStatus`, community realtime)

3. **Implement targeted fix (after you confirm the plan)**
   - If **SyncStatus polling** is the culprit:
     - reduce or eliminate DB polling (prefer event-driven updates / cached counts)
     - ensure any remaining polling is infrequent and stops when not visible
   - If **community realtime** is the culprit:
     - gate/disable interval `console.log()` (especially inside 1s/30s loops)
     - ensure timers/subscriptions only run while the relevant screen is focused
     - reduce invalidation frequency / scope

4. **Verify + guardrails**
   - Verify on device for >10 minutes after fixes.
   - Add/enable lightweight dev-only monitoring using existing utilities:
     - `src/lib/hooks/use-memory-monitor.ts`
     - `src/lib/perf/ui-responsiveness-monitor.ts`

## Open questions

- Platform/device: Android or iOS? Emulator/simulator or physical device?
- Can you confirm whether any JS debugger is attached (remote debugging / RN Debugger / Flipper tooling)?
- During the slowdown, what happens to Perf Monitor:
  - memory trend
  - JS FPS
  - UI FPS
- Does the **idle test** also slow down, or only the **navigation test**?
- Does the slowdown start around a steady interval (e.g. ~60 seconds), or is it random?

## Strong hypothesis to validate (based on code)

- Auto-sync is wired up at sign-in via `setupSyncTriggers()` (`src/lib/hooks/use-root-startup.ts`).
- The trigger enforces `minAutoSyncIntervalMs = 60_000` (`src/lib/sync/sync-triggers.ts`), which matches "feels laggy after ~1 minute".
- A sync run (`performSync`) includes:
  - `getPendingChangesCount()` (multiple WatermelonDB `fetchCount()` calls)
  - `runSyncWithRetry(...)`
  - follow-up work like upload queue processing and plant photo sync
