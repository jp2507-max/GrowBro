# Deeper Sentry Integration (Expo 54 + Expo Router)

This plan extends GrowBro’s existing Sentry setup to deliver actionable **error + performance insights** (navigation tracing, profiling, logs, replay, release health) while keeping privacy/consent and overhead under control.

## Current state (already in repo)

- **SDK init**: `src/lib/performance/sentry-integration.ts` calls `Sentry.init()` behind `crashReporting` consent.
- **Performance toggles**: `tracesSampleRate`, `profilesSampleRate`, `enableAppStartTracking`, `enableStallTracking`, `enableNativeFramesTracking`.
- **Replay + feedback**: gated by `Env.SENTRY_ENABLE_REPLAY` and `sessionReplay` consent (`mobileReplayIntegration()` + `feedbackIntegration()`).
- **PII scrubbing**: `beforeSend` + `beforeBreadcrumb` scrubbing in `src/lib/sentry-utils.ts`.
- **Expo build tooling**:
  - `app.config.js` includes `@sentry/react-native/expo` plugin.
  - `metro.config.js` wraps config with `getSentryExpoConfig()`.
  - CI guard: `pnpm run observability:sentry:validate`.
- **Error boundary wrapper**: `src/app/_layout.tsx` exports `Sentry.wrap(RootLayout)` when Sentry is initialized.

## What’s possible (capabilities to target)

- **Crash + error monitoring**
  - JS errors, unhandled promise rejections, native crashes
  - Breadcrumbs + contexts (already scrubbed)
  - User feedback (already integrated)
- **Performance Monitoring (Tracing)**
  - Navigation transactions (Expo Router / React Navigation)
  - App start spans, frozen/stall detection, slow frames
  - Custom spans/transactions for expensive operations (sync, AI inference, DB work)
  - Trace propagation for server-side correlation (optional)
- **Profiling**
  - Function-level performance (Hermes + native profilers), tied to transactions via `profilesSampleRate`
- **Session Replay**
  - Visual reproduction around errors/slow interactions with masking controls
- **Release Health**
  - Crash-free sessions/users by release + environment
- **Logs (Structured Logs)**
  - Send log entries (incl. optional console capture) and correlate them with issues/traces

## Plan (phased)

### Phase 1 — Expo Router navigation tracing (highest ROI)

**Goal**: get clean navigation transactions + “time to initial display” (TTID) spans.

- Wire Expo Router navigation container registration per Sentry docs.
- Reuse existing repo utilities:
  - `createNavigationInstrumentation()` and `registerNavigationContainer()` (`src/lib/performance/navigation-instrumentation.ts`).
- Implementation shape (conceptually):
  - Use `useNavigationContainerRef()` from `expo-router`.
  - On mount, call `registerNavigationContainer(ref)` (or directly `navigationIntegration.registerNavigationContainer(ref)`).
- Align options with docs:
  - Consider `enableTimeToInitialDisplay: !isRunningInExpoGo()` to avoid noisy/unsupported measurements.
  - Consider tuning `routeChangeTimeoutMs` and `ignoreEmptyBackNavigationTransactions` to reduce clutter.

**Why this matters**: this unlocks the most useful “mobile performance insights” in Sentry: route-to-route performance, TTID, and navigation-related error context.

### Phase 2 — Sampling strategy (cost vs. insight)

**Goal**: keep performance data useful without flooding Sentry.

- Move from static `tracesSampleRate` to a `tracesSampler` function if you want fine control.
  - Example policy:
    - Always sample critical flows: auth, onboarding, sync, camera/AI.
    - Lower sample rate for routine navigations.
- Recommended per-environment sampling targets (start here, then tune based on volume/cost):
  - Development: `tracesSampleRate=1.0` (debug everything)
  - Staging: `tracesSampleRate=0.25` (enough data to validate UX + performance)
  - Production: `tracesSampleRate=0.10` (good default for “performance insights” without excessive volume)

### Phase 3 — Profiling (actionable “why is it slow”)

**Goal**: enable Profiling so slow transactions can be explained down to function level.

