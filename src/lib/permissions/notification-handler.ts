import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { PermissionManager } from '@/lib/permissions/permission-manager';

export interface NotificationHandlerAPI {
  isNotificationPermissionGranted(): Promise<boolean>;
  createChannelsAfterGrant(): Promise<void>;
  showInAppBadge(): void;
  suppressNotifications(): void;
  requestPermissionWithPrimer(): Promise<boolean>;
}

export const NotificationHandler: NotificationHandlerAPI = {
  async isNotificationPermissionGranted(): Promise<boolean> {
    return PermissionManager.isNotificationPermissionGranted();
  },

  async createChannelsAfterGrant(): Promise<void> {
    if (Platform.OS !== 'android') return;
    const granted = await PermissionManager.isNotificationPermissionGranted();
    if (!granted) return; // do not create channels before grant
    const anyNotif: any = Notifications as any;
    await anyNotif.setNotificationChannelAsync('cultivation.reminders.v1', {
      name: 'Reminders',
      importance: anyNotif.AndroidImportance?.HIGH ?? 4,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#34D399',
      lockscreenVisibility: anyNotif.AndroidNotificationVisibility?.PUBLIC ?? 1,
    });
  },

  showInAppBadge(): void {
    // Rendering of badge is handled by UI component; this flag can be wired into state
  },

  suppressNotifications(): void {
    // Hook for app-level suppression state
  },

  async requestPermissionWithPrimer(): Promise<boolean> {
    // Callers should show an in-app primer before invoking this
    const res = await PermissionManager.requestNotificationPermission();
    const ok = res === 'granted';
    if (!ok) this.showInAppBadge();
    if (ok) await this.createChannelsAfterGrant();
    return ok;
  },
};

export default NotificationHandler;
