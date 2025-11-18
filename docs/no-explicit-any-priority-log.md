# `no-explicit-any` Priority Log

This file groups every ESLint `@typescript-eslint/no-explicit-any` warning from `eslint-report.txt` by remediation priority so the Codex Cloud agent can work top-down.

## High Priority (Tier 1 & 2 — Blockers before release) _(stop when 99 files changed in Git to keep PR reviewable)_

Total warnings: **823**

| File                                                               | Count |
| ------------------------------------------------------------------ | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/task-manager.ts`                                          |     0 |
| `src/lib/sync-engine.ts`                                           |     0 |
| `src/lib/template-manager.ts`                                      |     0 |
| `src/lib/uploads/queue.ts`                                         |     0 |
| `src/lib/notifications/push-service.ts`                            |     0 |
| `src/lib/support/ticket-queue.ts`                                  |     0 |
| `src/lib/sentry-utils.ts`                                          |     0 | ✅ Already clean                                                                                                                                                                                                                                                                                                                                           |
| `src/lib/moderation/age-verification-service.ts`                   |     0 | ✅ Already clean                                                                                                                                                                                                                                                                                                                                           |
| `src/lib/notifications/notification-manager.ts`                    |     0 | ✅ Already clean                                                                                                                                                                                                                                                                                                                                           |
| `src/lib/moderation/moderation-service.ts`                         |     0 | ✅ Replaced query builder `any` with type alias, typed DB records                                                                                                                                                                                                                                                                                          |
| `src/lib/playbooks/ai-adjustment-service.ts`                       |     0 | ✅ Added WatermelonDB model types, @ts-expect-error for field assignments (WatermelonDB limitation)                                                                                                                                                                                                                                                        |
| `src/lib/compliance/onboarding-state.ts`                           |     0 | ✅ Replaced Zustand `any` with StoreApi types                                                                                                                                                                                                                                                                                                              |
| `src/lib/assessment/assessment-retention-service.ts`               |     0 | ✅ Replaced `any[]` with AssessmentModel[], added SafeFileSystem interface for FileSystem types                                                                                                                                                                                                                                                            |
| `src/lib/notifications/notification-storage.ts`                    |     0 | ✅ Replaced collection `any` casts with Collection<NotificationModel>, one eslint-disable for clauses array (WatermelonDB limitation)                                                                                                                                                                                                                      |
| `src/lib/nutrient-engine/services/calibration-reminder.ts`         |     0 | ✅ Replaced `Record<string, any>` with `Record<string, unknown>`, added proper type narrowing for notification triggers                                                                                                                                                                                                                                    |
| `src/lib/compliance/activation-state.ts`                           |     0 | ✅ Replaced Zustand `any` with StoreApi types (same pattern as onboarding-state.ts)                                                                                                                                                                                                                                                                        |
| `src/lib/compliance/legal-acceptances.ts`                          |     0 | ✅ Replaced Zustand `any` with StoreApi types                                                                                                                                                                                                                                                                                                              |
| `src/lib/harvest/harvest-notification-service.ts`                  |     0 | ✅ Removed unnecessary `any` casts for HarvestModel fields, typed normalizeTriggerDate with proper type guards                                                                                                                                                                                                                                             |
| `src/lib/moderation/transparency-service.ts`                       |     0 | ✅ Created RedactedDbRecord type, replaced all `any[]` with proper types                                                                                                                                                                                                                                                                                   |
| `src/lib/compliance/age-gate.ts`                                   |     0 | ✅ Replaced Zustand `any` with StoreApi types                                                                                                                                                                                                                                                                                                              |
| `src/lib/moderation/content-age-gating.ts`                         |     0 | ✅ Created DbContentRestriction and DbUserAgeStatus types, typed constructor and all database operations                                                                                                                                                                                                                                                   |
| `src/lib/notifications/push-receiver-service.ts`                   |     0 | ✅ Already clean - Replaced all `any` types with proper Expo Notifications types: `Notifications.Notification`, `Notifications.NotificationResponse`, `EventSubscription` for subscriptions, and `Record<string, unknown>` for notification data extraction. Updated `NotificationBehavior` to include `shouldShowBanner` and `shouldShowList` properties. |
| `src/lib/assessment/assessment-sentry.ts`                          |     0 | ✅ Already clean - Uses proper types from assessment types, no `any` usage found                                                                                                                                                                                                                                                                           |
| `src/lib/assessment/conflict-detection.ts`                         |     0 | ✅ Already clean - Uses proper types from assessment types, no `any` usage found                                                                                                                                                                                                                                                                           |
| `src/lib/harvest/harvest-error-handler.ts`                         |     0 | ✅ Already clean - Uses proper types from harvest types, no `any` usage found                                                                                                                                                                                                                                                                              |
| `src/lib/nutrient-engine/hooks/use-alert-evaluation.ts`            |     0 | ✅ Already clean - Replaced all `any` types with proper domain types from nutrient-engine/types. Changed `modelToAlert` return type from `any` to `DeviationAlert`. Replaced `as any` casts with specific type assertions: `AlertType`, `AlertSeverity`, `PpmScale`, `QualityFlag[]`, and `GrowingMedium`. Added necessary type imports.                   |
| `src/lib/nutrient-engine/services/reservoir-event-service.ts`      |     0 | ✅ Already clean - Replaced all `any` types with proper types. Changed `create` callback parameter from `any` to `ReservoirEventModel`. Replaced subscription variables with `{ unsubscribe: () => void }                                                                                                                                                  | undefined`(compatible with both rxjs and WatermelonDB). Typed observable callbacks with`ReservoirEventModel[]`and error handlers with`unknown`. |
| `src/lib/nutrient-engine/services/reservoir-service.ts`            |     0 | ✅ Replaced WatermelonDB callback `any` with ReservoirModel, subscription with `{ unsubscribe: () => void }`, observable callbacks with proper types                                                                                                                                                                                                       |
| `src/lib/nutrient-engine/services/source-water-profile-service.ts` |     0 | ✅ Replaced WatermelonDB callback `any` with SourceWaterProfileModel, subscription with `{ unsubscribe: () => void }`, observable callbacks with proper types                                                                                                                                                                                              |
| `src/lib/privacy/strip-pii.ts`                                     |     0 | ✅ Replaced `any` with `Record<string, unknown>` and proper type guards                                                                                                                                                                                                                                                                                    |
| `src/lib/moderation/content-snapshot.ts`                           |     0 | ✅ Replaced `any` with `unknown` for generic content data                                                                                                                                                                                                                                                                                                  |
| `src/lib/moderation/moderation-metrics-queries.ts`                 |     0 | ✅ Created DbAppealRecord and DbODSEscalationRecord types                                                                                                                                                                                                                                                                                                  |
| `src/lib/notifications/android-channels.ts`                        |     0 | ✅ Created AndroidNotificationsExtended type for Android-specific APIs                                                                                                                                                                                                                                                                                     |
| `src/lib/assessment/assessment-analytics-feedback-summary.ts`      |     0 | ✅ Created proper types for SQLite queries and database adapter                                                                                                                                                                                                                                                                                            |
| `src/lib/assessment/assessment-analytics-summary.ts`               |     0 | ✅ Created proper types for SQLite queries and database adapter                                                                                                                                                                                                                                                                                            |
| `src/lib/moderation/dsa-transparency-client.ts`                    |     0 | ✅ Created DSAApiError interface, typed parseSubmissionResponse with unknown + type guards, typed isPermanentError parameter                                                                                                                                                                                                                               |
| `src/lib/moderation/monitoring-service.ts`                         |     0 | ✅ Replaced `any` with proper metric types (PerformanceMetrics, ErrorMetrics, etc.) and typed event arrays                                                                                                                                                                                                                                                 |
| `src/lib/playbooks/community-realtime-service.ts`                  |     0 | ✅ Created CommunityPlaybookTemplate, TemplateRating, TemplateComment types, added type assertions for Supabase realtime payloads                                                                                                                                                                                                                          |
| `src/lib/privacy/sdk-gate.ts`                                      |     0 | ✅ Replaced `any` with proper fetch API types (RequestInfo                                                                                                                                                                                                                                                                                                 | URL, RequestInit), added proper URL extraction logic                                                                                            |
| `src/lib/sync/sync-worker.ts`                                      |     0 | ✅ Replaced `any` with proper types: unknown for migration, SyncPushPayload['changes'], Record<string, unknown> for conflict resolver                                                                                                                                                                                                                      |
| `src/lib/sync/types.ts`                                            |     0 | ✅ Replaced all `any` with `unknown` for dynamic database record fields                                                                                                                                                                                                                                                                                    |
| `src/lib/compliance/regional-compliance.ts`                        |     0 | ✅ Replaced Zustand `any` with StoreApi types                                                                                                                                                                                                                                                                                                              |
| `src/lib/inventory/undo-service.ts`                                |     0 | ✅ Created RawRecordWithDelete type for WatermelonDB soft-delete checks                                                                                                                                                                                                                                                                                    |
| `src/lib/moderation/repeat-offender-service.ts`                    |     0 | ✅ Created DbRepeatOffenderRecord type for database operations                                                                                                                                                                                                                                                                                             |
| `src/lib/notifications/grouping-service.ts`                        |     0 | ✅ Created ImmediateTrigger type for notification triggers                                                                                                                                                                                                                                                                                                 |
| `src/lib/playbooks/template-saver.ts`                              |     0 | ✅ Created PlaybookRawRecord type for template metadata fields                                                                                                                                                                                                                                                                                             |
| `src/lib/sync/network-manager.ts`                                  |     0 | ✅ Replaced all `any` with NetInfoState type from @react-native-community/netinfo                                                                                                                                                                                                                                                                          |
| `src/lib/sync/sync-manager.ts`                                     |     0 | ✅ Replaced all `any` with WatermelonDB sync types (SyncPullArgs, SyncPullResult, SyncPushArgs, SyncDatabaseChangeSet)                                                                                                                                                                                                                                     |
| `src/lib/uploads/harvest-photo-cleanup.ts`                         |     0 | ✅ Replaced all `any` with HarvestModel type, accessed photos field directly from model                                                                                                                                                                                                                                                                    |
| `src/lib/assessment/conflict-strategies.ts`                        |     0 | ✅ Replaced `any` with `Record<string, unknown>` in generic constraints                                                                                                                                                                                                                                                                                    |
| `src/lib/assessment/sync-utils.ts`                                 |     0 | ✅ Replaced `any` with `Record<string, unknown>` in generic constraint and type assertions                                                                                                                                                                                                                                                                 |
| `src/lib/moderation/appeals-service.ts`                            |     0 | ✅ Replaced `any` with `Appeal` type from moderation types                                                                                                                                                                                                                                                                                                 |
| `src/lib/moderation/config/moderation-config.ts`                   |     0 | ✅ Replaced `any` with `Record<string, unknown>` in deepMerge function                                                                                                                                                                                                                                                                                     |
| `src/lib/moderation/error-classification.ts`                       |     0 | ✅ Replaced `any` with `Record<string, unknown>` in interfaces and added type guards for error extraction                                                                                                                                                                                                                                                  |
| `src/lib/playbooks/schedule-shifter.ts`                            |     0 | ✅ Replaced `any` with proper type guards for metadata access and ScheduleShiftPriorValues type                                                                                                                                                                                                                                                            |
| `src/lib/playbooks/task-customization.ts`                          |     0 | ✅ Removed `as any` casts - PlaybookTaskMetadata is compatible with TaskMetadata                                                                                                                                                                                                                                                                           |
| `src/lib/playbooks/template-adoption-service.ts`                   |     0 | ✅ Replaced `any[]` with PlaybookStep[] and TemplateComment[], added proper DB row mapping                                                                                                                                                                                                                                                                 |
| `src/lib/playbooks/use-ai-adjustments.ts`                          |     0 | ✅ Replaced `any` with AnalyticsClient type for analytics parameters                                                                                                                                                                                                                                                                                       |
| `src/lib/privacy/deletion-adapter-supabase.ts`                     |     0 | ✅ Created StorageFileObject interface, removed `as any` casts                                                                                                                                                                                                                                                                                             |
| `src/lib/privacy/deletion-adapter.ts`                              |     0 | ✅ Created GlobalWithAdapter interface for type-safe globalThis access                                                                                                                                                                                                                                                                                     |
| `src/lib/support/help-article-cache.ts`                            |     0 | ✅ Replaced `any` with HelpArticleCacheModel type assertions in WatermelonDB callbacks                                                                                                                                                                                                                                                                     |
| `src/lib/assessment/conflict-types.ts`                             |     0 | ✅ Replaced `any` with `Record<string, unknown>` as default generic type                                                                                                                                                                                                                                                                                   |
| `src/lib/assessment/model-remote-config.ts`                        |     0 | ✅ Created error type with context.status and status fields for Supabase error handling                                                                                                                                                                                                                                                                    |
| `src/lib/harvest/harvest-sync-error-handler.ts`                    |     0 | ✅ Replaced translation function `any` with `Record<string, unknown>`, removed `as any` cast for HarvestAuditAction                                                                                                                                                                                                                                        |
| `src/lib/inventory/cost-analysis-service.ts`                       |     0 | ✅ Replaced `any[]` with `Q.Clause[]` for WatermelonDB query conditions                                                                                                                                                                                                                                                                                    |
| `src/lib/inventory/csv-import-service.ts`                          |     0 | ✅ Replaced `any` with proper WatermelonDB Collection type for InventoryMovementModel                                                                                                                                                                                                                                                                      |
| `src/lib/inventory/movement-service.ts`                            |     0 | ✅ Replaced `any` with proper WatermelonDB Collection type for InventoryMovementModel in helper functions                                                                                                                                                                                                                                                  |
| `src/lib/inventory/use-inventory-item-detail.ts`                   |     0 | ✅ Replaced `any` with InventoryCategory type assertion, removed unnecessary cast for deletedAt                                                                                                                                                                                                                                                            |
| `src/lib/moderation/sor-submission-orchestrator.ts`                |     0 | ✅ Replaced `any` with RedactedSoR type for redacted Statement of Reasons parameters                                                                                                                                                                                                                                                                       |
| `src/lib/moderation/trusted-flagger-analytics.ts`                  |     0 | ✅ Created ReportWithDecision and RawFlaggerData types for Supabase query results                                                                                                                                                                                                                                                                          |
| `src/lib/notifications/ios-categories.ts`                          |     0 | ✅ Created NotificationsWithIOS type extension for iOS-specific notification API                                                                                                                                                                                                                                                                           |
| `src/lib/notifications/local-service.ts`                           |     0 | ✅ Created AndroidTrigger and trigger type guards for notification trigger types                                                                                                                                                                                                                                                                           |
| `src/lib/notifications/use-notification-preferences.ts`            |     0 | ✅ Replaced `any` with type assertions in WatermelonDB callbacks (NotificationPreferenceModel), used `unknown` cast for dynamic property access                                                                                                                                                                                                            |
| `src/lib/nutrient-engine/services/calibration-service.ts`          |     0 | ✅ Replaced `any` return types with `Observable<CalibrationModel[]>` for observe() methods, imported Observable from WatermelonDB utils                                                                                                                                                                                                                    |
| `src/lib/playbooks/analytics/example-usage.ts`                     |     0 | ✅ Replaced `any` with `Record<string, unknown>` for unused version parameters in example code                                                                                                                                                                                                                                                             |
| `src/lib/playbooks/template-sharing-service.ts`                    |     0 | ✅ Replaced `any[]` with `PlaybookStep[]` for steps, created DbTemplateRow interface for database row mapping                                                                                                                                                                                                                                              |
| `src/lib/sync/preferences.ts`                                      |     0 | ✅ Replaced `any` with `unknown` in sanitization helper functions for type-safe input validation                                                                                                                                                                                                                                                           |
| `src/lib/assessment/calibration-remote-config.ts`                  |     0 | ✅ Replaced `any` with proper error type structure for Supabase edge function error context                                                                                                                                                                                                                                                                |
| `src/lib/assessment/conflict-resolver.ts`                          |     0 | ✅ Replaced `any` with `unknown` in generic constraint to match conflict-types pattern                                                                                                                                                                                                                                                                     |
| `src/lib/inventory/deduction-service.ts`                           |     0 | ✅ Already clean - no `any` usage found                                                                                                                                                                                                                                                                                                                    |
| `src/lib/inventory/use-consumption-analytics.ts`                   |     0 | ✅ Replaced `any` with Database type for database parameter                                                                                                                                                                                                                                                                                                |
| `src/lib/inventory/use-inventory-items.ts`                         |     0 | ✅ Typed collection with InventoryItemModel, cast category to InventoryCategory                                                                                                                                                                                                                                                                            |
| `src/lib/moderation/account-restoration-service.ts`                |     0 | ✅ Created SuspensionRecordWithReversal type, typed suspension parameter in map                                                                                                                                                                                                                                                                            |
| `src/lib/moderation/audit-retention-manager.ts`                    |     0 | ✅ Replaced metadata `any` with `Record<string, unknown>`                                                                                                                                                                                                                                                                                                  |
| `src/lib/moderation/audit-service.ts`                              |     0 | ✅ Created DbAuditEventRow interface, typed mapToAuditEvent parameter                                                                                                                                                                                                                                                                                      |
| `src/lib/moderation/community-integration.ts`                      |     0 | ✅ Replaced updates `Record<string, any>` with `Record<string, string                                                                                                                                                                                                                                                                                      | null>`                                                                                                                                          |
| `src/lib/moderation/conflict-of-interest.ts`                       |     0 | ✅ Replaced decision `any` with type assertion `{ id: string }[]`                                                                                                                                                                                                                                                                                          |
| `src/lib/moderation/graceful-degradation.ts`                       |     0 | ✅ Replaced fallbackImplementation `Promise<any>` with `Promise<unknown>`                                                                                                                                                                                                                                                                                  |
| `src/lib/moderation/migrations/migration-manager.ts`               |     0 | ✅ Created DbMigrationRecord interface for database record mapping                                                                                                                                                                                                                                                                                         |
| `src/lib/moderation/moderation-metrics-types.ts`                   |     0 | ✅ Replaced metadata `Record<string, any>` with `Record<string, unknown>`                                                                                                                                                                                                                                                                                  |
| `src/lib/moderation/moderation-notification-service.ts`            |     0 | ✅ Replaced error `any` with `unknown`, added Error type guard                                                                                                                                                                                                                                                                                             |
| `src/lib/moderation/notification-integration.ts`                   |     0 | ✅ Replaced error `any` with `unknown`, added Error type guards for message and stack                                                                                                                                                                                                                                                                      |
| `src/lib/moderation/pii-scrubber.ts`                               |     0 | ✅ Replaced `as any` with `as unknown as Record<string, unknown>` for dynamic field validation                                                                                                                                                                                                                                                             |
| `src/lib/moderation/sor-export-queue.ts`                           |     0 | ✅ Replaced `any` with typed interface `{ status: SoRExportStatus }` for database row                                                                                                                                                                                                                                                                      |
| `src/lib/moderation/trusted-flagger-review.ts`                     |     0 | ✅ Created DbTrustedFlaggerRow interface, added type assertions for ContactInfo, TrustedFlaggerStatus, QualityMetrics                                                                                                                                                                                                                                      |
| `src/lib/moderation/trusted-flagger-service.ts`                    |     0 | ✅ Created DbTrustedFlaggerRow interface, added type assertions for complex types                                                                                                                                                                                                                                                                          |
| `src/lib/notifications/background-handler.ts`                      |     0 | ✅ Replaced `as any` with proper Error extension type `Error & { originalErrors: Error[] }`                                                                                                                                                                                                                                                                |
| `src/lib/notifications/community-notification-service.ts`          |     0 | ✅ Replaced `any` with NotificationPreferenceModel type in update callback                                                                                                                                                                                                                                                                                 |
| `src/lib/notifications/notification-preferences-service.ts`        |     0 | ✅ Replaced `any` with NotificationPreferenceModel type in update callback                                                                                                                                                                                                                                                                                 |
| `src/lib/notifications/notification-sync.ts`                       |     0 | ✅ Replaced `as any` with `Collection<NotificationModel>` type                                                                                                                                                                                                                                                                                             |
| `src/lib/nutrient-engine/hooks/use-calibration.ts`                 |     0 | ✅ Replaced subscription `any` with `{ unsubscribe: () => void }                                                                                                                                                                                                                                                                                           | undefined`                                                                                                                                      |
| `src/lib/nutrient-engine/services/alert-service.ts`                |     0 | ✅ Replaced return type `any` with `Observable<DeviationAlertModel[]>`                                                                                                                                                                                                                                                                                     |
| `src/lib/nutrient-engine/utils/performance-metrics.ts`             |     0 | ✅ Replaced `as any` with proper alert type union                                                                                                                                                                                                                                                                                                          |
| `src/lib/plant-telemetry.ts`                                       |     0 | ✅ Replaced `as any` with `NodeJS.ProcessEnv & { JEST_WORKER_ID?: string }`                                                                                                                                                                                                                                                                                |
| `src/lib/playbooks/outbox-worker.ts`                               |     0 | ✅ Replaced notification data `Record<string, any>` with `Record<string, unknown>`                                                                                                                                                                                                                                                                         |
| `src/lib/playbooks/phase-notifications.ts`                         |     0 | ✅ Replaced trigger `as any` with proper `Notifications.SchedulableTriggerInputTypes.DATE` enum                                                                                                                                                                                                                                                            |
| `src/lib/playbooks/sanitize-playbook.ts`                           |     0 | ✅ Replaced metadata `Record<string, any>` with `Record<string, unknown>`                                                                                                                                                                                                                                                                                  |
| `src/lib/playbooks/task-generator.ts`                              |     0 | ✅ Removed unnecessary `as any` cast - PlaybookTaskMetadata is compatible with TaskMetadata                                                                                                                                                                                                                                                                |
| `src/lib/playbooks/use-phase-progress.ts`                          |     0 | ✅ Changed phase parameter from `string` to `GrowPhase`, removed `as any` cast                                                                                                                                                                                                                                                                             |
| `src/lib/privacy/export-service.ts`                                |     0 | ✅ Replaced `any` with `AssessmentModel` type in map function                                                                                                                                                                                                                                                                                              |
| `src/lib/privacy/telemetry-client.ts`                              |     0 | ✅ Replaced `as any` with proper type guards for number and boolean                                                                                                                                                                                                                                                                                        |
| `src/lib/sync/conflict-resolver.ts`                                |     0 | ✅ Replaced index signature `[key: string]: any` with `[key: string]: unknown`                                                                                                                                                                                                                                                                             |
| `src/lib/sync/offline-queue.ts`                                    |     0 | ✅ Replaced `record: any` with `Model` type, added type predicate for measured_at                                                                                                                                                                                                                                                                          |
| `src/lib/sync/sync-coordinator.ts`                                 |     0 | ✅ Replaced `as any` with proper type guard for SyncErrorCode mapping                                                                                                                                                                                                                                                                                      |
| `src/lib/sync/sync-performance-metrics.ts`                         |     0 | ✅ Replaced `as any` with proper `AnalyticsEvents['sync_metrics_snapshot']` type                                                                                                                                                                                                                                                                           |
| `src/lib/sync/sync-triggers.ts`                                    |     0 | ✅ Replaced `as any` with proper type guard checking for 'remove' method                                                                                                                                                                                                                                                                                   |

<details>
<summary>Detailed warnings</summary>

#### `src/lib/task-manager.ts` (0 warnings)

✅ Replaced Watermelon collections `any` casts with typed repositories and formalized inventory deduction/result types.

- 🔁 Follow-up: tightened reminder resets and deduction guards per review feedback.

#### `src/lib/sync-engine.ts` (0 warnings)

✅ Typed sync payload shapes, repository accessors, and conflict resolution helpers to replace legacy `any` usage.

- 🔁 Follow-up: restricted ISO parsing to audited fields and aligned inventory movement enrichment.

#### `src/lib/template-manager.ts` (0 warnings)

✅ Replaced all WatermelonDB collection `any` casts with `Collection<TaskModel>` and typed all task model operations. Introduced `BulkShiftPreviewItem` type for preview results.

#### `src/lib/uploads/queue.ts` (0 warnings)

✅ Replaced all WatermelonDB collection `any` casts with typed `Collection<ImageUploadQueueModel>`, `Collection<HarvestModel>`, and `Collection<TaskModel>`. Fixed null/undefined type mismatches and added proper type imports.

#### `src/lib/notifications/push-service.ts` (0 warnings)

✅ Replaced WatermelonDB collection `any` casts with `Collection<DeviceTokenModel>`. Removed unnecessary type assertions for Expo Notifications API (now uses proper types). Fixed Constants.expoConfig typing with type intersection for legacy `id` property. Replaced `any` in extractTokenString with `Record<string, unknown>`.

#### `src/lib/support/ticket-queue.ts` (0 warnings)

✅ Replaced WatermelonDB collection access with `Collection<SupportTicketQueueModel>`. Used inline eslint-disable comments for necessary `_raw` property access (WatermelonDB limitation). Simplified recordToTicket to remove redundant fallback branch.

#### `src/lib/sentry-utils.ts` (0 warnings)

✅ Replaced all `any` types with proper Sentry types (`SentryEvent`, `SentryBreadcrumb`, `SentryException`), `unknown` for generic scrubbing functions, and `Record<string, unknown>` for object types. Extracted helper functions to keep beforeSendHook under 90 lines. One intentional `any` cast remains for Contexts type compatibility (with eslint-disable comment).

#### `src/lib/moderation/age-verification-service.ts` (0 warnings)

✅ Defined database record types (`DbTokenRecord`, `DbUserStatusRecord`, `DbContentRestrictionRecord`) for all Supabase responses. Replaced constructor `any` parameter with proper `ReturnType<typeof createClient>`. Removed all `as any` casts from insert/update/select operations and replaced with typed database records.

#### `src/lib/notifications/notification-manager.ts` (0 warnings)

✅ Defined `NotificationPreferencesModel` type for WatermelonDB models and `NotificationSubscription` for notification listeners. Replaced all WatermelonDB collection `any` casts with typed `Collection<NotificationPreferencesModel>`. Used proper `Notifications.NotificationResponse` type instead of `any`. Replaced operation queue `any` with `unknown`. Changed error variable from `any` to `unknown`.

#### `src/lib/moderation/moderation-service.ts` (18 warnings)

```.text
154:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
192:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
192:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
229:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
244:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
246:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
402:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
414:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
753:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
757:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
761:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
765:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
769:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
773:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
777:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
781:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
785:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
789:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/ai-adjustment-service.ts` (16 warnings)

```.text
159:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
168:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
191:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
211:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
231:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
236:48  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
257:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
271:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
289:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
306:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
323:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
329:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
353:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
364:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
456:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
485:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/compliance/onboarding-state.ts` (14 warnings)

```.text
133:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
148:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
149:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
174:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
175:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
220:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
236:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
244:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
251:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
264:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
279:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
279:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
297:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
297:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/assessment-retention-service.ts` (13 warnings)

```.text
50:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
100:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
107:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
115:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
133:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
146:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
146:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
167:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
180:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
191:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
192:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
224:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
225:49  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/notification-storage.ts` (12 warnings)

```.text
71:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
73:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
112:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
129:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
158:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
179:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
199:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
220:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
248:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
265:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
283:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
341:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/calibration-reminder.ts` (12 warnings)

```.text
237:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
238:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
239:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
333:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
423:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
425:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
430:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
433:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
434:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
436:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
437:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
456:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/compliance/activation-state.ts` (11 warnings)

```.text
104:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
117:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
118:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
160:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
160:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
177:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
191:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
199:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
207:49  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
223:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
223:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/compliance/legal-acceptances.ts` (0 warnings)

✅ Replaced all Zustand `any` parameters with proper `StoreApi<LegalAcceptancesStoreState>['setState']` and `StoreApi<LegalAcceptancesStoreState>['getState']` types in all helper functions (createHydrateFunction, createAcceptDocumentFunction, createAcceptAllFunction, createResetFunction, createIsAllAcceptedFunction, createNeedsReAcceptanceFunction, createGetAcceptedVersionFunction, createLegalAcceptancesStore).

#### `src/lib/harvest/harvest-notification-service.ts` (0 warnings)

✅ Removed all unnecessary `any` casts accessing HarvestModel fields (`notificationId`, `overdueNotificationId`) - these fields are properly typed in the model. Fixed `normalizeTriggerDate` to use `unknown` with proper type guards instead of `any`.

#### `src/lib/moderation/transparency-service.ts` (0 warnings)

✅ Created `RedactedDbRecord` type alias (`Record<string, unknown>`) for PII-redacted database records. Replaced all `any[]` return types in export helper methods (getReportsForExport, getDecisionsForExport, getAppealsForExport, getAuditTrailForExport, redactPIIFromRecords) with properly typed arrays.

#### `src/lib/compliance/age-gate.ts` (0 warnings)

✅ Replaced all Zustand `any` parameters with proper `StoreApi<AgeGateStoreState>['setState']` and `StoreApi<AgeGateStoreState>['getState']` types in all helper functions (createHydrateFunction, createVerifyFunction, createResetFunction, createCheckExpirationFunction, createStartSessionFunction, createAgeGateStore).

#### `src/lib/moderation/content-age-gating.ts` (0 warnings)

✅ Created `DbContentRestriction` and `DbUserAgeStatus` database record types. Replaced constructor `any` parameter with proper `ReturnType<typeof createClient>`. Replaced all `any` casts in database operations with proper types using `satisfies` and `Pick` utility types.

#### `src/lib/notifications/push-receiver-service.ts` (0 warnings)

✅ Replaced all `any` types with proper Expo Notifications types: `Notifications.Notification`, `Notifications.NotificationResponse`, `EventSubscription` for subscriptions, and `Record<string, unknown>` for notification data extraction. Updated `NotificationBehavior` to include `shouldShowBanner` and `shouldShowList` properties.

#### `src/lib/assessment/assessment-sentry.ts` (0 warnings)

✅ Replaced all `any` type assertions with proper type guard `isInferenceError` to safely check and access InferenceError properties (code, category, message, retryable, fallbackToCloud). Used type guard throughout `captureInferenceError` function for breadcrumb data and Sentry tags/extra fields.

#### `src/lib/assessment/conflict-detection.ts` (0 warnings)

✅ Replaced all `any` types with `unknown`. Changed generic constraint from `Record<string, any>` to `Record<string, unknown>`. Removed unnecessary type assertions in `detectConflicts` (direct property access works with proper generic). In `isEqual`, replaced `any` parameters with `unknown` and added proper type narrowing for object property access.

#### `src/lib/harvest/harvest-error-handler.ts` (0 warnings)

✅ Replaced all `any` types with `Record<string, unknown>`. Changed translation function parameter type from `(key: string, options?: any)` to `(key: string, options?: Record<string, unknown>)` in all error handler functions (handleNetworkError, handleBusinessLogicError, handleConsistencyError, handleHarvestError). Fixed type guards (isNetworkError, isBusinessLogicError, isConsistencyError) to use `Record<string, unknown>` instead of `any` for property access.

#### `src/lib/nutrient-engine/hooks/use-alert-evaluation.ts` (0 warnings)

✅ Replaced all `any` types with proper domain types from nutrient-engine/types. Changed `modelToAlert` return type from `any` to `DeviationAlert`. Replaced `as any` casts with specific type assertions: `AlertType`, `AlertSeverity`, `PpmScale`, `QualityFlag[]`, and `GrowingMedium`. Added necessary type imports.

#### `src/lib/nutrient-engine/services/reservoir-event-service.ts` (0 warnings)

✅ Replaced all `any` types with proper types. Changed `create` callback parameter from `any` to `ReservoirEventModel`. Replaced subscription variables with `{ unsubscribe: () => void } | undefined` (compatible with both rxjs and WatermelonDB). Typed observable callbacks with `ReservoirEventModel[]` and error handlers with `unknown`.

#### `src/lib/nutrient-engine/services/reservoir-service.ts` (0 warnings)

✅ Replaced WatermelonDB callback `any` parameters with `ReservoirModel` type. Changed subscription variables from `any` to `{ unsubscribe: () => void } | undefined` (compatible with WatermelonDB's subscription interface). Typed observable callbacks with `ReservoirModel[]` and error handlers with `unknown`. Replaced validation cast from `as any` to `as Partial<CreateReservoirData>`.

#### `src/lib/nutrient-engine/services/source-water-profile-service.ts` (0 warnings)

✅ Replaced WatermelonDB callback `any` parameters with `SourceWaterProfileModel` type. Changed subscription variables from `any` to `{ unsubscribe: () => void } | undefined`. Typed observable callbacks with `SourceWaterProfileModel[]` and error handlers with `unknown`. Replaced validation cast from `as any` to `as Partial<CreateSourceWaterProfileData>`.

#### `src/lib/privacy/strip-pii.ts` (0 warnings)

✅ Replaced all `any` types with proper types: `Record<string, unknown>` for generic objects, added proper type guard for `isPlainObject`, typed function parameters with `unknown` for truly unknown inputs.

#### `src/lib/moderation/content-snapshot.ts` (0 warnings)

✅ Replaced all `any` with `unknown` for generic content data objects in CreateSnapshotOptions, extractMinimalSnapshotData, and pickFields helper.

#### `src/lib/moderation/moderation-metrics-queries.ts` (0 warnings)

✅ Created proper database record types (DbAppealRecord, DbODSEscalationRecord) to replace all `any[]` usages in query functions and helper methods.

#### `src/lib/notifications/android-channels.ts` (0 warnings)

✅ Created AndroidNotificationsExtended type to properly type Android-specific APIs (setNotificationChannelAsync, AndroidImportance, AndroidNotificationVisibility) that aren't in official expo-notifications types.

#### `src/lib/assessment/assessment-analytics-feedback-summary.ts` (0 warnings)

✅ Created proper types for SQLite queries (SQLiteQuery, UnsafeExecuteResult, DatabaseAdapterWithUnsafe) to replace all `any` usages in database adapter interactions.

#### `src/lib/assessment/assessment-analytics-summary.ts` (0 warnings)

✅ Created proper types for SQLite queries (SQLiteQuery, UnsafeExecuteResult, DatabaseAdapterWithUnsafe) to replace all `any` usages, matching pattern from assessment-analytics-feedback-summary.ts.

#### `src/lib/moderation/dsa-transparency-client.ts` (0 warnings)

✅ Created `DSAApiError` interface extending Error with `statusCode` and `isPermanent` properties. Replaced error object `any` casts with `Object.assign` to properly type the extended error. Typed `parseSubmissionResponse` parameter as `unknown` with type guard for validation. Added proper type narrowing in result mapping. Typed `isPermanentError` parameter as `unknown` with proper type assertion.

#### `src/lib/moderation/monitoring-service.ts` (0 warnings)

✅ Replaced `any` types in `generateAlerts` parameter with proper metric types: `PerformanceMetrics`, `ErrorMetrics`, `AuditIntegrityMetrics`, and `CapacityMetrics`. Typed `extractDurations` events parameter with proper structure `{ metadata?: { duration_ms?: unknown } }[]` to allow safe type narrowing.

#### `src/lib/playbooks/community-realtime-service.ts` (0 warnings)

✅ Created database record types: `CommunityPlaybookTemplate`, `TemplateRating`, and `TemplateComment` with required `id` fields and index signatures for additional properties. Replaced all `any` callback parameters with proper types. Added type assertions for Supabase realtime `payload.new` and `payload.old` to match expected types.

#### `src/lib/privacy/sdk-gate.ts` (0 warnings)

✅ Replaced `any` types in fetch interceptor with proper types: `RequestInfo | URL` for input parameter, `RequestInit` for init parameter, and proper `globalThis` typing with fetch property. Added proper URL extraction logic with type guards for string, URL, and Request types.

#### `src/lib/sync/sync-worker.ts` (0 warnings)

✅ Replaced `any` types with proper types: `unknown` for migration parameter (unused), `SyncPushPayload['changes']` for changes parameter, and `Record<string, unknown>` for conflict resolver local/remote parameters. Added `TableName` import and proper type casting for table name in conflict resolution.

#### `src/lib/sync/types.ts` (0 warnings)

✅ Replaced all `any` with `unknown` for dynamic database record fields in SyncPullResponse, SyncPushPayload, QueueItem, and LegacyConflict types. Using `unknown` is safer as it requires type narrowing before use.

#### `src/lib/compliance/regional-compliance.ts` (0 warnings)

✅ Replaced Zustand `any` with `StoreApi<RegionalComplianceState>['setState']` and `StoreApi<RegionalComplianceState>['getState']` types (same pattern as other compliance stores).

#### `src/lib/inventory/undo-service.ts` (0 warnings)

✅ Created `RawRecordWithDelete` type extending WatermelonDB's `RawRecord` to include `deleted_at` field for soft-delete checks. Replaced all `any` casts with proper type. Used `@ts-expect-error` for `deletedAt` setter (WatermelonDB limitation).

#### `src/lib/moderation/repeat-offender-service.ts` (0 warnings)

✅ Created `DbRepeatOffenderRecord` type for database operations. Replaced all `any` return types and parameters with proper types. Fixed array syntax to use `T[]` instead of `Array<T>`.

#### `src/lib/notifications/grouping-service.ts` (0 warnings)

✅ Created `ImmediateTrigger` type (`{ channelId: string } | null`) for notification triggers. Replaced all `any` casts with proper type. Expo docs allow null for immediate presentation but TypeScript types are incorrect.

#### `src/lib/playbooks/template-saver.ts` (0 warnings)

✅ Created `PlaybookRawRecord` type extending WatermelonDB's `RawRecord` to include template metadata fields (`is_template`, `is_community`, `author_handle`, `license`). Replaced multiple `any` casts with single typed cast.

#### `src/lib/sync/network-manager.ts` (0 warnings)

✅ Replaced all `any` with `NetInfoState` type from `@react-native-community/netinfo`. Normalized `isConnectionExpensive` from `boolean | null` to `boolean | undefined` to match NetworkState type definition.

#### `src/lib/sync/sync-manager.ts` (0 warnings)

✅ Replaced all `any` with proper WatermelonDB sync types: `SyncPullArgs`, `SyncPullResult`, `SyncPushArgs`, and `SyncDatabaseChangeSet`. Removed unnecessary `as any` cast from wmelonSynchronize call.

#### `src/lib/uploads/harvest-photo-cleanup.ts` (0 warnings)

✅ Replaced all `any` with `HarvestModel` type for WatermelonDB collection access. Accessed `photos` field directly from model instead of `_raw` to maintain type safety.

#### `src/lib/assessment/conflict-strategies.ts` (0 warnings)

✅ Replaced `any` with `Record<string, unknown>` in all generic constraints for conflict resolution functions.

#### `src/lib/assessment/sync-utils.ts` (0 warnings)

✅ Replaced `any` with `Record<string, unknown>` in generic constraint and type assertions. Added key existence check before assignment.

#### `src/lib/moderation/appeals-service.ts` (0 warnings)

✅ Replaced all `any` with `Appeal` type from `@/types/moderation` in helper functions.

#### `src/lib/moderation/config/moderation-config.ts` (0 warnings)

✅ Replaced `any` with `Record<string, unknown>` in `deepMerge` function generic constraint and used proper type assertions with `T[Extract<keyof T, string>]`.

#### `src/lib/moderation/error-classification.ts` (0 warnings)

✅ Replaced `any` with `Record<string, unknown>` in `ClassifiedError.metadata` and `ErrorContext` index signature. Added proper type guards in `extractHttpStatus` to safely access error properties.

#### `src/lib/playbooks/schedule-shifter.ts` (0 warnings)

✅ Replaced `any` with proper type guards for `task.metadata` access (using `Record<string, unknown>` for flags). Replaced `Record<string, any>` with `ScheduleShiftPriorValues` type for undo state.

#### `src/lib/playbooks/task-customization.ts` (0 warnings)

✅ Removed unnecessary `as any` casts when assigning `PlaybookTaskMetadata` to `record.metadata`. Since `PlaybookTaskMetadata` has the index signature `[key: string]: unknown`, it's fully compatible with `TaskMetadata` (which is `Record<string, unknown>`).

#### `src/lib/playbooks/template-adoption-service.ts` (0 warnings)

✅ Replaced all `any` types with proper domain types:

- `steps: any[]` → `steps: PlaybookStep[]` in AdoptedPlaybook interface and applyCustomizations method
- `Promise<any[]>` → `Promise<TemplateComment[]>` in getTemplateComments with proper DB row mapping (template_id → templateId, user_id → authorId, comment → content)

#### `src/lib/playbooks/use-ai-adjustments.ts` (0 warnings)

✅ Replaced all `analytics: any` parameters with `analytics: AnalyticsClient` in useGenerateSuggestion, useAcceptSuggestion, and useDeclineSuggestion helper functions.

#### `src/lib/privacy/deletion-adapter-supabase.ts` (0 warnings)

✅ Created `StorageFileObject` interface for Supabase storage file objects with proper fields (name, id, updated_at, created_at, last_accessed_at, metadata). Removed `as any` cast for list options and replaced `any` type annotations in filter and map callbacks.

#### `src/lib/privacy/deletion-adapter.ts` (0 warnings)

✅ Created `GlobalWithAdapter` interface to type the globalThis extension with the `__growbroDeletionAdapter__` key. Replaced all `globalThis as any` casts with proper typed reference `g`.

#### `src/lib/support/help-article-cache.ts` (0 warnings)

✅ Replaced `any` with proper `HelpArticleCacheModel` type assertions in WatermelonDB callbacks. Used `as HelpArticleCacheModel` casts inside callbacks (WatermelonDB limitation - callbacks expect base Model type).

#### `src/lib/assessment/conflict-types.ts` (2 warnings)

```.text
6:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
13:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/model-remote-config.ts` (2 warnings)

```.text
364:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
364:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/harvest/harvest-sync-error-handler.ts` (2 warnings)

```.text
29:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
77:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/cost-analysis-service.ts` (2 warnings)

```.text
129:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
190:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/csv-import-service.ts` (2 warnings)

```.text
573:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
577:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/movement-service.ts` (2 warnings)

```.text
267:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
307:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/use-inventory-item-detail.ts` (2 warnings)

```.text
37:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
105:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/sor-submission-orchestrator.ts` (2 warnings)

```.text
117:63  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
131:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/trusted-flagger-analytics.ts` (2 warnings)

```.text
107:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
285:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/ios-categories.ts` (2 warnings)

```.text
105:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
105:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/local-service.ts` (2 warnings)

```.text
41:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
115:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/use-notification-preferences.ts` (2 warnings)

```.text
49:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
95:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/calibration-service.ts` (2 warnings)

```.text
307:4  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
331:4  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/analytics/example-usage.ts` (2 warnings)

```.text
135:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
136:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/template-sharing-service.ts` (2 warnings)

```.text
35:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
256:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/sync/preferences.ts` (2 warnings)

```.text
40:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
54:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/calibration-remote-config.ts` (1 warnings)

```.text
403:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/conflict-resolver.ts` (1 warnings)

```.text
17:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/deduction-service.ts` (1 warnings)

```.text
205:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/use-consumption-analytics.ts` (1 warnings)

```.text
87:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/use-inventory-items.ts` (1 warnings)

```.text
51:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/account-restoration-service.ts` (1 warnings)

```.text
64:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/audit-retention-manager.ts` (1 warnings)

```.text
125:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/audit-service.ts` (1 warnings)

```.text
419:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/community-integration.ts` (1 warnings)

```.text
357:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/conflict-of-interest.ts` (1 warnings)

```.text
57:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/graceful-degradation.ts` (1 warnings)

```.text
44:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/migrations/migration-manager.ts` (0 warnings)

✅ Created DbMigrationRecord interface for database record mapping

#### `src/lib/moderation/moderation-metrics-types.ts` (0 warnings)

✅ Replaced metadata `Record<string, any>` with `Record<string, unknown>`

#### `src/lib/moderation/moderation-notification-service.ts` (0 warnings)

✅ Replaced error `any` with `unknown`, added Error type guard

#### `src/lib/moderation/notification-integration.ts` (0 warnings)

✅ Replaced error `any` with `unknown`, added Error type guards for message and stack

#### `src/lib/moderation/pii-scrubber.ts` (0 warnings)

✅ Replaced `as any` with `as unknown as Record<string, unknown>` for dynamic field validation

#### `src/lib/moderation/sor-export-queue.ts` (0 warnings)

✅ Replaced `any` with typed interface `{ status: SoRExportStatus }` for database row

#### `src/lib/moderation/trusted-flagger-review.ts` (0 warnings)

✅ Created DbTrustedFlaggerRow interface, added type assertions for ContactInfo, TrustedFlaggerStatus, QualityMetrics

#### `src/lib/moderation/trusted-flagger-service.ts` (0 warnings)

✅ Created DbTrustedFlaggerRow interface, added type assertions for complex types

#### `src/lib/notifications/background-handler.ts` (1 warnings)

```.text
126:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/community-notification-service.ts` (1 warnings)

```.text
82:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/notification-preferences-service.ts` (1 warnings)

```.text
55:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/notification-sync.ts` (1 warnings)

```.text
208:8  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/hooks/use-calibration.ts` (1 warnings)

```.text
38:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/alert-service.ts` (1 warnings)

✅ **FIXED** — Removed `as any` cast from `observeActiveAlerts` return; WatermelonDB Observable types are compatible without casting

#### `src/lib/nutrient-engine/utils/performance-metrics.ts` (1 warnings)

✅ **FIXED** — Replaced `as DeviationPattern['type']` cast with type guard `isSupportedDeviationType` for proper type narrowing

#### `src/lib/plant-telemetry.ts` (1 warnings)

✅ **FIXED** — Extracted `ProcessEnvWithJest` type alias to replace inline type assertion

#### `src/lib/playbooks/outbox-worker.ts` (1 warnings)

✅ **ALREADY CLEAN** — No any usages found; may have been fixed in a previous pass

#### `src/lib/playbooks/phase-notifications.ts` (0 warnings)

✅ Replaced trigger `as any` with proper `Notifications.SchedulableTriggerInputTypes.DATE` enum for notification scheduling.

#### `src/lib/playbooks/sanitize-playbook.ts` (0 warnings)

✅ Replaced metadata `Record<string, any>` with `Record<string, unknown>` in Playbook interface.

#### `src/lib/playbooks/task-generator.ts` (0 warnings)

✅ Removed unnecessary `as any` cast for metadata assignment - PlaybookTaskMetadata is compatible with TaskMetadata due to index signature.

#### `src/lib/playbooks/use-phase-progress.ts` (0 warnings)

✅ Changed phase parameter type from `string` to `GrowPhase` in UsePhaseSummaryOptions, removed unnecessary `as any` cast.

#### `src/lib/privacy/export-service.ts` (0 warnings)

✅ Replaced `any` with `AssessmentModel` type in assessment records map function.

#### `src/lib/privacy/telemetry-client.ts` (0 warnings)

✅ Replaced `as any` with proper type guards (`typeof v === 'number' || typeof v === 'boolean'`) in sanitizeEvent method.

#### `src/lib/sync/conflict-resolver.ts` (0 warnings)

✅ Replaced index signature `[key: string]: any` with `[key: string]: unknown` in ConflictRecord type.

#### `src/lib/sync/offline-queue.ts` (0 warnings)

✅ Replaced `record: any` with `Model` type from WatermelonDB, added type predicate filter to ensure measured_at is defined.

#### `src/lib/sync/sync-coordinator.ts` (0 warnings)

✅ Replaced `as any` with proper type guard to map error code to SyncErrorCode, defaulting to 'unknown' for invalid codes.

#### `src/lib/sync/sync-performance-metrics.ts` (0 warnings)

✅ Replaced `as any` with proper `AnalyticsEvents['sync_metrics_snapshot']` type for snapshot object.

#### `src/lib/sync/sync-triggers.ts` (0 warnings)

✅ Replaced `as any` with proper type guard checking for 'remove' method in appStateSub cleanup.

</details>

## Medium Priority (Tier 3 — Surface/API cleanup)

Total warnings: **537**

| File                                                  | Count |
| ----------------------------------------------------- | ----: |
| `src/lib/task-notifications.ts`                       |     0 |
| `src/app/(modals)/trichome-helper.tsx`                |     0 |
| `src/components/calendar/drag-drop-provider.tsx`      |     0 |
| `src/api/strains/client.ts`                           |     0 |
| `src/components/community/report-content-modal.tsx`   |     0 |
| `src/components/playbooks/ai-adjustments-example.tsx` |     0 |
| `src/api/community/client.ts`                         |     0 |
| `src/components/harvest/harvest-modal.tsx`            |     0 |
| `src/app/(app)/inventory/add.tsx`                     |     0 |
| `src/lib/strains/normalization.ts`                    |    11 |

#### `src/app/(app)/inventory/add.tsx` (0 warnings)

✅ Replaced all `any` types with `Control<AddItemFormData>` from react-hook-form. Updated all field component props (NameField, CategoryField, UnitField, TrackingModeField, MinStockField, ReorderMultipleField, LeadTimeField, SkuField, BarcodeField) to use proper Control type. Removed `as any` type assertions from rules objects in ControlledInput components.

#### `src/lib/strains/normalization.ts` (0 warnings)

✅ Replaced all `any` types with proper type definitions. Created type aliases for raw API data: `RawPercentageValue`, `RawEffect`, `RawFlavor`, `RawTerpene`, `RawYieldData`, `RawFloweringTime`, `RawHeightData`, `RawGrowCharacteristics`, and `RawApiStrain`. Updated all normalization functions to use `unknown` or specific raw types instead of `any`. Fixed type predicates in filter operations. Removed circular import of `normalizeFlavors`.
| `src/components/consent-manager.tsx` | 0 | ✅ Replaced all `any` types with proper types: created discriminated union for ToggleConfig (privacy vs runtime consent keys), imported ConsentPurpose and ConsentState from consent-types, typed all function parameters and state setters with proper types |
| `src/components/settings/settings-sync-banner.tsx` | 0 | ✅ Replaced all `as any` casts with `as TxKeyPath` for translation keys, replaced template literal translation keys with conditional expressions for proper type safety |
| `src/app/settings/notifications.tsx` | 0 | ✅ Replaced all `as any` casts with `as TxKeyPath` for translation keys in CategoryToggle and quiet hours section |
| `src/components/plants/plants-card.tsx` | 0 | ✅ Removed all `as any` casts from Reanimated code - used proper Reanimated.interpolate without casting, typed PlantBlurOverlay animatedProps as `Partial<{ intensity: number }>`, removed unnecessary StyleSheet.absoluteFill casts |
| `src/lib/error-handling.ts` | 0 | ✅ Created InventoryError type and isInventoryError type guard, replaced all `as any` casts with proper type guards using `in` operator and typeof checks for error property access |
| `src/lib/notification-metrics.ts` | 0 | ✅ Replaced WatermelonDB collection `any` casts with `Collection<NotificationQueueModel>`, typed notification event listeners with proper Expo Notifications types (`Notifications.Notification`, `Notifications.NotificationResponse`) |
| `src/lib/auth/auth-telemetry.ts` | 0 | ✅ Replaced all `[key: string]: any` with `Record<string, unknown>`, removed `as any` cast from analytics track call, typed authContext in Sentry event processor with proper Record type |
| `src/lib/community/realtime-manager.ts` | 0 | ✅ Created SupabaseRealtimePayload type for realtime payloads, replaced all `any` config objects with proper inline types, typed all handler methods with SupabaseRealtimePayload, extracted setupSubscriptions and handleSubscriptionStatus methods to keep connect under 90 lines |
| `src/lib/rrule/generator.ts` | 0 | ✅ Created RRuleOptions type for parsed rule options, imported Weekday type from rrule, replaced WEEKDAY_MAP `Record<string, any>` with `Record<string, Weekday>`, typed all opts variables with RRuleOptions using inline type assertions for parsed rule access |
| `src/app/(app)/community.tsx` | 0 | ✅ Imported FlashListProps type, typed AnimatedFlashList as `React.ComponentClass<FlashListProps<Post>>`, typed page parameter in flatMap with `{ results: Post[] }`, typed listRef as `React.RefObject<FlashList<Post>>`, typed scrollHandler as `(event: unknown) => void` |
| `src/components/community/post-card.tsx` | 0 | ✅ Replaced all event handler `any` parameters with inline type `{ stopPropagation: () => void; preventDefault: () => void }` for handleCommentPress, handleAuthorPress, and handleDeletePress |
| `src/components/strains/strains-list-with-cache.tsx` | 0 | ✅ Replaced all `any` types with proper FlashList types: imported `FlashListRef` and `ListRenderItemInfo` from `@shopify/flash-list`, typed `onScroll` parameter with `NativeSyntheticEvent<NativeScrollEvent>`, typed `listRef` with `React.RefObject<FlashList<Strain>>`, typed `contentContainerStyle` with `FlashListProps<Strain>['contentContainerStyle']`, and typed `renderItem` callback with `ListRenderItemInfo<Strain>` |
| `src/lib/animations/animated-scroll-list-provider.tsx` | 0 | ✅ Replaced all `any` types with proper scroll event types: created `ScrollEvent` type alias for `NativeSyntheticEvent<NativeScrollEvent>`, typed `listRef` with `React.RefObject<FlashList<unknown> | null>`, typed `scrollHandler` with `(event: ScrollEvent) => void`, and typed all scroll handler callbacks (`onBeginDrag`, `onScroll`, `onEndDrag`) with `ScrollEvent` |
| `src/lib/community/event-deduplicator.ts` | 0 | ✅ Replaced all `any` types with `Record<string, unknown>`: changed generic constraint from `Record<string, any>` to `Record<string, unknown>`, typed default `getKey` function with proper type assertions, and typed timestamp field access with explicit `Record<string, unknown>` casts and string assertions |
| `src/lib/settings/toast-utils.ts` | 0 | ✅ Replaced all `as any` casts with proper type: created `AccessibleMessageOptions` interface extending `MessageOptions` with `accessibilityLiveRegion` property, replaced all `as any` casts with typed `AccessibleMessageOptions` objects passed to `showMessage` |
| `src/api/auth/error-mapper.ts` | 0 | ✅ Replaced all `any` types with proper error types: created `EdgeFunctionError` interface for Edge Function errors with code and metadata fields, created `UnknownError` type alias for `unknown`, replaced all `any` parameters with `UnknownError`, added type guards in `mapEdgeFunctionError` and `isAccountLocked` to safely check error structure before accessing properties |
| `src/app/settings/profile.tsx` | 0 | ✅ Replaced all `any` types with proper types: imported `Control` and `FieldErrors` from react-hook-form, imported `TFunction` from react-i18next, typed `control` parameter as `Control<ProfileFormData>`, typed `errors` as `FieldErrors<ProfileFormData>`, typed `t` parameters as `TFunction`, and created inline interface for `statistics` parameter with proper shape (`isLoading`, `isSyncing`, `plantsCount`, `harvestsCount`, `postsCount`, `likesReceived`) |
| `src/components/onboarding/camera-permission-primer.tsx` | 0 | ✅ Removed all `as any` type assertions from translation key props - string literals are already valid `TxKeyPath` types |
| `src/components/onboarding/notification-permission-primer.tsx` | 0 | ✅ Done |
| `src/components/privacy-settings.tsx` | 0 | ✅ Done |
| `src/components/strains/filter-modal.tsx` | 0 | ✅ Done |
| `src/lib/analytics.ts` | 0 | ✅ Done |
| `src/lib/hooks/use-root-startup.ts` | 0 | ✅ Removed type assertions, used proper type guards with `in` operator to check for timeZone property on calendar and locale objects |
| `src/lib/i18n/utils.tsx` | 0 | ✅ Replaced all `any` with `Record<string, unknown>` in resolveResource and interpolate functions, typed options parameter as `TOptions | undefined` in translate |
| `src/lib/log-sanitizer.ts` | 0 | ✅ Replaced all `any` with `unknown` in sanitizeObject method signature and sanitize function, typed output object as `Record<string, unknown>` |
| `src/lib/outbox.ts` | 0 | ✅ Replaced all `Record<string, any>` with `Record<string, unknown>` in OutboxEntry type, enqueueOutboxEntry params, and Scheduler interface; replaced error `as any` cast with proper type guard |
| `src/api/community/types.ts` | 0 | ✅ Replaced all `any` with proper types: `Record<string, unknown>` for OutboxEntry payload, `unknown` for ApiError details and IdempotencyKey response_payload/error_details |
| `src/components/assessment/assessment-feedback-sheet.tsx` | 0 | ✅ Created ModalRef type for modal reference, replaced all `any` in ref handling with proper types (`ModalRef | null` for internalRef, typed setRefs callback parameter, and proper type guard for ref assignment) |
| `src/components/nutrient/reservoir-form.tsx` | 0 | ✅ Removed unnecessary second generic parameter `any` from all `Control<ReservoirFormData>` types in PHRangeFieldsProps, ECRangeFieldsProps, BasicInfoFieldsProps, and ConfigFieldsProps |
| `src/components/playbooks/playbook-selection-card.tsx` | 0 | ✅ Replaced all translation function `any` types with proper `TFunction` type from i18next in getSetupDisplayLabel, PlaybookCardStats, and PlaybookCardEstimated |
| `src/components/shared/optional-blur-view.tsx` | 0 | ✅ Created ExpoBlurModule type for dynamic import, replaced all `any` with proper types: `React.ComponentType<BlurProps>` for Blur state, `ExpoBlurModule` for import module, `BlurProps` for AnimatedOptionalBlurView props, removed unnecessary `as any` cast from StyleSheet.absoluteFill |
| `src/components/trichome/trichome-assessment-form.tsx` | 0 | ✅ Replaced all `any` with proper types: `Control<TrichomeFormData>` for control parameters, `FieldErrors<TrichomeFormData>` for errors, and `TFunction` from i18next for translation function |
| `src/lib/community/outbox-processor.ts` | 0 | ✅ Replaced all `any` with proper types: `unknown` for error catches with proper type guards for error.message and error.response.status, `Record<string, unknown>` for executeOperation payload parameter |
| `src/lib/hooks/use-mfa-management.ts` | 0 | ✅ Created MfaFactor type for factor objects, replaced all `any` with proper types: `Promise<unknown>` for refetchMfaFactors, `MfaFactor | undefined` for activeFactor, typed allFactors cast as `MfaFactor[]`, removed `any` from filter callback |
| `src/lib/security/key-manager.ts` | 0 | ✅ Replaced all `any[]` with `unknown[]` in logger function rest parameters (debug, info, warn, error methods) |
| `src/lib/security/secure-storage.ts` | 0 | ✅ Replaced all `any[]` with `unknown[]` in logger function rest parameters (debug, info, warn, error methods) |
| `src/lib/security/storage-auditor.ts` | 0 | ✅ Replaced all `any[]` with `unknown[]` in logger function rest parameters (debug, info, warn, error methods) |
| `src/lib/watermelon-models/ai-second-opinions-queue.ts` | 0 | ✅ Replaced all `any` with proper types: `AIAssessmentPayload | null` for aiAssessment getter, `AIAssessmentPayload` for setAiAssessment parameter, `ExpertReview | null` for expertReview getter and setExpertReview parameter, imported types from @/types/support |
| `src/app/settings/index.tsx` | 0 | ✅ Replaced all `any` with proper `Router` type from expo-router in PrivacySettings, SupportSection, and LegalSection function parameters |
| `src/components/calendar/agenda-item.tsx` | 0 |
| `src/components/inputs.tsx` | 0 |
| `src/components/nutrient/reservoir-event-form.tsx` | 0 |
| `src/components/playbooks/phase-timeline.tsx` | 0 |
| `src/components/strains/strain-card.tsx` | 0 |
| `src/lib/community/idempotency-service.ts` | 0 |
| `src/lib/i18n/index.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/lib/performance/rn-performance.ts` | 0 | ✅ Already clean - no any warnings found |
| `src/lib/rrule/iterator.ts` | 0 | ✅ Already clean - no any warnings found |
| `src/lib/watermelon-indexes.ts` | 0 | ✅ Fixed prettier formatting issue |
| `src/types/moderation.ts` | 0 | ✅ Already clean - no any warnings found |
| `src/api/auth/use-sign-in.ts` | 0 | ✅ Already clean - no any warnings found |
| `src/api/community/use-create-comment.ts` | 0 | ✅ Already clean - no any warnings found |
| `src/api/ph-ec-readings/index.ts` | 0 | ✅ Already clean - no any warnings found |
| `src/api/strains/use-strains-infinite-with-cache.ts` | 0 | ✅ Already clean - no any warnings found |
| `src/api/support/use-help-articles.ts` | 0 | ✅ Already clean - no any warnings found |
| `src/api/templates/use-templates.ts` | 0 | ✅ Already clean - no any warnings found |
| `src/app/(app)/strains.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/app/(app)/strains/favorites.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/app/settings/privacy-and-data.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/app/settings/security.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/components/harvest/harvest-history-empty.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/components/harvest/weight-chart-table.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/components/inventory/csv/import-csv-button.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/components/onboarding/onboarding-buttons.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/components/onboarding/pagination-dots.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/components/playbooks/save-template-prompt.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/components/playbooks/task-edit-modal.tsx` | 0 | ✅ Already clean - no any warnings found |
| `src/components/shared/custom-cell-renderer-component.tsx` | 0 | ✅ Replaced any types with proper React element type (ChildWithItemY) that includes itemY prop as SharedValue<number> |
| `src/components/strains/custom-cell-renderer-component.tsx` | 0 | ✅ Replaced any types with proper ViewProps and typed React element with itemY prop |
| `src/components/strains/filter-chips.tsx` | 0 | ✅ Used translateDynamic for dynamic translation keys instead of any type assertions |
| `src/components/strains/sort-menu.tsx` | 0 | ✅ Replaced any with TxKeyPath for translation labels and BottomSheetModal for Modal ref |
| `src/lib/performance/navigation-instrumentation.ts` | 0 | ✅ Replaced any with proper NavigationContainerRef<Record<string, unknown>> and created NavigationIntegration type |
| `src/lib/quality/remote-config.ts` | 0 | ✅ Replaced any with inline type for error object with optional status and message properties |
| `src/lib/security/device-fingerprint.ts` | 0 | ✅ Replaced any with PlatformWithTablet type extension for Platform with optional isPad and isTV properties |
| `src/lib/task-notification-usage-example.ts` | 0 | ✅ Replaced any with proper Task interface matching the one used in task-notifications.ts |
| `src/lib/watermelon-migrations.ts` | 0 | ✅ Replaced any with ColumnDefinition interface for WatermelonDB column definitions |
| `src/lib/watermelon-models/profile.ts` | 0 | ✅ Replaced any with ProfileModel type for record parameters in create and update callbacks |
| `scripts/ci/generate-performance-report.ts` | 0 | ✅ Replaced `any` with `unknown` in validateNumber function parameter
| `scripts/validate-dsa-compliance.ts` | 0 | ✅ Replaced `any` with `SupabaseClient` type for supabase property
| `src/api/auth/types.ts` | 0 | ✅ Already clean - no any warnings found
| `src/api/auth/use-request-account-deletion.ts` | 0 | ✅ Replaced `any` with `unknown` for auditError parameter and added type guard for error message access
| `src/api/common/client.tsx` | 0 | ✅ Replaced `any` with `RetryConfig` interface extending `InternalAxiosRequestConfig` for retry logic
| `src/api/common/utils.tsx` | 0 | ✅ Replaced `any` with `unknown` in KeyParams type
| `src/api/moderation/conflict-of-interest-api.ts` | 0 | ✅ Replaced `any[]` with `ModeratorDecision[]` interface for decision records
| `src/api/posts/use-posts-infinite.ts` | 0 | ✅ Replaced `any` with `string | number` for params Record type
| `src/api/strains/use-strain.ts` | 0 | ✅ Replaced `any` with `unknown` for error parameter and added proper type guards for error.response.status access
| `src/app/(app)/calendar.tsx` | 0 | ✅ Removed unnecessary `as any` assertion - TypeScript guard already ensures item.task is defined
| `src/app/(app)/inventory/index.tsx` | 0 | ✅ Replaced `any` with `FlashListRef<InventoryItem>` for listRef type
| `src/app/settings/storage.tsx` | 0 |
| `src/components/auth/login-form.tsx` | 0 |
| `src/components/auth/re-auth-modal.tsx` | 0 |
| `src/components/calendar/agenda-list.tsx` | 0 |
| `src/components/calendar/day-sortable-list.tsx` | 0 |
| `src/components/calendar/draggable-agenda-item.tsx` | 0 |
| `src/components/calendar/sortable-day-view.example.tsx` | 0 |
| `src/components/card.tsx` | 0 |
| `src/components/community/age-restricted-content-placeholder.tsx` | 0 |
| `src/components/community/comment-form.tsx` | 0 |
| `src/components/community/community-error-boundary.tsx` | 0 |
| `src/components/consent-modal.tsx` | 0 |
| `src/components/harvest/stage-timer-progress.tsx` | 0 |
| `src/components/harvest/weight-chart.tsx` | 0 |
| `src/components/home/activation-checklist.tsx` | 0 |
| `src/components/inventory/consumption-trend-chart.tsx` | 1 |
| `src/components/inventory/csv/export-csv-button.tsx` | 1 |
| `src/components/inventory/inventory-list.tsx` | 1 |
| `src/components/legal-confirmation-modal.tsx` | 1 |
| `src/components/moderation/jurisdiction-selector.tsx` | 1 |
| `src/components/navigation/shared-header.tsx` | 1 |
| `src/components/nutrient-engine/phase-header.tsx` | 1 |
| `src/components/onboarding/onboarding-pager.tsx` | 1 |
| `src/components/strains/favorites-sort-menu.tsx` | 1 |
| `src/components/trichome/trichome-guide-card.tsx` | 1 |
| `src/components/ui/button.tsx` | 1 |
| `src/components/ui/list.tsx` | 1 |
| `src/components/ui/modal.tsx` | 1 |
| `src/lib/animations/stagger.ts` | 1 |
| `src/lib/auth/session-manager.ts` | 1 |
| `src/lib/hooks/use-conflict-resolution.ts` | 1 |
| `src/lib/i18n/types.ts` | 1 |
| `src/lib/media/background-photo-cleanup.ts` | 1 |
| `src/lib/media/photo-storage-helpers.ts` | 1 |
| `src/lib/performance/sentry-integration.ts` | 1 |
| `src/lib/quality/engine.ts` | 1 |
| `src/lib/strains/favorites-sync-queue.ts` | 1 |
| `src/lib/supabase.ts` | 1 |
| `src/lib/utils.ts` | 1 |
| `src/lib/watermelon-models/favorites-repository.ts` | 1 |
| `src/lib/watermelon-models/notification-preference.ts` | 1 |
| `src/lib/watermelon-models/outbox-notification-action.ts` | 1 |
| `src/types/community.ts` | 1 |

<details>
<summary>Detailed warnings</summary>

#### `src/lib/task-notifications.ts` (0 warnings)

✅ Replaced all `any` types with proper WatermelonDB types (Database, Collection<NotificationQueueModel>, Collection<TaskModel>). Removed unnecessary type casts for Notifications API. Typed all function parameters and return types with proper domain types (Task, TaskModel, NotificationQueueModel). Used proper type guards for dynamic property access.

#### `src/app/(modals)/trichome-helper.tsx` (0 warnings)

✅ Replaced all `any` types with proper trichome domain types (HarvestSuggestion, HarvestWindow, TrichomeGuide, TrichomeAssessment). Typed all hook parameters and return types with proper function signatures. Typed React state setters with proper Dispatch types.

#### `src/components/calendar/drag-drop-provider.tsx` (0 warnings)

✅ Replaced all `any` types with proper types. Created `ScrollableListRef` type for FlashList/FlatList refs with scrollToOffset method. Changed `timeoutId: any` to `ReturnType<typeof setTimeout>`. Replaced all `React.RefObject<any>` with `React.RefObject<ScrollableListRef>`. Removed `as any` casts by using proper type guards. Typed event handlers with `NativeSyntheticEvent<NativeScrollEvent>` and layout event types. Replaced `(globalThis as any).jest` with proper type guard using `globalThis as { jest?: unknown }`.

```.text
22:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
41:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
60:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
97:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
101:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
146:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
159:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
160:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
166:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
211:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
299:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
387:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
496:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
517:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
518:17  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
519:17  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
523:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
530:9   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
538:9   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/strains/client.ts` (0 warnings)

✅ Replaced all `any` types with proper types. Imported `AnalyticsClient` from `@/lib/analytics` instead of defining inline type. Typed `analyticsClient` variable properly. Replaced `any` parameters in sanitization helpers with `Record<string, unknown>` and generic constraints. Typed all Axios interceptor callbacks with `AxiosError` type. Created `RetryConfig` type extending `AxiosRequestConfig` for retry logic. Replaced `data: any` in `normalizeResponse` with `unknown` and added proper type guards for different response formats. Typed all response/error handlers with `AxiosResponse<unknown>` and `AxiosError`. Used type assertions for Axios headers compatibility.

#### `src/components/community/report-content-modal.tsx` (0 warnings)

✅ Replaced all `any` types with proper react-hook-form types. Imported `Control<ReportFormData>` and `FieldErrors<ReportFormData>` types. Typed `createReportSchema` parameter with `(key: string) => string` for translation function. Updated all component props (ReportTypeSelection, ReasonSelection, IllegalReportFields, ExplanationSection, ReporterEmailSection, GoodFaithDeclaration, ReportContentForm) to use proper Control and FieldErrors types.

#### `src/components/playbooks/ai-adjustments-example.tsx` (0 warnings)

✅ Replaced all `any` types with proper function signatures. Typed AcceptParams with proper acceptSuggestion function signature returning `Promise<AdjustmentSuggestion | null>`. Typed DeclineParams with declineSuggestion returning `Promise<void>`. Updated useAdjustmentHandlers and useActionHandlers options with proper function signatures for acceptSuggestion, declineSuggestion, voteHelpfulness, setNeverSuggest, and generateSuggestion. All React state setters now use proper `React.Dispatch<React.SetStateAction<T>>` types.

#### `src/api/community/client.ts` (0 warnings)

✅ Replaced all `any` types with proper database record types. Created `DbPostDiagnostic`, `DbCommentDiagnostic`, `DbPostRecord`, and `DbPostLike` types for database operations. Typed diagnostic methods with proper return types. Replaced `query: any` in getPostsWithCounts with `PostgrestFilterBuilder<unknown, DbPostRecord, DbPostRecord[]>`. Typed all map/forEach callbacks with proper database record types. Fixed moderation error extraction with inline type assertion `{ error?: string }`.

#### `src/components/harvest/harvest-modal.tsx` (0 warnings)

✅ Replaced all `any` types with proper react-hook-form and domain types. Imported `Control<HarvestFormData>` and `FieldErrors<HarvestFormData>` types. Updated all component props (WeightInput, HarvestForm, FormContent, WeightInputs, NotesField, createHandleSubmit) to use proper Control and FieldErrors types. Changed `onSubmit` callback parameter from `any` to `CreateHarvestInput`. Typed translation function with `Record<string, unknown>` for options parameter.

#### `src/app/(app)/inventory/add.tsx` (0 warnings)

✅ No actual `any` types found - warnings were formatting/prettier issues that were auto-fixed. File already properly typed with `Control<AddItemFormData>`, `FieldErrors<AddItemFormData>`, and domain types.

#### `src/lib/strains/normalization.ts` (0 warnings)

✅ Already clean - all types properly defined with union types (RawPercentageValue, RawEffect, RawFlavor, RawTerpene, RawYieldData, RawFloweringTime, RawHeightData, RawGrowCharacteristics, RawApiStrain) instead of any. Uses `unknown` for runtime validation with proper type guards.

#### `src/components/consent-manager.tsx` (0 warnings)

✅ Already clean - all types properly defined with PrivacyConsent, ConsentState, ConsentPurpose, TxKeyPath, and React.Dispatch types. No any types found.

#### `src/components/settings/settings-sync-banner.tsx` (0 warnings)

✅ Already clean - all types properly defined with SyncQueueStats, TxKeyPath, and proper React types. Uses type assertions for TxKeyPath strings which is the correct pattern.

#### `src/app/settings/notifications.tsx` (0 warnings)

✅ Already clean - all types properly defined with TxKeyPath, NotificationChannelId, TaskReminderTiming, and proper React types.

#### `src/components/plants/plants-card.tsx` (0 warnings)

✅ Already clean - all types properly defined with proper React types and domain types.

#### `src/lib/error-handling.ts` (0 warnings)

✅ Fixed inline type assertion in isInventoryError - replaced `(error as any).message` with `(error as { message: unknown }).message` for proper type checking.

#### `src/lib/notification-metrics.ts` (0 warnings)

✅ Already clean - all types properly defined.

#### `src/lib/auth/auth-telemetry.ts` (0 warnings)

✅ Already clean - all types properly defined.

#### `src/lib/community/realtime-manager.ts` (0 warnings)

✅ Already clean - all types properly defined after formatting fixes.

#### `src/lib/rrule/generator.ts` (0 warnings)

✅ Already clean - all types properly defined after formatting fixes.

#### `src/app/(app)/community.tsx` (0 warnings)

✅ Already clean - all types properly defined.

#### `src/components/community/post-card.tsx` (0 warnings)

✅ Already clean - all types properly defined.

#### `src/components/strains/strains-list-with-cache.tsx` (0 warnings)

✅ Already clean - all types properly defined.

#### `src/lib/animations/animated-scroll-list-provider.tsx` (0 warnings)

✅ Already clean - all types properly defined.

#### `src/lib/community/event-deduplicator.ts` (0 warnings)

✅ Already clean - all types properly defined.

#### `src/lib/settings/toast-utils.ts` (6 warnings)

```.text
36:8  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
54:8  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
74:8  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
92:8  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
108:8  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
131:8  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/auth/error-mapper.ts` (5 warnings)

```.text
17:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
29:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
48:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
159:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
171:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/profile.tsx` (5 warnings)

```.text
94:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
95:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
97:6   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
204:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
207:6   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/onboarding/camera-permission-primer.tsx` ✅ (0 warnings)

**Fixed**: Removed all `as any` type assertions from translation key props. The string literals are already valid `TxKeyPath` types and don't need casting. Changed:

- `titleTx={'onboarding.permissions.camera.title' as any}` → `titleTx="onboarding.permissions.camera.title"`
- `descriptionTx={'onboarding.permissions.camera.description' as any}` → `descriptionTx="onboarding.permissions.camera.description"`
- `benefitsTx` array items: removed `as any` from all three benefit keys

```.text
✅ All warnings resolved
```

#### `src/components/onboarding/notification-permission-primer.tsx` (5 warnings)

✅ **FIXED** — Removed all `as any` casts from translation key props; string literals are already valid `TxKeyPath` types

#### `src/components/privacy-settings.tsx` (5 warnings)

✅ **FIXED** — Created `FileSystemWithDirectories` type for FileSystem directory access; created `PlatformError` type for error handling with proper optional properties
159:18 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any
160:19 warning Unexpected any. Specify a different type @typescript-eslint/no-explicit-any

````

#### `src/components/strains/filter-modal.tsx` (5 warnings)

✅ **FIXED** — Removed `as any` casts from translation keys (template literals are valid TxKeyPath); replaced `React.forwardRef<any, ...>` with `React.forwardRef<React.ElementRef<typeof Modal>, ...>`

#### `src/lib/analytics.ts` (5 warnings)

✅ **FIXED** — Created `StoredEvent` type for InMemoryMetrics event storage; replaced `as any` with `Record<string, unknown>` in sanitization functions

#### `src/lib/hooks/use-root-startup.ts` (5 warnings)

```.text
23:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
25:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
36:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
38:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
45:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/i18n/utils.tsx` (5 warnings)

```.text
30:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
32:71  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
33:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
43:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
54:61  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/log-sanitizer.ts` (5 warnings)

```.text
46:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
46:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
49:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
49:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
83:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/outbox.ts` (5 warnings)

```.text
20:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
30:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
70:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
85:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
86:48  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/community/types.ts` (4 warnings)

```.text
26:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
61:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
72:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
73:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/assessment/assessment-feedback-sheet.tsx` (4 warnings)

```.text
28:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
30:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
33:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
33:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/nutrient/reservoir-form.tsx` (4 warnings)

```.text
38:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
43:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
48:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
54:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/playbooks/playbook-selection-card.tsx` (4 warnings)

```.text
36:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
37:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
114:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
166:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/shared/optional-blur-view.tsx` (4 warnings)

```.text
22:62  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
35:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
46:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/trichome/trichome-assessment-form.tsx` (4 warnings)

```.text
32:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
35:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
36:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
93:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/community/outbox-processor.ts` (4 warnings)

```.text
110:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
135:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
254:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
299:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/hooks/use-mfa-management.ts` (4 warnings)

```.text
57:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
106:17  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
108:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
159:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/security/key-manager.ts` (4 warnings)

```.text
24:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
26:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
28:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
30:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/security/secure-storage.ts` (4 warnings)

```.text
18:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
20:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
22:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
24:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/security/storage-auditor.ts` (4 warnings)

```.text
28:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
30:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
32:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
34:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/watermelon-models/ai-second-opinions-queue.ts` (4 warnings)

```.text
22:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
34:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
38:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
51:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/index.tsx` (3 warnings)

```.text
68:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
120:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
135:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/calendar/agenda-item.tsx` (0 warnings)

✅ Created AgendaItemMetadata type for metadata fields (eventType, outOfRange, needsReview). Replaced all `as any` casts with `as AgendaItemMetadata` type assertions for safe property access.

#### `src/components/inputs.tsx` (0 warnings)

✅ Replaced all `as any` casts with `as TxKeyPath` for translation keys in accessibilityHint props.

#### `src/components/nutrient/reservoir-event-form.tsx` (0 warnings)

✅ Replaced all `any` types in component props with proper react-hook-form types: `Control<EventFormData>` and `FieldErrors<EventFormData>` for PHDeltaField, ECDeltaField, and FormFields components.

#### `src/components/playbooks/phase-timeline.tsx` (0 warnings)

✅ Imported `TFunction` from i18next and replaced all `any` translation function parameters with proper `TFunction` type. Replaced `as any` cast in status validation with proper type inference using `(typeof validStatuses)[number]`.

#### `src/components/strains/strain-card.tsx` (0 warnings)

✅ Replaced `any` types with proper types: changed `itemY?: any` to `itemY?: number`, and replaced `scaledSizes: any` and `spacing: any` with proper return types from `useDynamicType` and `useResponsiveSpacing` hooks using `ReturnType<typeof ...>`.

#### `src/lib/community/idempotency-service.ts` (0 warnings)

✅ Created `IdempotencyKeyRecord` type for database records with proper status union type and optional fields. Replaced all `any` types: `checkExistingKey` returns `IdempotencyKeyRecord | null`, `handleCompletedKey` accepts `IdempotencyKeyRecord`, and `markAsCompleted` result parameter changed to `unknown`.

#### `src/lib/i18n/index.tsx` (3 warnings)

```.text
16:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
26:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
92:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ Replaced all `any` usages: (1) Used `{ jest?: unknown }` type for globalThis in test environment checks (lines 16, 92), (2) Removed unnecessary Promise-like check since `getLanguage()` returns `string | undefined` synchronously (line 26).

