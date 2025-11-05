/**
 * Hook for managing notification preferences
 * Requirements: 4.1, 4.2, 4.5, 4.7, 4.8, 4.9, 4.11
 */

import { useCallback, useEffect, useState } from 'react';

import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { NotificationPreferencesService } from '@/lib/notifications/notification-preferences-service';
import { database } from '@/lib/watermelon';
import type {
  NotificationPreferences,
  TaskReminderTiming,
} from '@/types/settings';

const preferencesService = new NotificationPreferencesService(database);

// eslint-disable-next-line max-lines-per-function -- Hook managing notification preferences with multiple callbacks
export function useNotificationPreferences() {
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user ID
  useEffect(() => {
    let isMounted = true;
    const loadUserId = async () => {
      const id = await getOptionalAuthenticatedUserId();
      if (isMounted) setUserId(id);
    };
    loadUserId();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load preferences when userId is available
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    const loadPreferences = async () => {
      try {
        setLoading(true);
        setError(null);
        const prefs = await preferencesService.getPreferences(userId);
        if (isMounted) {
          setPreferences(prefs);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to load preferences'
          );
          console.error('Failed to load notification preferences', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPreferences();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Toggle category
  const toggleCategory = useCallback(
    async (
      category:
        | 'taskReminders'
        | 'harvestAlerts'
        | 'communityActivity'
        | 'systemUpdates'
        | 'marketing',
      enabled: boolean
    ) => {
      if (!userId || !preferences) return;

      const prevValue = preferences[category];
      // Optimistic update
      setPreferences({ ...preferences, [category]: enabled });

      try {
        const updated = await preferencesService.toggleCategory(
          userId,
          category,
          enabled
        );
        setPreferences(updated);
      } catch (err) {
        // Revert on error
        setPreferences({ ...preferences, [category]: prevValue });
        setError(
          err instanceof Error ? err.message : 'Failed to update preference'
        );
        console.error('Failed to toggle notification category', err);
      }
    },
    [userId, preferences]
  );

  // Update task reminder timing
  const updateTaskReminderTiming = useCallback(
    async (timing: TaskReminderTiming, customMinutes?: number) => {
      if (!userId || !preferences) return;

      const prevTiming = preferences.taskReminderTiming;
      const prevMinutes = preferences.customReminderMinutes;

      // Optimistic update
      setPreferences({
        ...preferences,
        taskReminderTiming: timing,
        customReminderMinutes: customMinutes,
      });

      try {
        const updated = await preferencesService.updateTaskReminderTiming(
          userId,
          timing,
          customMinutes
        );
        setPreferences(updated);
      } catch (err) {
        // Revert on error
        setPreferences({
          ...preferences,
          taskReminderTiming: prevTiming,
          customReminderMinutes: prevMinutes,
        });
        setError(
          err instanceof Error ? err.message : 'Failed to update timing'
        );
        console.error('Failed to update task reminder timing', err);
      }
    },
    [userId, preferences]
  );

  // Update quiet hours
  const updateQuietHours = useCallback(
    async (enabled: boolean, start?: string, end?: string) => {
      if (!userId || !preferences) return;

      const prevEnabled = preferences.quietHoursEnabled;
      const prevStart = preferences.quietHoursStart;
      const prevEnd = preferences.quietHoursEnd;

      // Optimistic update
      setPreferences({
        ...preferences,
        quietHoursEnabled: enabled,
        quietHoursStart: start,
        quietHoursEnd: end,
      });

      try {
        const updated = await preferencesService.updateQuietHours(userId, {
          enabled,
          start,
          end,
        });
        setPreferences(updated);
      } catch (err) {
        // Revert on error
        setPreferences({
          ...preferences,
          quietHoursEnabled: prevEnabled,
          quietHoursStart: prevStart,
          quietHoursEnd: prevEnd,
        });
        setError(
          err instanceof Error ? err.message : 'Failed to update quiet hours'
        );
        console.error('Failed to update quiet hours', err);
      }
    },
    [userId, preferences]
  );

  return {
    userId,
    preferences,
    loading,
    error,
    toggleCategory,
    updateTaskReminderTiming,
    updateQuietHours,
  };
}
