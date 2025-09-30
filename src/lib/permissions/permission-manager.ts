import * as Notifications from 'expo-notifications';
import {
  Alert,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import i18n from '@/lib/i18n';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

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
    if (Platform.OS !== 'android') {
      const notificationsCompat = Notifications as unknown as {
        requestPermissionsAsync?: Function;
      };
      try {
        const result = await notificationsCompat.requestPermissionsAsync?.();
        if (!result) return 'unavailable';
        const { status } = result;
        // Expo returns 'granted' | 'denied' | 'undetermined' in some versions.
        // Map to our PermissionResult type where anything truthy and not 'denied' is treated as granted.
        if (status === 'granted') return 'granted';
        if (status === 'denied') return 'denied';
        return 'unavailable';
      } catch (error) {
        captureCategorizedErrorSync(error);
        console.error('requestNotificationPermission failed', error);
        return 'unavailable';
      }
    }
    if (Platform.Version < 33) return 'granted';
    try {
      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return status === PermissionsAndroid.RESULTS.GRANTED
        ? 'granted'
        : 'denied';
    } catch (error) {
      captureCategorizedErrorSync(error);
      console.error('requestNotificationPermission failed', error);
      return 'unavailable';
    }
  },

  async isNotificationPermissionGranted(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      const notificationsCompat = Notifications as unknown as {
        getPermissionsAsync?: Function;
      };
      try {
        const result = await notificationsCompat.getPermissionsAsync?.();
        if (!result) return false;
        const { status } = result;
        return status === 'granted';
      } catch {
        return false;
      }
    }
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
    return this.requestExactAlarmIfJustified();
  },

  async requestExactAlarmIfJustified(): Promise<AlarmPermissionResult> {
    if (!shouldConsiderExactAlarmFlow()) {
      return { status: 'unavailable' };
    }

    if (await canScheduleExactAlarms()) {
      return { status: 'granted' };
    }

    showExactAlarmPrimer();
    return { status: 'denied', fallbackUsed: true };
  },

  needsExactAlarms(): boolean {
    if (Platform.OS !== 'android') {
      return false;
    }
    const version = Number(Platform.Version);
    if (Number.isNaN(version)) {
      return false;
    }
    return version >= 31;
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

  provideFallbackExperience(permission: string): void {
    // For POST_NOTIFICATIONS, open app settings to allow users to re-enable the permission
    if (
      permission === 'POST_NOTIFICATIONS' ||
      permission === PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    ) {
      void Linking.openSettings();
    }
    // For other permissions, implement UI-level fallbacks elsewhere (e.g., show in-app badge or banners)
  },
};

type ExactAlarmNativeModule = {
  canScheduleExactAlarms?: () => Promise<boolean>;
  openExactAlarmSettings?: () => Promise<void>;
};

const { ExactAlarmModule } = NativeModules as {
  ExactAlarmModule?: ExactAlarmNativeModule;
};

function shouldConsiderExactAlarmFlow(): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }
  const version = Number(Platform.Version);
  if (Number.isNaN(version)) {
    return false;
  }
  return version >= 31;
}

async function canScheduleExactAlarms(): Promise<boolean> {
  if (!shouldConsiderExactAlarmFlow()) {
    return false;
  }
  if (ExactAlarmModule?.canScheduleExactAlarms) {
    try {
      return await ExactAlarmModule.canScheduleExactAlarms();
    } catch {}
  }
  return false;
}

function showExactAlarmPrimer(): void {
  if (!shouldConsiderExactAlarmFlow()) {
    return;
  }
  if (process.env.JEST_WORKER_ID !== undefined) {
    return;
  }

  Alert.alert(
    i18n.t('notifications.exactAlarm.title'),
    i18n.t('notifications.exactAlarm.body'),
    [
      { text: i18n.t('common.cancel'), style: 'cancel' },
      {
        text: i18n.t('notifications.exactAlarm.cta'),
        onPress: () => {
          void openExactAlarmSettings();
        },
      },
    ],
    { cancelable: true }
  );
}

async function openExactAlarmSettings(): Promise<void> {
  if (!shouldConsiderExactAlarmFlow()) {
    return;
  }
  if (ExactAlarmModule?.openExactAlarmSettings) {
    try {
      await ExactAlarmModule.openExactAlarmSettings();
      return;
    } catch {}
  }
  try {
    await Linking.openSettings();
  } catch {}
}