#### `src/lib/performance/rn-performance.ts` (3 warnings)

```.text
14:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
66:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
105:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ Replaced all `any` usages with `RNPerformanceReport` type: (1) Updated `PerformanceMeasureModule` type definition (line 14), (2) Typed `handleReportPrepared` callback parameter (line 66), (3) Used proper type assertion with `React.PropsWithChildren` for `PerformanceMeasureView` (line 105).

#### `src/lib/rrule/iterator.ts` (3 warnings)

```.text
44:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
66:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
124:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ Replaced all `any` usages with `DateTime` from Luxon: (1) Typed `dtstartLocal` in `processDaily` context (line 44), (2) Typed `dtstartLocal` in `processWeekly` context (line 66), (3) Typed `cursorLocal` in `shouldStopIteration` context (line 124).

#### `src/lib/watermelon-indexes.ts` (3 warnings)

```.text
4:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
62:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
67:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ Replaced all `any` usages with proper types: (1) Imported `SQLiteQuery` type from `unsafe-sql-utils` instead of defining with `any[]` (line 4), (2) Used `DatabaseAdapterWithUnsafe` type for adapter type checking (line 62), (3) Typed `initializingPromise` as `PromiseLike<void>` (line 67).

#### `src/types/moderation.ts` (3 warnings)

```.text
450:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
552:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
575:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ Replaced all `any` usages with `unknown`: (1) Changed `metadata` field in `AuditEvent` interface to `Record<string, unknown>` (line 552), (2) Changed `metadata` field in `AuditEventInput` interface to `Record<string, unknown>` (line 575). Note: Line 450 already used `unknown`, not `any`.

