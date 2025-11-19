import React from 'react';

import { getOptionalAuthenticatedUserId, useAuth } from '@/lib/auth';
import { CommunityNotificationService } from '@/lib/notifications/community-notification-service';
import { database } from '@/lib/watermelon';

const communityNotificationService = new CommunityNotificationService(database);

// Helper to load notification preferences
async function loadNotificationPreferences(options: {
  userId: string;
  setCommunityInteractionsEnabled: (value: boolean) => void;
  setCommunityLikesEnabled: (value: boolean) => void;
  setLoading: (value: boolean) => void;
}) {
  const {
    userId,
    setCommunityInteractionsEnabled,
    setCommunityLikesEnabled,
    setLoading,
  } = options;
  try {
    const config =
      await communityNotificationService.getCommunityNotificationConfig(userId);
    setCommunityInteractionsEnabled(config.communityInteractionsEnabled);
    setCommunityLikesEnabled(config.communityLikesEnabled);
  } catch (error) {
    console.warn('Failed to load notification preferences', error);
  } finally {
    setLoading(false);
  }
}

// Helper to update a specific preference
async function updatePreference(
  userId: string,
  updates: Parameters<
    typeof communityNotificationService.updateCommunityNotificationConfig
  >[1]
) {
  await communityNotificationService.updateCommunityNotificationConfig(
    userId,
    updates
  );
}

export function useCommunityNotifications() {
  const auth = useAuth();
  const [userId, setUserId] = React.useState<string | null>(null);
  const [communityInteractionsEnabled, setCommunityInteractionsEnabled] =
    React.useState(true);
  const [communityLikesEnabled, setCommunityLikesEnabled] =
    React.useState(true);
  const [loading, setLoading] = React.useState(true);

  // Get user ID from token
  React.useEffect(() => {
    let isMounted = true;
    const loadUserId = async () => {
      if (auth.token === null) {
        if (isMounted) {
          setUserId(null);
          setCommunityInteractionsEnabled(true);
          setCommunityLikesEnabled(true);
          setLoading(false);
        }
        return;
      }
      const id = await getOptionalAuthenticatedUserId();
      if (isMounted) setUserId(id);
    };
    loadUserId();
    return () => {
      isMounted = false;
    };
  }, [auth.token]);

  // Load preferences on mount when we have a userId
  React.useEffect(() => {
    if (!userId) return;
    loadNotificationPreferences({
      userId,
      setCommunityInteractionsEnabled,
      setCommunityLikesEnabled,
      setLoading,
    });
  }, [userId]);

  const handleToggleCommunityInteractions = React.useCallback(
    async (value: boolean) => {
      if (!userId) return;
      const prev = communityInteractionsEnabled;
      setCommunityInteractionsEnabled(value);
      try {
        await updatePreference(userId, { communityInteractionsEnabled: value });
      } catch (error) {
        console.error(
          'Failed to update community interactions preference',
          error
        );
        setCommunityInteractionsEnabled(prev);
      }
    },
    [userId, communityInteractionsEnabled]
  );

  const handleToggleCommunityLikes = React.useCallback(
    async (value: boolean) => {
      if (!userId) return;
      setCommunityLikesEnabled(value);
      try {
        await updatePreference(userId, { communityLikesEnabled: value });
      } catch (error) {
        console.error('Failed to update community likes preference', error);
        setCommunityLikesEnabled(!value);
      }
    },
    [userId]
  );

  return {
    userId,
    communityInteractionsEnabled,
    communityLikesEnabled,
    loading,
    handleToggleCommunityInteractions,
    handleToggleCommunityLikes,
  } as const;
}
