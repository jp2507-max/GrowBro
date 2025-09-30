import type { Database } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useCallback, useEffect, useState } from 'react';

import type { NotificationPreferenceModel } from '@/lib/watermelon-models/notification-preference';

type PreferenceValues = {
  communityInteractions: boolean;
  communityLikes: boolean;
  cultivationReminders: boolean;
  systemUpdates: boolean;
};

const DEFAULT_PREFERENCES: PreferenceValues = {
  communityInteractions: true,
  communityLikes: true,
  cultivationReminders: true,
  systemUpdates: true,
};

async function fetchPreferences(
  database: Database
): Promise<PreferenceValues | null> {
  try {
    const collection = database.get('notification_preferences');
    const records = await collection.query().fetch();

    if (records.length > 0) {
      const pref = records[0] as NotificationPreferenceModel;
      return {
        communityInteractions: pref.communityInteractions,
        communityLikes: pref.communityLikes,
        cultivationReminders: pref.cultivationReminders,
        systemUpdates: pref.systemUpdates,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch notification preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

async function createDefault(database: Database): Promise<PreferenceValues> {
  try {
    const collection = database.get('notification_preferences');

    await database.write(async () => {
      await collection.create((pref: any) => {
        pref.communityInteractions = true;
        pref.communityLikes = true;
        pref.cultivationReminders = true;
        pref.systemUpdates = true;
      });
    });

    return DEFAULT_PREFERENCES;
  } catch (error) {
    console.error('Failed to create default preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Hook to manage user notification preferences
 */
export function useNotificationPreferences() {
  const database = useDatabase();
  const [preferences, setPreferences] = useState<PreferenceValues | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPreferences = useCallback(async () => {
    const prefs = await fetchPreferences(database);
    if (prefs) {
      setPreferences(prefs);
    } else {
      const defaults = await createDefault(database);
      setPreferences(defaults);
    }
    setIsLoading(false);
  }, [database]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const updatePreference = useCallback(
    async (category: string, enabled: boolean) => {
      try {
        const collection = database.get('notification_preferences');
        const records = await collection.query().fetch();

        if (records.length > 0) {
          await database.write(async () => {
            await records[0].update((pref: any) => {
              pref[category] = enabled;
            });
          });

          setPreferences((prev) =>
            prev ? { ...prev, [category]: enabled } : null
          );
        }
      } catch (error) {
        console.error('Failed to update preference:', error);
      }
    },
    [database]
  );

  return { preferences, updatePreference, isLoading, refresh: loadPreferences };
}