#### `src/api/auth/use-sign-in.ts` (2 warnings)

```.text
70:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
117:64  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ Replaced all `any` usages with proper metadata type: (1) Typed error metadata in mutation function with `lockout` and `minutes_remaining` fields (line 70), (2) Typed error metadata in onError callback (line 117). Also fixed `AuthErrorResponse.metadata` in types.ts to use the same structure.

#### `src/api/community/use-create-comment.ts` (2 warnings)

```.text
52:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
53:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ Replaced all `any` usages in `hasErrorCode` type guard: (1) Removed unnecessary cast for `'code' in e` check (line 52), (2) Used `Record<string, unknown>` for property access (line 53).

#### `src/api/ph-ec-readings/index.ts` (2 warnings)

```.text
131:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
293:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ Replaced all `any` usages: (1) Typed `whereFilters` as `Clause[]` from WatermelonDB (line 131), (2) Created `ServerReading` type for API response mapping with proper snake_case to camelCase field mapping (line 293).

#### `src/api/strains/use-strains-infinite-with-cache.ts` (2 warnings)

```.text
41:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
150:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ Replaced all `any` usages: (1) Typed `params` as `UseStrainsInfiniteWithCacheParams | undefined` with null check before use (line 41), (2) Typed `error` as `Error` in retry callback (line 150).

