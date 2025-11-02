/**
 * Hook to fetch notification preferences summary
 * Requirements: 2.5, 4.1
 */

import { useEffect, useState } from 'react';

import { storage } from '@/lib/storage';
import type { NotificationPreferences } from '@/types/settings';

interface NotificationSummary {
  status: 'all_on' | 'all_off' | 'partial';
  quietHours?: string;
  isLoading: boolean;
}

export function useNotificationSummary(userId: string): NotificationSummary {
  const [summary, setSummary] = useState<NotificationSummary>({
    status: 'all_off',
    isLoading: true,
  });

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const key = `notifications.preferences.${userId}`;
        const prefsJson = storage.getString(key);

        if (!prefsJson) {
          setSummary({ status: 'all_off', isLoading: false });
          return;
        }

        const prefs = JSON.parse(prefsJson) as NotificationPreferences;

        // Check if all notification categories are enabled
        const allOn =
          prefs.taskReminders &&
          prefs.harvestAlerts &&
          prefs.communityActivity &&
          prefs.systemUpdates;

        // Check if all are disabled
        const allOff =
          !prefs.taskReminders &&
          !prefs.harvestAlerts &&
          !prefs.communityActivity &&
          !prefs.systemUpdates;

        let status: 'all_on' | 'all_off' | 'partial' = 'partial';
        if (allOn) status = 'all_on';
        if (allOff) status = 'all_off';

        // Format quiet hours if enabled
        let quietHours: string | undefined;
        if (
          prefs.quietHoursEnabled &&
          prefs.quietHoursStart &&
          prefs.quietHoursEnd
        ) {
          quietHours = `${prefs.quietHoursStart} - ${prefs.quietHoursEnd}`;
        }

        setSummary({ status, quietHours, isLoading: false });
      } catch (error) {
        console.error('Failed to fetch notification preferences:', error);
        setSummary({ status: 'all_off', isLoading: false });
      }
    }

    void fetchPreferences();
  }, [userId]);

  return summary;
}
