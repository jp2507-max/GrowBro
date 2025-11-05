/**
 * Type definitions for User Profile & Settings Shell
 * Requirements: 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1, 9.1, 10.1, 11.1
 */

// ======================================================================================
// USER PROFILE
// ======================================================================================

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string | null;
  location?: string;
  showProfileToCommunity: boolean;
  allowDirectMessages: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileStatistics {
  plantsCount: number;
  harvestsCount: number;
  postsCount: number;
  likesReceived: number;
}

export type AvatarStatus = 'idle' | 'uploading' | 'pending' | 'failed';

// ======================================================================================
// NOTIFICATION PREFERENCES
// ======================================================================================

export type TaskReminderTiming = 'hour_before' | 'day_before' | 'custom';

export interface NotificationPreferences {
  userId: string;
  taskReminders: boolean;
  taskReminderTiming: TaskReminderTiming;
  customReminderMinutes?: number;
  harvestAlerts: boolean;
  communityActivity: boolean;
  systemUpdates: boolean;
  marketing: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string; // HH:mm format
  lastUpdated: string;
  deviceId: string;
}

export interface NotificationPermissionStatus {
  granted: boolean;
  platform: 'ios' | 'android';
  channelStatus?: Record<string, boolean>; // Android only
}

// ======================================================================================
// LEGAL DOCUMENTS & ACCEPTANCES
// ======================================================================================

export type LegalDocumentType = 'terms' | 'privacy' | 'cannabis';

export interface LegalDocument {
  type: LegalDocumentType;
  version: string; // Semantic version: "1.2.0"
  lastUpdated: string;
  content: {
    en: string; // Markdown content
    de: string; // Markdown content
  };
  requiresReAcceptance: boolean;
}

export interface LegalAcceptanceRecord {
  userId: string;
  documentType: LegalDocumentType;
  version: string;
  acceptedAt: string;
  appVersion: string;
  locale: string;
  ipAddress?: string; // Server-side only, with consent
}

export interface LegalAcceptances {
  termsOfService: boolean;
  privacyPolicy: boolean;
  cannabisPolicy: boolean;
}

export interface LegalConfirmationModalProps {
  isVisible: boolean;
  onAccept: (acceptances: LegalAcceptances) => void;
  onDecline: () => void;
}

// ======================================================================================
// SECURITY
// ======================================================================================

export type BiometricType = 'face' | 'fingerprint' | 'iris';

export interface SecuritySettings {
  userId: string;
  biometricEnabled: boolean;
  biometricType?: BiometricType;
  twoFactorEnabled: boolean;
  lastPasswordChange?: string;
  activeSessions: Session[];
}

export interface Session {
  sessionId: string;
  deviceName: string;
  platform: 'ios' | 'android' | 'web';
  lastActive: string;
  ipAddress?: string;
  location?: string;
  isCurrent: boolean;
}

// ======================================================================================
// SUPPORT
// ======================================================================================

export type BugReportCategory =
  | 'crash'
  | 'ui'
  | 'sync'
  | 'performance'
  | 'other';

export interface BugReport {
  title: string;
  description: string;
  category: BugReportCategory;
  screenshot?: string; // Base64 or file URI
  diagnostics: BugDiagnostics;
  sentryEventId?: string;
}

export interface BugDiagnostics {
  appVersion: string;
  buildNumber: string;
  deviceModel: string;
  osVersion: string;
  locale: string;
  freeStorage: number; // MB
  lastSyncTime?: string;
  networkStatus: 'online' | 'offline';
}

export type BugReportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type FeedbackCategory =
  | 'feature_request'
  | 'improvement'
  | 'compliment'
  | 'other';

export interface Feedback {
  category: FeedbackCategory;
  message: string;
  email?: string;
}

// ======================================================================================
// ACCOUNT DELETION
// ======================================================================================

export type DeletionRequestStatus = 'pending' | 'cancelled' | 'completed';

export interface AccountDeletionRequest {
  requestId: string;
  userId: string;
  requestedAt: string;
  scheduledFor: string; // 30 days from request
  status: DeletionRequestStatus;
  reason?: string;
  policyVersion: string;
}

// ======================================================================================
// AUDIT LOGS
// ======================================================================================

export type AuditEventType =
  | 'consent_changed'
  | 'data_exported'
  | 'account_deletion_requested'
  | 'account_deletion_cancelled'
  | 'account_deleted'
  | 'legal_acceptance'
  | 'profile_updated'
  | 'security_settings_changed';

export interface AuditLogEntry {
  userId: string;
  eventType: AuditEventType;
  payload?: Record<string, unknown>;
  policyVersion?: string;
  appVersion?: string;
  createdAt: string;
}

// ======================================================================================
// APP INFO
// ======================================================================================

export interface AboutInfo {
  appName: string;
  version: string;
  buildNumber: string;
  environment: 'development' | 'preview' | 'production';
  updateInfo?: UpdateInfo;
}

export interface UpdateInfo {
  available: boolean;
  version?: string;
  downloadProgress?: number;
  status: 'checking' | 'downloading' | 'ready' | 'error';
}

export type UpdateCheckResult =
  | { isAvailable: true; manifest: { version: string } }
  | { isAvailable: false };

// ======================================================================================
// ONBOARDING
// ======================================================================================

export type OnboardingStep =
  | 'age_gate'
  | 'legal_confirmation'
  | 'consent'
  | 'complete';

export interface OnboardingState {
  currentStep: OnboardingStep;
  ageVerified: boolean;
  legalAccepted: boolean;
  consentGiven: boolean;
}

// ======================================================================================
// SETTINGS SECTIONS
// ======================================================================================

export interface SettingsSection {
  id: string;
  title: string;
  items: SettingsItem[];
}

export type SettingsItemType =
  | 'navigation'
  | 'toggle'
  | 'select'
  | 'action'
  | 'info';

export interface SettingsItem {
  id: string;
  type: SettingsItemType;
  title: string;
  subtitle?: string;
  icon?: string;
  value?: string | boolean;
  onPress?: () => void;
  disabled?: boolean;
  badge?: string;
}

// ======================================================================================
// SYNC & ERROR HANDLING
// ======================================================================================

export interface SyncQueueItem {
  id: string;
  type: 'profile' | 'notification_preferences' | 'legal_acceptance';
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
  nextRetryAt?: string;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
}

export interface SyncError {
  type: string;
  message: string;
  canRetry: boolean;
  retryAction?: () => void;
}