#### `src/api/support/use-help-articles.ts` (2 warnings)

```.text
183:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
213:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/templates/use-templates.ts` (2 warnings)

```.text
18:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
43:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/(app)/strains.tsx` (2 warnings)

```.text
40:73  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
418:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/(app)/strains/favorites.tsx` (2 warnings)

```.text
31:73  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
224:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/privacy-and-data.tsx` (2 warnings)

```.text
59:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
60:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/security.tsx` (2 warnings)

```.text
133:16  warning  Function 'SecuritySettingsScreen' has too many lines (200). Maximum allowed is 150  max-lines-per-function
152:14  warning  Unexpected any. Specify a different type                                            @typescript-eslint/no-explicit-any
```

#### `src/components/harvest/harvest-history-empty.tsx` (2 warnings)

```.text
47:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
50:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/harvest/weight-chart-table.tsx` (2 warnings)

```.text
35:6  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
36:9  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/inventory/csv/import-csv-button.tsx` (2 warnings)

```.text
78:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
82:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/onboarding/onboarding-buttons.tsx` (2 warnings)

```.text
39:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
67:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/onboarding/pagination-dots.tsx` (2 warnings)

```.text
10:44  warning  'C:\Users\Peter\GrowBro\node_modules\react-native-reanimated\lib\module\index.js' imported multiple times  import/no-duplicates
11:24  warning  'C:\Users\Peter\GrowBro\node_modules\react-native-reanimated\lib\module\index.js' imported multiple times  import/no-duplicates
```

