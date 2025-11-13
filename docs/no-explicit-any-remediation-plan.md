# Explicit `any` Remediation Plan

## Lint Status

- Command: `pnpm lint`
- Result: ❌ blocked (request to `https://registry.npmjs.org/pnpm` failed with `getaddrinfo EAI_AGAIN`)
- Next step: rerun once network access is allowed so ESLint can install the pinned `pnpm@10.20.0` shim and produce the full rule violation list.

## Hotspot Snapshot (via `rg -n '\bany\b' src`)

| Tier        | Area                         | Approx. hits | Representative files / notes                                                                  |
| ----------- | ---------------------------- | ------------ | --------------------------------------------------------------------------------------------- |
| 🔥 Critical | Core schedulers & sync       | 221          | `src/lib/task-manager.ts (128)`, `src/lib/sync-engine.ts (93)`                                |
| 🔥 Critical | Notifications system         | 119          | `src/lib/notifications/push-service.ts`, `notification-manager.ts`, `notification-storage.ts` |
| 🔥 Critical | Moderation & compliance      | 167          | `src/lib/moderation/*.ts`, `age-verification-service.ts`, `moderation-service.ts`             |
| ⚠️ High     | Playbooks & AI adjustments   | 93           | `src/lib/playbooks/ai-adjustment-service.ts`, related tests                                   |
| ⚠️ High     | Nutrient & inventory engines | 102          | `src/lib/nutrient-engine/services/*.ts`, `inventory` services/tests                           |
| ⚠️ High     | Upload/support queues        | 65           | `src/lib/uploads/queue.ts`, `support/ticket-queue.ts`                                         |
| ⚖️ Medium   | API clients                  | 71           | `src/api/{community,strains,auth}/client.ts`                                                  |
| ⚖️ Medium   | UI components                | 87           | `src/components/calendar/drag-drop-provider.tsx`, playbook/harvest modals                     |
| 🧪 Low      | Tests & fixtures             | ~420         | `src/lib/__tests__`, `app/settings/*.test.tsx`, `translations/en.json` etc.                   |

_(Counts are approximate and derived from ripgrep to unblock planning while lint is unavailable.)_

## Prioritized Remediation Strategy

### Tier 1 — Core Engines & Compliance (Blockers before release)

1. **Task / Sync Layer**
   - Introduce typed task payloads & queue entries (`TaskPayload`, `SyncJob`, discriminated unions).
   - Refactor scheduler helpers (`scheduleTask`, `processJob`) to be generic over these unions rather than `any`.
2. **Moderation & Compliance Services**
   - Define shared DTO types for moderation requests/responses (age verification, content reports).
   - Replace `any` in service gateways with typed Supabase responses and schema-derived enums.
3. **Notification Stack**
   - Create `PushNotificationPayload`, `ReminderConfig`, and storage record types.
   - Ensure MMKV serialization/deserialization helpers use those interfaces instead of `any`.
4. **Re-run lint + type-check** to confirm Tier 1 areas are clean before moving down the stack.

### Tier 2 — Growth Surfaces (High impact but isolated)

5. **Playbooks / AI Adjustments**
   - Model AI adjustment objects (inputs, scores, localized copy) with Zod schemas shared between client/tests.
   - Update React components consuming them to leverage the new types and avoid `any` props.
6. **Nutrient / Inventory Engines**
   - Add typed matrices for nutrient schedules, reservoir readings, and inventory deductions.
   - Replace arithmetic helpers currently accepting `any` with typed generics + unit tests.
7. **Upload / Support Queues**
   - Define queue item interfaces for uploads/support tickets; tighten persistence helpers accordingly.
8. **Validation checkpoint** — run lint + targeted Jest suites covering these modules.

### Tier 3 — Surface APIs & UI (Medium priority)

9. **API Clients (`src/api`)**
   - Adopt generated types or hand-written interfaces for Supabase/REST responses.
   - Ensure hooks/components use typed results instead of casting to `any`.
10. **UI Components & Modals**
    - Type drag/drop contexts, modal params, and Nativewind class helpers to eliminate UI-level `any`.
11. **Shared Types (`src/types`, `reanimated-compat.d.ts`)**
    - Replace placeholder `any` exports with stricter union types or generics.

### Tier 4 — Tests, Fixtures, and Data (Deferred)

12. **Tests & JSON fixtures**
    - Convert helper mocks to typed factories once production code is clean.
    - Keep `any` usage temporarily where it simplifies exhaustive mocking, but track remaining instances.
13. **Documentation & Tracking**
    - Update this plan with actual lint counts after each tier and check off completed directories.

## Suggested Workflow

1. Ensure offline-compatible linting by caching `pnpm@10.20.0` or temporarily allowing network access.
2. Work tier-by-tier; after each tier, run `pnpm lint && pnpm type-check` plus relevant Jest suites.
3. Maintain a running tally (in this file or issues) of remaining `no-explicit-any` suppressions to measure progress.
4. Block release until Tier 1 is complete; Tier 2 should be done before public launch; Tier 3/4 can follow via patches.
