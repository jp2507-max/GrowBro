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
    const loadUserId = async () => {
      const id = await getOptionalAuthenticatedUserId();
      setUserId(id);
    };

    loadUserId();
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

      setCommunityInteractionsEnabled(value);
      try {
        await communityNotificationService.updateCommunityNotificationConfig(
          userId,
          {
            communityInteractionsEnabled: value,
          }
        );
      } catch (error) {
        console.error(
          'Failed to update community interactions preference',
          error
        );
        // Revert on error
        setCommunityInteractionsEnabled(!value);
      }
    },
    [userId]
  );

  const handleToggleCommunityLikes = React.useCallback(
    async (value: boolean) => {
      if (!userId) return;

      setCommunityLikesEnabled(value);
      try {
        await communityNotificationService.updateCommunityNotificationConfig(
          userId,
          {
            communityLikesEnabled: value,
          }
        );
      } catch (error) {
        console.error('Failed to update community likes preference', error);
        // Revert on error
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