#### `src/components/playbooks/save-template-prompt.tsx` (2 warnings)

```.text
34:6  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
65:6  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/playbooks/task-edit-modal.tsx` (2 warnings)

```.text
27:63  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
47:62  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/shared/custom-cell-renderer-component.tsx` (2 warnings)

```.text
23:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
23:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/strains/custom-cell-renderer-component.tsx` (2 warnings)

```.text
13:49  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
35:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/strains/filter-chips.tsx` (2 warnings)

```.text
60:62  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
68:74  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/strains/sort-menu.tsx` (2 warnings)

```.text
51:48  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
142:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/performance/navigation-instrumentation.ts` (2 warnings)

```.text
38:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
49:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/quality/remote-config.ts` (2 warnings)

```.text
299:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
299:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/security/device-fingerprint.ts` (2 warnings)

```.text
39:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
39:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/task-notification-usage-example.ts` (2 warnings)

```.text
11:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
39:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/watermelon-migrations.ts` (2 warnings)

```.text
6:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
12:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/watermelon-models/profile.ts` (2 warnings)

```.text
55:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
86:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `scripts/ci/generate-performance-report.ts` (1 warnings)

```.text
143:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `scripts/validate-dsa-compliance.ts` (1 warnings)

```.text
52:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/auth/types.ts` (1 warnings)

