import { Platform } from 'react-native';

import { scheduleInexact } from '@/lib/alarms';
import { PermissionManager } from '@/lib/permissions/permission-manager';

const EXACT_ALARM_THRESHOLD_MS = 6 * 60 * 60 * 1000; // 6 hours

type EnsureOptions = {
  taskId: string;
  triggerAt: Date;
};

export type EnsureResult = {
  granted: boolean;
  fallbackId?: string;
};

export const AndroidExactAlarmCoordinator = {
  async ensurePermission(options: EnsureOptions): Promise<EnsureResult> {
    if (Platform.OS !== 'android') {
      return { granted: false };
    }

    if (!shouldAttemptExact(options.triggerAt)) {
      return { granted: false };
    }

    const permission = await PermissionManager.requestExactAlarmIfJustified();
    if (permission.status === 'granted') {
      return { granted: true };
    }

    try {
      const fallback = await scheduleInexact(options.triggerAt, {
        taskId: options.taskId,
      });
      return { granted: false, fallbackId: fallback.id };
    } catch (error) {
      console.error('Failed to schedule inexact alarm fallback:', error);
      return { granted: false };
    }
  },
};

function shouldAttemptExact(triggerAt: Date): boolean {
  const version = Number(Platform.Version);
  if (Number.isNaN(version) || version < 31) {
    return false;
  }
  if (!PermissionManager.needsExactAlarms()) {
    return false;
  }
  const delta = triggerAt.getTime() - Date.now();
  if (delta <= 0) {
    return false;
  }
  return delta <= EXACT_ALARM_THRESHOLD_MS;
}
