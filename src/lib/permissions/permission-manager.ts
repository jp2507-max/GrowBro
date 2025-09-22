import { Linking, PermissionsAndroid, Platform } from 'react-native';

export type PermissionResult = 'granted' | 'denied' | 'unavailable';
export type AlarmPermissionResult =
  | { status: 'granted' }
  | { status: 'denied'; fallbackUsed: true }
  | { status: 'unavailable' };

export type StoragePermissionStatus =
  | { scope: 'scoped'; granted: true }
  | { scope: 'scoped'; granted: false }
  | { scope: 'broad'; granted: false };

export interface PermissionManagerAPI {
  requestNotificationPermission(): Promise<PermissionResult>;
  isNotificationPermissionGranted(): Promise<boolean>;
  handleExactAlarmPermission(): Promise<AlarmPermissionResult>;
  checkStoragePermissions(): Promise<StoragePermissionStatus>;
  requestSelectedPhotosAccess(): Promise<PermissionResult>;
  showMediaReselectionUI(): void;
  needsExactAlarms(): boolean;
  requestExactAlarmIfJustified(): Promise<AlarmPermissionResult>;
  provideFallbackExperience(permission: string): void;
}

export const PermissionManager: PermissionManagerAPI = {
  async requestNotificationPermission(): Promise<PermissionResult> {
    if (Platform.OS !== 'android') return 'granted';
    if (Platform.Version < 33) return 'granted';
    try {
      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return status === PermissionsAndroid.RESULTS.GRANTED
        ? 'granted'
        : 'denied';
    } catch {
      return 'unavailable';
    }
  },

  async isNotificationPermissionGranted(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version < 33) return true;
    try {
      return await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
    } catch {
      return false;
    }
  },

  async handleExactAlarmPermission(): Promise<AlarmPermissionResult> {
    // Default to inexact alarms; request path is Settings-based on Android 14+
    return { status: 'denied', fallbackUsed: true };
  },

  async requestExactAlarmIfJustified(): Promise<AlarmPermissionResult> {
    // As per policy, only request with strong justification and Play declaration
    // We provide a stub returning denied with fallback to inexact scheduling
    return { status: 'denied', fallbackUsed: true };
  },

  needsExactAlarms(): boolean {
    // Gatekeeper: default false; callers use inexact scheduling by default
    return false;
  },

  async checkStoragePermissions(): Promise<StoragePermissionStatus> {
    // App uses scoped storage by default; no broad permissions requested
    return { scope: 'scoped', granted: true };
  },

  async requestSelectedPhotosAccess(): Promise<PermissionResult> {
    // Prefer Android Photo Picker; no runtime permission needed in many cases
    // Leave as unavailable unless a picker flow is invoked elsewhere
    if (Platform.OS !== 'android') return 'granted';
    return 'unavailable';
  },

  showMediaReselectionUI(): void {
    // On Android 14+, apps can prompt re-selection; we open settings as a fallback
    void Linking.openSettings();
  },

  provideFallbackExperience(_permission: string): void {
    // Implement UI-level fallbacks elsewhere (e.g., show in-app badge or banners)
  },
};