```.text
76:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/auth/use-request-account-deletion.ts` (1 warnings)

```.text
131:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/common/client.tsx` (1 warnings)

```.text
19:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/common/utils.tsx` (1 warnings)

```.text
4:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/moderation/conflict-of-interest-api.ts` (1 warnings)

```.text
85:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/posts/use-posts-infinite.ts` (1 warnings)

```.text
46:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/strains/use-strain.ts` (1 warnings)

```.text
29:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/(app)/calendar.tsx` (1 warnings)

```.text
104:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/(app)/inventory/index.tsx` (1 warnings)

```.text
32:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/storage.tsx` (0 warnings)

✅ Replaced `any` with `Record<string, unknown>` for translation options parameter in ScreenContent component

#### `src/components/auth/login-form.tsx` (0 warnings)

✅ Replaced `any` with `unknown` for error parameter in Apple sign-in handler and added proper type guard for error.code access

#### `src/components/auth/re-auth-modal.tsx` (0 warnings)

✅ Replaced `any` with `BottomSheetModal` type for forwardRef

#### `src/components/calendar/agenda-list.tsx` (0 warnings)

✅ Replaced `any` with proper `FlashListRef<AgendaItem>` type cast for listRef

#### `src/components/calendar/day-sortable-list.tsx` (0 warnings)

✅ Replaced `any` with proper scrollable ref type for scrollableRef parameter

#### `src/components/calendar/draggable-agenda-item.tsx` (0 warnings)

✅ Replaced `any` with proper type assertion `Task & { metadata?: Record<string, unknown> }` for task metadata access

#### `src/components/calendar/sortable-day-view.example.tsx` (0 warnings)

✅ Replaced `any` with proper scrollable ref type for scrollRef

#### `src/components/card.tsx` (0 warnings)

✅ Replaced `e: any` in handleLikePress with `{ stopPropagation?: () => void }` interface. Used optional chaining instead of typeof check.

#### `src/components/community/age-restricted-content-placeholder.tsx` (0 warnings)

✅ Replaced `as any` with proper union type for dynamic translation keys: `'community.content_type.post' | 'community.content_type.comment' | 'community.content_type.image'`

#### `src/components/community/comment-form.tsx` (0 warnings)

✅ Replaced `React.useRef<any>` with `React.useRef<TextInput>` for inputRef. Added TextInput import from react-native.

#### `src/components/community/community-error-boundary.tsx` (0 warnings)

✅ Replaced `info: any` with `info: ErrorInfo` in handleError callback. Added ErrorInfo import from React.

#### `src/components/consent-modal.tsx` (0 warnings)

✅ Replaced `(c as any)?.[k]` with direct property access on typed `ConsentState`. Added ConsentState import from consent-types.

#### `src/components/harvest/stage-timer-progress.tsx` (0 warnings)

✅ Replaced `options?: any` with `options?: Record<string, unknown>` in translation function type.

#### `src/components/harvest/weight-chart.tsx` (0 warnings)

✅ Replaced `chartData: any[]` with `chartData: LineChartDataPoint[]`. Created LineChartDataPoint type with value, label, and dataPointText properties.

#### `src/components/home/activation-checklist.tsx` (0 warnings)

✅ Removed `as Href` type assertion - router.push accepts string paths directly

#### `src/components/inventory/consumption-trend-chart.tsx` (0 warnings)

✅ Replaced any with ChartConfig type including ChartDataPoint interface

#### `src/components/inventory/csv/export-csv-button.tsx` (0 warnings)

✅ Added FileSystemWithCacheDirectory type and used safeFileSystem pattern

#### `src/components/inventory/inventory-list.tsx` (0 warnings)

✅ Replaced any with FlashListRef<InventoryItemWithStock> type

#### `src/components/legal-confirmation-modal.tsx` (0 warnings)

✅ Removed `as any` cast from translate() call - key is valid TxKeyPath

#### `src/components/moderation/jurisdiction-selector.tsx` (0 warnings)

✅ Made component generic with FieldValues constraint, used Path<T> for name prop

#### `src/components/navigation/shared-header.tsx` (0 warnings)

✅ Replaced `(Animated as any).useDerivedValue` with direct `useDerivedValue` import and usage

#### `src/components/nutrient-engine/phase-header.tsx` (0 warnings)

✅ Replaced Control<any> with Control<FeedingTemplateFormData> - component is tightly coupled to this form structure

#### `src/components/onboarding/onboarding-pager.tsx` (1 warnings)

```.text
54:8  warning  Function 'OnboardingPager' has too many lines (111). Maximum allowed is 110  max-lines-per-function
```

#### `src/components/strains/favorites-sort-menu.tsx` (1 warnings)

```.text
108:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `React.ElementRef<typeof Modal>` for forwardRef type

#### `src/components/trichome/trichome-guide-card.tsx` (1 warnings)

```.text
18:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `TrichomeGuide['stages'][number]` for stage prop type

#### `src/components/ui/button.tsx` (1 warnings)

```.text
139:61  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `TxKeyPath` for translate function parameter

#### `src/components/ui/list.tsx` (1 warnings)

```.text
221:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `ListRenderItemInfo<ItemT>` for renderItem callback

#### `src/components/ui/modal.tsx` (1 warnings)

```.text
63:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `Record<string, unknown>` for modal present data parameter

#### `src/lib/animations/stagger.ts` (1 warnings)

```.text
37:4  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `ReturnType<typeof FadeIn.delay>` for animation return type

#### `src/lib/auth/session-manager.ts` (1 warnings)

```.text
374:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Added `SupabaseRealtimePayload` type and properly typed realtime event payload

#### `src/lib/hooks/use-conflict-resolution.ts` (1 warnings)

```.text
154:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `Record<string, unknown>` for dynamic field assignment

#### `src/lib/i18n/types.ts` (1 warnings)

```.text
19:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any[]` with `unknown[]` for array type checking

#### `src/lib/media/background-photo-cleanup.ts` (1 warnings)

```.text
46:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `ReturnType<typeof AppState.addEventListener>` for subscription type

#### `src/lib/media/photo-storage-helpers.ts` (1 warnings)

```.text
21:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `HarvestModel` type for harvest record

#### `src/lib/performance/sentry-integration.ts` (1 warnings)

```.text
32:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any[]` with `unknown[]` for Sentry integrations array and cast to proper type

#### `src/lib/quality/engine.ts` (1 warnings)

```.text
63:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with proper type checking for weight property access

#### `src/lib/strains/favorites-sync-queue.ts` (1 warnings)

```.text
107:57  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `FavoriteModel` type for database record creation

#### `src/lib/supabase.ts` (1 warnings)

```.text
98:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `Record<string, unknown>` for Database type placeholder

#### `src/lib/utils.ts` (1 warnings)

```.text
18:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `Record<string, () => unknown>` for dynamic selector assignment

#### `src/lib/watermelon-models/favorites-repository.ts` (1 warnings)

```.text
105:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Removed explicit `any[]` type annotation, TypeScript now infers correct type from Q.where() usage

#### `src/lib/watermelon-models/notification-preference.ts` (1 warnings)

```.text
56:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with proper type casting to `NotificationPreferenceModel` inside collection.create callback

#### `src/lib/watermelon-models/outbox-notification-action.ts` (1 warnings)

```.text
19:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `Record<string, any>` with `Record<string, unknown>` for data property in NotificationActionPayload

#### `src/types/community.ts` (1 warnings)

```.text
88:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `any` with `unknown` in OutboxPayload index signature

</details>

## Low Priority (Tier 4 — Tests, mocks, fixtures)

Total warnings: **1016**

