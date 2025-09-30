/* eslint-disable simple-import-sort/exports */
export {
  scheduleInexact,
  requestExactIfJustified,
  type AlarmScheduleResult,
} from '@/lib/alarms';
export * from './analytics';
export { getAnalyticsClient, setAnalyticsClient } from './analytics-registry';
export * from './auth';
export * from './hooks';
export * from './i18n';
export {
  requestSelectedPhotos,
  showReselectionUI,
  type PhotoAccessResult,
} from '@/lib/media/photo-access';
export { NotificationHandler } from '@/lib/permissions/notification-handler';
export {
  PermissionManager,
  type PermissionManagerAPI,
  type PermissionResult,
  type AlarmPermissionResult,
  type StoragePermissionStatus,
} from '@/lib/permissions/permission-manager';
export { ConsentService } from './privacy/consent-service';
export * from './privacy/consent-types';
export { retentionWorker } from './privacy/retention-worker';
export * from './privacy-consent';
export { SDKGate } from './privacy/sdk-gate';
export * as rrule from './rrule';
export * from './sentry-utils';
export * from './supabase';
export * from './sync/preferences';
export * from './sync/storage-manager';
export * from './task-manager';
export * from './template-manager';
export * from './utils';
export { useAnalytics } from './use-analytics';
export {
  clearPendingDeepLink,
  consumePendingDeepLink,
  isProtectedDeepLinkPath,
  peekPendingDeepLink,
  stashPendingDeepLink,
  useDeferredDeepLink,
} from './navigation/deep-link-gate';
export {
  AppAccessManager,
  provideTestCredentials,
  generateDemoFlow,
  validateAccessToGatedFeatures,
  createReviewerInstructions,
  type RequiredFeature,
  type MaskedSecret,
  type TestCredentials,
  type DemoFlowStep,
  type DemoFlowInstructions,
  type AccessValidationIssue,
  type AccessValidationResult,
  type ReviewerGuide,
} from '@/lib/compliance/app-access-manager';
export {
  useAgeGate,
  verifyAgeGate,
  startAgeGateSession,
  hydrateAgeGate,
  isAgeGateVerified,
  getAgeGateAuditLog,
} from '@/lib/compliance/age-gate';
