import { Platform } from 'react-native';

import { registerAndroidChannels } from '@/lib/notifications/android-channels';
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
    try {
      await registerAndroidChannels();
    } catch (error) {
      console.warn('[Notifications] channel registration failed', error);
    }
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