| File                                                                                                    | Count |
| ------------------------------------------------------------------------------------------------------- | ----: |
| `__mocks__/@nozbe/watermelondb/index.ts`                                                                |    81 |
| `src/lib/__tests__/watermelon-migrations.test.ts`                                                       |    36 |
| `jest-setup.ts`                                                                                         |    33 |
| `src/lib/assessment/assessment-analytics.test.ts`                                                       |    29 |
| `src/lib/playbooks/playbook-service.test.ts`                                                            |    26 |
| `src/lib/inventory/__tests__/deduction-integration.test.ts`                                             |    25 |
| `src/lib/inventory/__tests__/cost-analysis-service.test.ts`                                             |    23 |
| `src/lib/playbooks/__tests__/ai-adjustment-service.test.ts`                                             |    23 |
| `src/lib/playbooks/i18n/__tests__/translations.test.ts`                                                 |    22 |
| `src/lib/nutrient-engine/services/source-water-profile-service.test.ts`                                 |    20 |
| `src/lib/notifications/push-service.test.ts`                                                            |    16 |
| `src/app/settings/delete-account-flow.test.tsx`                                                         |    13 |
| `src/lib/__tests__/sync-offline-e2e.test.ts`                                                            |    13 |
| `src/lib/watermelon-models/notification-preference.test.ts`                                             |    13 |
| `src/lib/__tests__/analytics.test.ts`                                                                   |    12 |
| `src/lib/nutrient-engine/services/reservoir-service.test.ts`                                            |    12 |
| `src/lib/playbooks/__tests__/ai-adjustments-integration.test.ts`                                        |    12 |
| `src/lib/rrule/rrule.test.ts`                                                                           |    12 |
| `src/components/strains/strains-list-with-cache.test.tsx`                                               |    10 |
| `src/lib/__tests__/sentry-utils.test.ts`                                                                |    10 |
| `src/lib/auth/user-utils.test.ts`                                                                       |    10 |
| `src/lib/__tests__/sync-conflict.test.ts`                                                               |     9 |
| `src/lib/assessment/__tests__/cloud-inference-client.test.ts`                                           |     9 |
| `src/lib/assessment/__tests__/execution-providers.test.ts`                                              |     9 |
| `src/lib/community/__tests__/offline-workflow-integration.test.ts`                                      |     9 |
| `src/lib/community/__tests__/offline-workflow.test.ts`                                                  |     9 |
| `__mocks__/@gorhom/bottom-sheet.tsx`                                                                    |     8 |
| `src/app/(app)/__tests__/_layout.test.tsx`                                                              |     8 |
| `src/components/moderation/sor-preview-panels.test.tsx`                                                 |     8 |
| `src/lib/__tests__/network-manager.test.ts`                                                             |     8 |
| `src/lib/harvest/harvest-notification-service.test.ts`                                                  |     8 |
| `src/lib/log-sanitizer.test.ts`                                                                         |     8 |
| `src/lib/moderation/pii-scrubber.test.ts`                                                               |     8 |
| `src/lib/nutrient-engine/services/reservoir-event-service.test.ts`                                      |     8 |
| `src/lib/nutrient-engine/services/schedule-adjustment-service.test.ts`                                  |     8 |
| `src/lib/task-notifications.test.ts`                                                                    |     8 |
| `scripts/lib/__tests__/cannabis-policy.test.ts`                                                         |     7 |
| `src/api/auth/use-request-account-deletion.test.tsx`                                                    |     7 |
| `src/lib/assessment/__tests__/image-storage.test.ts`                                                    |     7 |
| `src/lib/community/outbox-processor.test.ts`                                                            |     7 |
| `src/lib/moderation/__tests__/audit-retention-manager.test.ts`                                          |     7 |
| `src/lib/nutrient-engine/services/template-service.test.ts`                                             |     7 |
| `src/lib/outbox.test.ts`                                                                                |     7 |
| `src/lib/playbooks/task-generator.test.ts`                                                              |     7 |
| `src/lib/privacy/consent-service.test.ts`                                                               |     7 |
| `src/api/community/client.test.ts`                                                                      |     6 |
| `src/lib/__tests__/privacy-consent.test.ts`                                                             |     6 |
| `src/lib/__tests__/sync-manager.test.ts`                                                                |     6 |
| `src/lib/inventory/__tests__/inventory-sync-integration.test.ts`                                        |     6 |
| `src/lib/moderation/sor-submission-orchestrator.test.ts`                                                |     6 |
| `src/lib/utils/__tests__/flashlist-performance.test.tsx`                                                |     6 |
| `__mocks__/@nozbe/watermelondb/adapters/sqlite/index.ts`                                                |     5 |
| `__mocks__/@nozbe/watermelondb/decorators.ts`                                                           |     5 |
| `__mocks__/@shopify/flash-list.tsx`                                                                     |     5 |
| `__mocks__/expo-notifications.ts`                                                                       |     5 |
| `__mocks__/react-native-css-interop.ts`                                                                 |     5 |
| `__mocks__/storage-mock.ts`                                                                             |     5 |
| `src/components/harvest/harvest-chart-container.test.tsx`                                               |     5 |
| `src/components/moderation-actions.test.tsx`                                                            |     5 |
| `src/components/onboarding/permission-primer-screen.test.tsx`                                           |     5 |
| `src/components/sync/connectivity-banner.test.tsx`                                                      |     5 |
| `src/lib/__tests__/storage-manager.test.ts`                                                             |     5 |
| `src/lib/__tests__/watermelondb-plugin-config.test.ts`                                                  |     5 |
| `src/lib/assessment/__tests__/assessment-analytics-feedback.test.ts`                                    |     5 |
| `src/lib/auth/use-biometric-settings.test.tsx`                                                          |     5 |
| `src/lib/harvest/__tests__/edge-cases.test.ts`                                                          |     5 |
| `src/lib/inventory/__tests__/stock-monitoring-service.test.ts`                                          |     5 |
| `src/lib/moderation/__tests__/eprivacy-compliance.test.ts`                                              |     5 |
| `src/lib/moderation/sla-monitor-service.test.ts`                                                        |     5 |
| `src/lib/moderation/trusted-flagger-analytics.test.ts`                                                  |     5 |
| `src/lib/test-utils/react-test-renderer.d.ts`                                                           |     5 |
| `__mocks__/@nozbe/watermelondb/sync.ts`                                                                 |     4 |
| `__mocks__/expo-file-system.ts`                                                                         |     4 |
| `__mocks__/react-native-gesture-handler.ts`                                                             |     4 |
| `src/api/auth/use-auth-hooks.test.tsx`                                                                  |     4 |
| `src/app/settings/delete-account.test.tsx`                                                              |     4 |
| `src/lib/__tests__/template-manager.test.ts`                                                            |     4 |
| `src/lib/community/__tests__/cache-adapter.test.ts`                                                     |     4 |
| `src/lib/community/__tests__/event-deduplicator-comprehensive.test.ts`                                  |     4 |
| `src/lib/harvest/__tests__/harvest-redaction.test.ts`                                                   |     4 |
| `src/lib/harvest/inventory-service.test.ts`                                                             |     4 |
| `src/lib/moderation/sor-export-queue.test.ts`                                                           |     4 |
| `src/lib/nutrient-engine/services/diagnostic-service.test.ts`                                           |     4 |
| `src/lib/playbooks/template-saver.test.ts`                                                              |     4 |
| `__mocks__/nativewind.ts`                                                                               |     3 |
| `src/app/(app)/__tests__/community.test.tsx`                                                            |     3 |
| `src/app/notifications/__tests__/index.test.tsx`                                                        |     3 |
| `src/app/settings/__tests__/privacy-and-data.test.tsx`                                                  |     3 |
| `src/components/navigation/custom-tab-bar.test.tsx`                                                     |     3 |
| `src/lib/__tests__/conflict-resolver.test.ts`                                                           |     3 |
| `src/lib/__tests__/plant-telemetry.test.ts`                                                             |     3 |
| `src/lib/assessment/__tests__/cloud-inference-flow.test.ts`                                             |     3 |
| `src/lib/auth/__tests__/key-rotation.test.ts`                                                           |     3 |
| `src/lib/community/__tests__/event-deduplicator.test.ts`                                                |     3 |
| `src/lib/community/__tests__/metrics-tracker.test.ts`                                                   |     3 |
| `src/lib/compliance/app-access-manager.test.ts`                                                         |     3 |
| `src/lib/inventory/__tests__/forecasting-service.test.ts`                                               |     3 |
| `src/lib/moderation/__tests__/dsa-transparency-client.test.ts`                                          |     3 |
| `src/lib/moderation/__tests__/misuse-detection.test.ts`                                                 |     3 |
| `src/lib/notifications/community-notification-service.test.ts`                                          |     3 |
| `src/lib/notifications/push-receiver-service.test.ts`                                                   |     3 |
| `src/lib/playbooks/sanitize-playbook.test.ts`                                                           |     3 |
| `src/lib/privacy/consent-service.hasConsent.test.ts`                                                    |     3 |
| `src/lib/quality/remote-config.test.ts`                                                                 |     3 |
| `src/lib/schemas/moderation-schemas.test.ts`                                                            |     3 |
| `src/lib/watermelon-models/__tests__/cached-strain.test.ts`                                             |     3 |
| `src/lib/watermelon-models/__tests__/favorite.test.ts`                                                  |     3 |
| `__mocks__/@nozbe/watermelondb/Schema/migrations.ts`                                                    |     2 |
| `src/api/strains/client.test.ts`                                                                        |     2 |
| `src/api/strains/use-strain.test.tsx`                                                                   |     2 |
| `src/api/strains/use-strains-infinite.test.tsx`                                                         |     2 |
| `src/app/(app)/__tests__/strains.test.tsx`                                                              |     2 |
| `src/app/settings/__tests__/accessibility-audit.test.tsx`                                               |     2 |
| `src/app/settings/about.test.tsx`                                                                       |     2 |
| `src/components/harvest/weight-chart.test.tsx`                                                          |     2 |
| `src/components/inventory/__tests__/consumption-history-list.test.tsx`                                  |     2 |
| `src/components/privacy-settings.test.tsx`                                                              |     2 |
| `src/lib/__tests__/background-sync.test.ts`                                                             |     2 |
| `src/lib/__tests__/error-handling.test.ts`                                                              |     2 |
| `src/lib/__tests__/notifications-permission-gate.e2e.test.ts`                                           |     2 |
| `src/lib/__tests__/sync-performance.test.ts`                                                            |     2 |
| `src/lib/__tests__/telemetry-client.test.ts`                                                            |     2 |
| `src/lib/assessment/__tests__/model-manager.test.ts`                                                    |     2 |
| `src/lib/auth/__tests__/auth-telemetry.test.ts`                                                         |     2 |
| `src/lib/community/__tests__/realtime-manager.test.ts`                                                  |     2 |
| `src/lib/moderation/__tests__/integration-workflows.test.ts`                                            |     2 |
| `src/lib/moderation/age-verification-service.test.ts`                                                   |     2 |
| `src/lib/moderation/content-age-gating.test.ts`                                                         |     2 |
| `src/lib/moderation/trusted-flagger-service.test.ts`                                                    |     2 |
| `src/lib/navigation/deep-link-gate.test.ts`                                                             |     2 |
| `src/lib/notifications/grouping-service.test.ts`                                                        |     2 |
| `src/lib/notifications/notification-manager.test.ts`                                                    |     2 |
| `src/lib/notifications/notification-storage.test.ts`                                                    |     2 |
| `src/lib/nutrient-engine/services/calibration-reminder.test.ts`                                         |     2 |
| `src/lib/playbooks/errors/messages.test.ts`                                                             |     2 |
| `src/lib/support/help-article-cache.test.ts`                                                            |     2 |
| `src/lib/task-notifications-permission-gate.test.ts`                                                    |     2 |
| `__mocks__/@shopify/react-native-performance.ts`                                                        |     1 |
| `__mocks__/expo-linear-gradient.ts`                                                                     |     1 |
| `__mocks__/react-native-css-interop/runtime/third-party-libs/react-native-safe-area-context.native.tsx` |     1 |
| `scripts/lib/__tests__/prelaunch.test.ts`                                                               |     1 |
| `src/api/community/use-like-post.test.ts`                                                               |     1 |
| `src/api/strains/use-prefetch-strain.test.ts`                                                           |     1 |
| `src/app/__tests__/add-post.test.tsx`                                                                   |     1 |
| `src/app/__tests__/calendar-works-without-notifications.test.tsx`                                       |     1 |
| `src/app/__tests__/sentry-init.test.tsx`                                                                |     1 |
| `src/app/settings/__tests__/performance.test.tsx`                                                       |     1 |
| `src/app/settings/support/feedback.test.tsx`                                                            |     1 |
| `src/components/calendar/draggable-agenda-item.test.tsx`                                                |     1 |
| `src/components/consent-manager.test.tsx`                                                               |     1 |
| `src/components/login-form.test.tsx`                                                                    |     1 |
| `src/components/nutrient/ph-ec-line-chart.test.tsx`                                                     |     1 |
| `src/components/playbooks/__tests__/playbook-selection-card.test.tsx`                                   |     1 |
| `src/components/playbooks/phase-timeline.test.tsx`                                                      |     1 |
| `src/components/playbooks/share-template-modal.test.tsx`                                                |     1 |
| `src/components/settings/legal-document-viewer.test.tsx`                                                |     1 |
| `src/components/strains/filter-modal.test.tsx`                                                          |     1 |
| `src/components/strains/strain-card.test.tsx`                                                           |     1 |
| `src/lib/__tests__/ics.test.ts`                                                                         |     1 |
| `src/lib/__tests__/permissions-and-alarms.test.ts`                                                      |     1 |
| `src/lib/__tests__/sentry-pii-leak-sentinel.test.ts`                                                    |     1 |
| `src/lib/__tests__/sync-engine.test.ts`                                                                 |     1 |
| `src/lib/__tests__/sync-status.test.tsx`                                                                |     1 |
| `src/lib/assessment/__tests__/image-cache-manager.test.ts`                                              |     1 |
| `src/lib/assessment/__tests__/result-aggregation.test.ts`                                               |     1 |
| `src/lib/assessment/retake-guidance.test.ts`                                                            |     1 |
| `src/lib/auth/__tests__/settings-deep-links.test.ts`                                                    |     1 |
| `src/lib/auth/index.test.tsx`                                                                           |     1 |
| `src/lib/compliance/dpa-manager.test.ts`                                                                |     1 |
| `src/lib/harvest/harvest-error-handler.test.ts`                                                         |     1 |
| `src/lib/harvest/harvest-service.test.ts`                                                               |     1 |
| `src/lib/hooks/use-notification-preferences.test.ts`                                                    |     1 |
| `src/lib/inventory/__tests__/batch-picking-service.test.ts`                                             |     1 |
| `src/lib/inventory/__tests__/harvest-cost-calculator.test.ts`                                           |     1 |
| `src/lib/inventory/__tests__/inventory-valuation-service.test.ts`                                       |     1 |
| `src/lib/inventory/__tests__/use-consumption-analytics.test.ts`                                         |     1 |
| `src/lib/moderation/__tests__/age-verification-security.test.ts`                                        |     1 |
| `src/lib/moderation/__tests__/audit-service.test.ts`                                                    |     1 |
| `src/lib/moderation/config/moderation-config.test.ts`                                                   |     1 |
| `src/lib/moderation/moderation-queue.test.ts`                                                           |     1 |
| `src/lib/moderation/monitoring-service.test.ts`                                                         |     1 |
| `src/lib/moderation/transparency-service.test.ts`                                                       |     1 |
| `src/lib/moderation/validation.test.ts`                                                                 |     1 |
| `src/lib/nutrient-engine/services/alert-notification-service.test.ts`                                   |     1 |
| `src/lib/nutrient-engine/services/calendar-integration-service.test.ts`                                 |     1 |
| `src/lib/performance/__tests__/memory-monitor.test.ts`                                                  |     1 |
| `src/lib/performance/__tests__/time-series-uploader.test.ts`                                            |     1 |
| `src/lib/privacy/crash-store.test.ts`                                                                   |     1 |
| `src/lib/privacy/deletion-gate.test.ts`                                                                 |     1 |
| `src/lib/privacy/export-service.test.ts`                                                                |     1 |
| `src/lib/privacy/retention-freshness.test.ts`                                                           |     1 |
| `src/lib/privacy/telemetry-client.test.ts`                                                              |     1 |
| `src/lib/security/secure-storage.test.ts`                                                               |     1 |
| `src/lib/sentry-utils.test.ts`                                                                          |     1 |
| `src/lib/strains/__tests__/performance.test.tsx`                                                        |     1 |
| `src/lib/sync/__tests__/sync-worker.test.ts`                                                            |     1 |
| `src/lib/uploads/__tests__/ai-images.test.ts`                                                           |     1 |

<details>
<summary>Detailed warnings</summary>

#### `__mocks__/@nozbe/watermelondb/index.ts` (81 warnings)

```.text
61:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
62:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
63:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
64:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
65:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
66:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
77:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
98:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
98:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
101:17  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
101:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
104:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
104:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
110:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
110:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
113:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
113:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
134:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
136:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
138:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
154:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
159:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
159:61  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
167:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
174:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
176:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
178:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
180:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
182:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
185:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
208:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
213:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
215:4   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
217:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
218:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
224:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
224:54  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
228:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
230:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
232:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
243:17  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
248:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
258:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
302:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
303:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
310:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
337:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
338:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
360:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
361:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
382:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
383:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
407:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
408:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
427:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
428:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
450:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
451:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
477:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
478:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
501:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
502:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
554:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
555:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
576:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
577:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
603:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
604:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
626:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
628:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
632:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
641:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
666:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
667:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
689:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
691:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
722:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
732:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
735:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
736:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
737:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/watermelon-migrations.test.ts` (36 warnings)

```.text
6:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
7:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
15:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
15:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
19:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
19:57  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
20:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
23:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
24:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
25:9   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
32:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
32:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
35:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
42:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
48:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
48:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
69:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
69:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
122:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
123:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
141:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
145:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
152:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
153:48  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
186:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
201:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
215:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
228:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
235:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
239:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
240:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
249:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
254:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
260:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
265:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
268:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `jest-setup.ts` (33 warnings)

```.text
16:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
17:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
58:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
107:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
126:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
126:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
142:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
148:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
159:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
160:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
161:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
162:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
182:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
183:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
189:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
202:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
203:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
260:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
261:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
292:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
336:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
342:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
349:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
350:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
363:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
439:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
480:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
503:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
505:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
508:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
535:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
553:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
555:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/assessment-analytics.test.ts` (29 warnings)

```.text
17:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
17:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
23:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
24:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
25:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
28:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
33:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
110:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
111:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
151:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
152:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
193:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
194:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
239:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
240:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
265:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
266:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
309:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
310:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
362:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
403:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
424:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
439:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
482:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
521:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
541:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
559:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
574:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
603:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/playbook-service.test.ts` (26 warnings)

```.text
34:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
35:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
55:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
81:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
82:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
84:48  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
97:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
115:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
144:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
147:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
212:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
250:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
258:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
269:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
277:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
288:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
296:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
328:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
372:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
397:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
405:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
426:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
434:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
442:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
463:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
497:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/__tests__/deduction-integration.test.ts` (25 warnings)

```.text
32:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
70:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
85:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
118:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
123:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
137:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
176:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
193:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
206:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
232:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
238:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
243:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
260:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
284:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
300:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
327:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
342:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
375:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
389:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
431:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
470:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
487:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
501:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
537:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
542:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/__tests__/cost-analysis-service.test.ts` (23 warnings)

```.text
29:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
76:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
81:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
83:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
120:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
125:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
127:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
165:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
170:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
172:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
222:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
229:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
231:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
266:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
268:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
309:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
316:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
318:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
351:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
353:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
394:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
401:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
403:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/__tests__/ai-adjustment-service.test.ts` (23 warnings)

```.text
25:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
62:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
83:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
119:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
122:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
124:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
155:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
158:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
160:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
190:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
193:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
195:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
271:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
274:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
277:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
280:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
282:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
347:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
350:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
353:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
355:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
375:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
394:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/i18n/__tests__/translations.test.ts` (22 warnings)

```.text
8:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
50:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
70:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
113:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
155:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
175:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
218:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
219:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
226:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
229:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
237:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
240:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
248:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
251:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
259:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
262:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
270:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
273:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
282:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
291:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
300:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
301:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/source-water-profile-service.test.ts` (20 warnings)

```.text
150:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
153:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
182:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
185:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
217:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
220:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
250:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
253:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
291:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
294:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
328:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
331:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
356:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
359:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
376:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
386:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
407:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
423:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
445:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
474:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/push-service.test.ts` (16 warnings)

```.text
16:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
18:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
21:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
41:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
42:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
67:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
103:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
146:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
155:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
164:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
208:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
211:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
231:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
251:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
277:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/delete-account-flow.test.tsx` (13 warnings)

```.text
79:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
182:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
274:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
275:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
304:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
305:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
334:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
364:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
386:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
416:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
417:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
446:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
447:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/sync-offline-e2e.test.ts` (13 warnings)

```.text
72:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
93:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
112:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
134:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
186:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
190:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
194:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
208:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
235:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
298:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
299:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
300:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
303:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/watermelon-models/notification-preference.test.ts` (13 warnings)

```.text
10:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:73  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
34:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
46:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
53:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
66:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
80:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
90:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
97:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
106:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
122:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
126:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
140:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/analytics.test.ts` (12 warnings)

```.text
16:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
126:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
127:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
128:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
205:73  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
210:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
238:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
293:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
331:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
349:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
366:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
385:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/reservoir-service.test.ts` (12 warnings)

```.text
39:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
42:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
154:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
157:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
182:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
208:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
230:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
233:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
259:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
262:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
286:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
289:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/__tests__/ai-adjustments-integration.test.ts` (12 warnings)

```.text
29:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
111:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
114:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
117:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
120:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
122:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
227:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
230:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
233:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
236:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
238:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
293:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/rrule/rrule.test.ts` (12 warnings)

```.text
59:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
74:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
80:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
86:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
103:71  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
111:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
112:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
130:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
139:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
223:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
251:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
281:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/strains/strains-list-with-cache.test.tsx` (10 warnings)

```.text
30:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
50:6   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
56:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
122:59  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
131:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
140:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
156:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
169:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
279:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
299:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/sentry-utils.test.ts` (10 warnings)

```.text
9:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
10:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
16:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
18:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
25:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
28:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
40:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
41:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
48:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
57:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/auth/user-utils.test.ts` (10 warnings)

```.text
33:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
44:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
58:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
72:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
89:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
99:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
109:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
122:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
162:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
176:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/sync-conflict.test.ts` (9 warnings)

```.text
8:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
8:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
12:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
14:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
18:62  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
19:69  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
35:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
37:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
42:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/__tests__/cloud-inference-client.test.ts` (9 warnings)

```.text
50:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
52:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
54:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
136:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
140:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
150:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
177:68  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
229:68  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
241:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/__tests__/execution-providers.test.ts` (9 warnings)

```.text
29:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
51:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
74:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
82:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
92:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
97:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
117:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
124:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
132:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/community/__tests__/offline-workflow-integration.test.ts` (9 warnings)

```.text
51:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
257:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
337:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
413:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
435:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
535:7   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
536:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
538:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
559:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/community/__tests__/offline-workflow.test.ts` (9 warnings)

```.text
46:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
47:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
149:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
150:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
253:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
338:7   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
339:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
341:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
361:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/@gorhom/bottom-sheet.tsx` (8 warnings)

```.text
98:63  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
105:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
124:63  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
131:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
203:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
238:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
239:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
266:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/(app)/__tests__/_layout.test.tsx` (8 warnings)

```.text
7:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
8:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
11:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
12:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
14:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
19:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
26:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/moderation/sor-preview-panels.test.tsx` (8 warnings)

```.text
54:59  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
56:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
61:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
68:59  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
70:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
74:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
81:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
82:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/network-manager.test.ts` (8 warnings)

```.text
16:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
17:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
26:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
39:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
49:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
49:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
51:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
89:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/harvest/harvest-notification-service.test.ts` (8 warnings)

```.text
35:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
72:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
76:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
76:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
91:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
249:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
253:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
253:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/log-sanitizer.test.ts` (8 warnings)

```.text
20:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
22:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
33:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
39:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
40:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
43:54  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
53:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
54:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/pii-scrubber.test.ts` (8 warnings)

```.text
69:69  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
133:71  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
183:71  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
216:71  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
257:71  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
298:71  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
339:71  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
383:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/reservoir-event-service.test.ts` (8 warnings)

```.text
51:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
52:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
93:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
94:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
123:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
136:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
153:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
524:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/schedule-adjustment-service.test.ts` (8 warnings)

```.text
27:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
44:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
208:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
220:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
249:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
259:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
302:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
324:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/task-notifications.test.ts` (8 warnings)

```.text
36:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
64:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
77:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
88:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
141:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
148:57  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
198:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
199:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `scripts/lib/__tests__/cannabis-policy.test.ts` (7 warnings)