- Recommended profiling defaults (profiles are sampled _relative_ to traced transactions):
  - Development: `profilesSampleRate=1.0`
  - Staging: `profilesSampleRate=0.25`
  - Production: `profilesSampleRate=0.10` (effective rate: `traces * profiles` => `0.10 * 0.10 = 1%` of all app navigations/transactions)
- Keep `profilesSampleRate` (already set). Confirm whether you also want:
  - `Sentry.hermesProfilingIntegration()` in `integrations` for configuration control.
  - `platformProfilers: false` if you only want Hermes JS profiles (lower overhead).
- Add a QA loop:
  - Verify profiles appear in Sentry for the sampled transactions.

### Phase 4 — Session Replay (debugging multiplier) with privacy hardening

**Goal**: enable replay where it’s safe, and guarantee no PII leakage.

- Keep replay gated by:
  - `Env.SENTRY_ENABLE_REPLAY`
  - `sessionReplay` consent
  - environment (recommend: staging first)
- Decision: **disable Session Replay on iOS** (per Sentry’s current guidance around Apple “Liquid Glass” masking).
  - Recommended rollout:
    - Staging (Android only): `replaysSessionSampleRate=0.10`, `replaysOnErrorSampleRate=1.0`
    - Production (Android only): start with `replaysSessionSampleRate=0.00`, `replaysOnErrorSampleRate=1.0`, then consider `replaysSessionSampleRate=0.01` after validating privacy + overhead
- Add explicit masking on sensitive screens:
  - Wrap login/sign-up and any user-entered data areas with `<Sentry.Mask>`.
  - Only use `<Sentry.Unmask>` in strictly safe UI.
- Overhead tuning:
  - Keep `replaysSessionSampleRate` low in production.
  - Keep `replaysOnErrorSampleRate` high (often 1.0) for max value.

### Phase 5 — Logs (Structured Logs) + noise filtering

**Goal**: correlate “what happened” with errors and traces.

- Enable logs via `enableLogs: true` (Sentry RN >= 7.0.0; you’re on `@sentry/react-native@^7.2.0`).
- Add `beforeSendLog` to scrub PII similarly to `beforeSendHook`.
- Recommended rollout:
  - Staging/dev: enable logs to validate usefulness and define filters
  - Production: enable logs only if you commit to filtering
    - Drop most console auto-capture (`auto.log.console`) or keep only `warn`/`error`
    - Consider filtering `info` entirely to control volume

### Phase 6 — Releases / symbols / build pipeline reliability

**Goal**: ensure issues + performance are correctly attributed to release builds and remain debuggable.

- Confirm release + environment strategy:
  - Release Health needs a consistent `release`.
  - Consider setting a consistent `dist` (native build number / versionCode) for correctness.
- Confirm build-time uploads:
  - Ensure EAS/CI has `SENTRY_AUTH_TOKEN` available (as a secret), plus `SENTRY_ORG` + `SENTRY_PROJECT`.
  - Keep `metro.config.js` using `getSentryExpoConfig()` (Debug IDs/source maps).
- Add a “release checklist” step in CI:
  - Validate Sentry config.
  - Verify the Sentry project receives a test event tagged with the expected release/env.

## Verification checklist (local + staging)

- Run:
  - `pnpm run observability:sentry:validate`
  - `pnpm run start` (or a dev client build) and navigate across key screens
- In Sentry UI verify:
  - Performance -> transactions exist for navigation (and TTID spans exist)
  - Profiling -> profiles appear for sampled transactions
  - Replays -> replay_id exists for error sessions (if enabled)
  - Releases -> crash-free sessions/users show up
  - Logs -> log events are present and scrubbed (if enabled)

## Decisions / defaults (ready for implementation)

- Session Replay: **iOS disabled**, Android enabled only with consent + env flags
- Tracing:
  - Development: `1.0`
  - Staging: `0.25`
  - Production: `0.10`
- Profiling (relative to tracing):
  - Development: `1.0`
  - Staging: `0.25`
  - Production: `0.10`
- Logs:
  - Staging/dev: enable
  - Production: optional; if enabled, must filter aggressively
- PII:
  - Keep `sendDefaultPii=false` (recommended); rely on existing scrubbing + explicit consent model