```.text
67:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
99:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
113:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
121:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
134:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
290:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
294:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/auth/use-request-account-deletion.test.tsx` (7 warnings)

```.text
150:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
166:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
185:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
338:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
349:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
445:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
459:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/__tests__/image-storage.test.ts` (7 warnings)

```.text
23:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
26:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
49:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
50:48  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
50:61  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
95:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/community/outbox-processor.test.ts` (7 warnings)

```.text
42:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
182:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
209:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
348:7   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
349:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
351:11  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
372:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/__tests__/audit-retention-manager.test.ts` (7 warnings)

```.text
27:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
28:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
303:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
310:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
370:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
375:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
382:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/template-service.test.ts` (7 warnings)

```.text
50:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
57:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
60:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
313:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
400:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
401:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
444:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/outbox.test.ts` (7 warnings)

```.text
5:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
33:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
41:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
78:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
117:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/task-generator.test.ts` (7 warnings)

```.text
26:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
33:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
45:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
65:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
66:17  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
72:66  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
73:17  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/privacy/consent-service.test.ts` (7 warnings)

```.text
18:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
51:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
73:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
111:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
119:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
138:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
163:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/community/client.test.ts` (6 warnings)

```.text
25:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
71:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
378:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
680:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
714:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
742:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/privacy-consent.test.ts` (6 warnings)

```.text
4:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
7:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
9:57  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
32:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
42:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
50:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/sync-manager.test.ts` (6 warnings)

```.text
11:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
14:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
20:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
23:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
25:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
43:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/__tests__/inventory-sync-integration.test.ts` (6 warnings)

```.text
12:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
13:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
14:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
30:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
31:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
32:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/sor-submission-orchestrator.test.ts` (6 warnings)

```.text
149:59  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
150:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
215:59  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
242:59  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
274:59  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
325:59  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/utils/__tests__/flashlist-performance.test.tsx` (6 warnings)

```.text
25:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
112:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
122:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
186:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
288:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
387:48  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/@nozbe/watermelondb/adapters/sqlite/index.ts` (5 warnings)

```.text
3:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
5:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
10:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
11:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
20:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/@nozbe/watermelondb/decorators.ts` (5 warnings)

```.text
4:37  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
33:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
79:49  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
81:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/@shopify/flash-list.tsx` (5 warnings)

```.text
13:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
21:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
28:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
28:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
80:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/expo-notifications.ts` (5 warnings)

```.text
18:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
34:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
39:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
65:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
71:68  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/react-native-css-interop.ts` (5 warnings)

```.text
4:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
4:54  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
4:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
34:49  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
34:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/storage-mock.ts` (5 warnings)

```.text
25:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
26:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
41:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
43:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
44:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/harvest/harvest-chart-container.test.tsx` (5 warnings)

```.text
18:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
26:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
34:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
257:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
276:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/moderation-actions.test.tsx` (5 warnings)

```.text
34:71  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
37:69  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
40:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
43:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
108:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/onboarding/permission-primer-screen.test.tsx` (5 warnings)

```.text
14:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
15:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
17:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
18:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
19:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/sync/connectivity-banner.test.tsx` (5 warnings)

```.text
8:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
9:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
15:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
23:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/storage-manager.test.ts` (5 warnings)

```.text
201:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
258:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
258:49  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
263:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
291:54  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/watermelondb-plugin-config.test.ts` (5 warnings)

```.text
16:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
17:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
59:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
85:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
288:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/__tests__/assessment-analytics-feedback.test.ts` (5 warnings)

```.text
34:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
62:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
86:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
101:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
128:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/auth/use-biometric-settings.test.tsx` (5 warnings)

```.text
19:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
21:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
22:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
23:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
24:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/harvest/__tests__/edge-cases.test.ts` (5 warnings)

```.text
175:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
180:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
208:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
223:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
238:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/__tests__/stock-monitoring-service.test.ts` (5 warnings)

```.text
14:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
23:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
32:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
41:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
50:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/__tests__/eprivacy-compliance.test.ts` (5 warnings)

```.text
69:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
92:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
423:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
520:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
546:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/sla-monitor-service.test.ts` (5 warnings)

```.text
35:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
121:70  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
137:70  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
153:70  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
168:70  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/trusted-flagger-analytics.test.ts` (5 warnings)

```.text
256:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
271:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
426:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
465:61  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
488:61  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/test-utils/react-test-renderer.d.ts` (5 warnings)

```.text
11:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
17:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
18:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
21:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/@nozbe/watermelondb/sync.ts` (4 warnings)

```.text
6:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
10:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
15:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
16:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/expo-file-system.ts` (4 warnings)

```.text
21:8   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
50:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
50:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
60:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/react-native-gesture-handler.ts` (4 warnings)

```.text
7:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
32:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
38:15  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
44:19  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/auth/use-auth-hooks.test.tsx` (4 warnings)

```.text
84:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
105:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
244:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
879:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/delete-account.test.tsx` (4 warnings)

```.text
41:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
63:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
64:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
455:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/template-manager.test.ts` (4 warnings)

```.text
64:55  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
64:63  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
68:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
78:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/community/__tests__/cache-adapter.test.ts` (4 warnings)

```.text
4:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
17:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
36:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
62:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/community/__tests__/event-deduplicator-comprehensive.test.ts` (4 warnings)

```.text
130:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
169:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
219:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
268:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/harvest/__tests__/harvest-redaction.test.ts` (4 warnings)

```.text
143:63  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
153:69  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
295:62  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
305:74  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/harvest/inventory-service.test.ts` (4 warnings)

```.text
26:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
234:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
288:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
511:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/sor-export-queue.test.ts` (4 warnings)

```.text
15:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
55:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
76:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
92:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/diagnostic-service.test.ts` (4 warnings)

```.text
68:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
69:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
83:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
84:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/template-saver.test.ts` (4 warnings)

```.text
171:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
176:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
309:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
421:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/nativewind.ts` (3 warnings)

```.text
6:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
6:54  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
6:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/(app)/__tests__/community.test.tsx` (3 warnings)

```.text
36:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
72:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
77:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/notifications/__tests__/index.test.tsx` (3 warnings)

```.text
43:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
79:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
84:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/__tests__/privacy-and-data.test.tsx` (3 warnings)

```.text
11:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
43:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
49:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/navigation/custom-tab-bar.test.tsx` (3 warnings)

```.text
10:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
16:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
41:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/conflict-resolver.test.ts` (3 warnings)

```.text
258:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
259:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
260:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/plant-telemetry.test.ts` (3 warnings)

```.text
20:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
30:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
43:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/__tests__/cloud-inference-flow.test.ts` (3 warnings)

```.text
119:8  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
124:8  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
135:8  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/auth/__tests__/key-rotation.test.ts` (3 warnings)

```.text
132:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
134:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
136:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/community/__tests__/event-deduplicator.test.ts` (3 warnings)

```.text
44:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
128:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
129:17  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/community/__tests__/metrics-tracker.test.ts` (3 warnings)

```.text
20:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
21:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
109:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/compliance/app-access-manager.test.ts` (3 warnings)

```.text
40:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
41:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
55:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/__tests__/forecasting-service.test.ts` (3 warnings)

```.text
17:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
24:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
42:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/__tests__/dsa-transparency-client.test.ts` (3 warnings)

```.text
90:12  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
98:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
450:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/__tests__/misuse-detection.test.ts` (3 warnings)

```.text
24:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
25:61  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
27:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/community-notification-service.test.ts` (3 warnings)

```.text
15:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
18:6   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
33:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/push-receiver-service.test.ts` (3 warnings)

```.text
22:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
22:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
119:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/sanitize-playbook.test.ts` (3 warnings)

```.text
291:62  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
328:58  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
356:61  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/privacy/consent-service.hasConsent.test.ts` (3 warnings)

```.text
17:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
35:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
61:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/quality/remote-config.test.ts` (3 warnings)

```.text
228:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
251:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
266:46  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/schemas/moderation-schemas.test.ts` (3 warnings)

```.text
192:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
732:30  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
978:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/watermelon-models/__tests__/cached-strain.test.ts` (3 warnings)

```.text
14:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
14:67  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
16:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/watermelon-models/__tests__/favorite.test.ts` (3 warnings)

```.text
13:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
13:62  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
15:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/@nozbe/watermelondb/Schema/migrations.ts` (2 warnings)

```.text
1:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
2:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/strains/client.test.ts` (2 warnings)

```.text
39:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
45:61  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/strains/use-strain.test.tsx` (2 warnings)

```.text
165:54  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
183:51  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/strains/use-strains-infinite.test.tsx` (2 warnings)

```.text
24:6   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
83:59  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/(app)/__tests__/strains.test.tsx` (2 warnings)

```.text
45:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
59:23  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/__tests__/accessibility-audit.test.tsx` (2 warnings)

```.text
306:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
320:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/about.test.tsx` (2 warnings)

```.text
46:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
261:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/harvest/weight-chart.test.tsx` (2 warnings)

```.text
17:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
21:27  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/inventory/__tests__/consumption-history-list.test.tsx` (2 warnings)

```.text
22:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
25:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/privacy-settings.test.tsx` (2 warnings)

```.text
48:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
64:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/background-sync.test.ts` (2 warnings)

```.text
36:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
61:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/error-handling.test.ts` (2 warnings)

```.text
3:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
3:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/notifications-permission-gate.e2e.test.ts` (2 warnings)

```.text
13:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
37:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/sync-performance.test.ts` (2 warnings)

```.text
14:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
15:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Fixed type for sync performance test.

#### `src/lib/__tests__/telemetry-client.test.ts` (1 warnings)

```.text
74:28  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Delivered event buffers now typed as `TelemetryEvent[]`.
64:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

#### `src/lib/assessment/__tests__/model-manager.test.ts` (2 warnings)

```.text
117:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
213:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/auth/__tests__/auth-telemetry.test.ts` (2 warnings)

```.text
29:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
36:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/community/__tests__/realtime-manager.test.ts` (2 warnings)

```.text
23:22  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
114:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/__tests__/integration-workflows.test.ts` (2 warnings)

```.text
441:63  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
468:63  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/age-verification-service.test.ts` (2 warnings)

```.text
34:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
188:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/content-age-gating.test.ts` (2 warnings)

```.text
21:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
484:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/trusted-flagger-service.test.ts` (2 warnings)

```.text
279:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
368:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/navigation/deep-link-gate.test.ts` (2 warnings)

```.text
40:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
44:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/grouping-service.test.ts` (2 warnings)

```.text
200:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
200:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/notification-manager.test.ts` (2 warnings)

```.text
283:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
339:17  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/notifications/notification-storage.test.ts` (2 warnings)

```.text
25:16  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
103:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/calibration-reminder.test.ts` (2 warnings)

```.text
35:24  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
66:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/playbooks/errors/messages.test.ts` (2 warnings)

```.text
5:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
7:7   warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/support/help-article-cache.test.ts` (2 warnings)

```.text
65:56  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
67:36  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/task-notifications-permission-gate.test.ts` (2 warnings)

```.text
12:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
34:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/@shopify/react-native-performance.ts` (1 warnings)

```.text
7:54  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/expo-linear-gradient.ts` (1 warnings)

```.text
11:4  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `__mocks__/react-native-css-interop/runtime/third-party-libs/react-native-safe-area-context.native.tsx` (1 warnings)

```.text
6:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `scripts/lib/__tests__/prelaunch.test.ts` (1 warnings)

```.text
13:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/community/use-like-post.test.ts` (1 warnings)

```.text
45:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/api/strains/use-prefetch-strain.test.ts` (1 warnings)

```.text
34:59  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/__tests__/add-post.test.tsx` (1 warnings)

```.text
152:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/__tests__/calendar-works-without-notifications.test.tsx` (1 warnings)

```.text
62:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/__tests__/sentry-init.test.tsx` (1 warnings)

```.text
93:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/__tests__/performance.test.tsx` (1 warnings)

```.text
257:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/app/settings/support/feedback.test.tsx` (1 warnings)

```.text
31:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/calendar/draggable-agenda-item.test.tsx` (1 warnings)

```.text
24:6  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/consent-manager.test.tsx` (1 warnings)

```.text
38:42  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/login-form.test.tsx` (1 warnings)

```.text
18:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/nutrient/ph-ec-line-chart.test.tsx` (1 warnings)

```.text
20:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/playbooks/__tests__/playbook-selection-card.test.tsx` (1 warnings)

```.text
10:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/playbooks/phase-timeline.test.tsx` (1 warnings)

```.text
12:33  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/playbooks/share-template-modal.test.tsx` (1 warnings)

```.text
10:32  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/settings/legal-document-viewer.test.tsx` (1 warnings)

```.text
192:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/strains/filter-modal.test.tsx` (1 warnings)

```.text
15:41  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/components/strains/strain-card.test.tsx` (1 warnings)

```.text
14:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/ics.test.ts` (1 warnings)

```.text
19:14  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/permissions-and-alarms.test.ts` (1 warnings)

```.text
9:50  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/sentry-pii-leak-sentinel.test.ts` (1 warnings)

```.text
352:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/sync-engine.test.ts` (1 warnings)

```.text
275:45  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/__tests__/sync-status.test.tsx` (1 warnings)

```.text
12:70  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/__tests__/image-cache-manager.test.ts` (1 warnings)

```.text
13:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/__tests__/result-aggregation.test.ts` (1 warnings)

```.text
316:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/assessment/retake-guidance.test.ts` (1 warnings)

```.text
20:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/auth/__tests__/settings-deep-links.test.ts` (1 warnings)

```.text
198:39  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/auth/index.test.tsx` (1 warnings)

```.text
80:44  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/compliance/dpa-manager.test.ts` (1 warnings)

```.text
32:47  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/harvest/harvest-error-handler.test.ts` (1 warnings)

```.text
30:40  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/harvest/harvest-service.test.ts` (1 warnings)

```.text
189:25  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/hooks/use-notification-preferences.test.ts` (1 warnings)

```.text
64:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/__tests__/batch-picking-service.test.ts` (1 warnings)

```.text
32:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/__tests__/harvest-cost-calculator.test.ts` (1 warnings)

```.text
26:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/__tests__/inventory-valuation-service.test.ts` (1 warnings)

```.text
26:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/inventory/__tests__/use-consumption-analytics.test.ts` (1 warnings)

```.text
18:38  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/__tests__/age-verification-security.test.ts` (1 warnings)

```.text
87:31  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/__tests__/audit-service.test.ts` (1 warnings)

```.text
22:53  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/config/moderation-config.test.ts` (1 warnings)

```.text
99:35  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/moderation-queue.test.ts` (1 warnings)

```.text
33:72  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/monitoring-service.test.ts` (1 warnings)

```.text
25:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/transparency-service.test.ts` (1 warnings)

```.text
42:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/moderation/validation.test.ts` (1 warnings)

```.text
98:74  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/alert-notification-service.test.ts` (1 warnings)

```.text
264:60  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/nutrient-engine/services/calendar-integration-service.test.ts` (1 warnings)

```.text
40:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/performance/__tests__/memory-monitor.test.ts` (1 warnings)

```.text
51:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Replaced `global as any` cast with precise GC typing helper.

#### `src/lib/performance/__tests__/time-series-uploader.test.ts` (1 warnings)

```.text
254:29  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Transaction callback typed via mocked span context helper.

#### `src/lib/privacy/crash-store.test.ts` (1 warnings)

```.text
23:52  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Added `hasRedactedFlag` type guard for crash payload checks.

#### `src/lib/privacy/deletion-gate.test.ts` (1 warnings)

```.text
35:34  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/privacy/export-service.test.ts` (1 warnings)

```.text
45:20  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/privacy/retention-freshness.test.ts` (1 warnings)

```.text
9:43  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/privacy/telemetry-client.test.ts` (1 warnings)

```.text
28:10  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Test event now uses exported `TelemetryEvent` type.

#### `src/lib/security/secure-storage.test.ts` (1 warnings)

```.text
28:13  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Mocked MMKV factory/instances explicitly typed.

#### `src/lib/sentry-utils.test.ts` (1 warnings)

```.text
75:18  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/strains/__tests__/performance.test.tsx` (1 warnings)

```.text
32:26  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

#### `src/lib/sync/__tests__/sync-worker.test.ts` (1 warnings)

```.text
21:21  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

✅ **DONE** - Introduced typed WatermelonDB mock via helper function.

#### `src/lib/uploads/__tests__/ai-images.test.ts` (1 warnings)

```.text
53:65  warning  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
```

</details>
````
