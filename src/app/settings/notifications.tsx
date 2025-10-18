import React from 'react';
import { Linking, Platform, Switch } from 'react-native';

import {
  FocusAwareStatusBar,
  Pressable,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { getOptionalAuthenticatedUserId, useAuth } from '@/lib/auth';
import { CommunityNotificationService } from '@/lib/notifications/community-notification-service';
import { database } from '@/lib/watermelon';

const communityNotificationService = new CommunityNotificationService(database);

function CategoryList() {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-neutral-100">
        Available Categories:
      </Text>
      <View className="rounded-lg bg-neutral-100 p-3 dark:bg-charcoal-800">
        <Text className="mb-1 text-sm text-neutral-700 dark:text-neutral-300">
          • Community Interactions (replies to your posts)
        </Text>
        <Text className="mb-1 text-sm text-neutral-700 dark:text-neutral-300">
          • Community Likes (likes on your posts)
        </Text>
        <Text className="mb-1 text-sm text-neutral-700 dark:text-neutral-300">
          • Cultivation Reminders (task and grow reminders)
        </Text>
        <Text className="text-sm text-neutral-700 dark:text-neutral-300">
          • System Updates (important app updates)
        </Text>
      </View>
    </View>
  );
}

function PlatformHelp() {
  if (Platform.OS === 'android') {
    return (
      <View className="mb-6">
        <Text className="text-xs text-neutral-500 dark:text-neutral-500">
          On Android, you can manage individual notification channels in system
          settings. Each category can be customized with different sounds,
          importance levels, and behaviors.
        </Text>
      </View>
    );
  }

  return (
    <View className="mb-6">
      <Text className="text-xs text-neutral-500 dark:text-neutral-500">
        On iOS, you can customize notification settings including sounds,
        badges, and banners in system settings.
      </Text>
    </View>
  );
}

export default function NotificationSettings() {
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

  // Load preferences on mount
  React.useEffect(() => {
    if (!userId) return;

    const loadPreferences = async () => {
      try {
        const config =
          await communityNotificationService.getCommunityNotificationConfig(
            userId
          );
        setCommunityInteractionsEnabled(config.communityInteractionsEnabled);
        setCommunityLikesEnabled(config.communityLikesEnabled);
      } catch (error) {
        console.warn('Failed to load notification preferences', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [userId]);

  const handleToggleCommunityInteractions = async (value: boolean) => {
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
  };

  const handleToggleCommunityLikes = async (value: boolean) => {
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
  };

  const handleOpenSettings = async () => {
    await Linking.openSettings();
  };

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 px-4 pt-16">
          <Text className="mb-6 text-2xl font-bold text-charcoal-950 dark:text-neutral-100">
            Notification Settings
          </Text>

          {/* System Settings Card */}
          <View className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-800">
            <Text className="mb-2 text-base font-semibold text-charcoal-950 dark:text-neutral-100">
              System Notification Permissions
            </Text>
            <Text className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
              Control which notifications you receive from GrowBro. You can
              enable or disable notifications for community interactions, task
              reminders, and system updates.
            </Text>

            <Pressable
              accessibilityRole="button"
              className="rounded-md bg-primary-600 px-4 py-3"
              onPress={handleOpenSettings}
            >
              <Text className="text-center font-semibold text-white">
                Open System Settings
              </Text>
            </Pressable>
          </View>

          {/* Community Notification Preferences */}
          <View className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-800">
            <Text className="mb-3 text-base font-semibold text-charcoal-950 dark:text-neutral-100">
              Community Notifications
            </Text>

            {/* Community Interactions Toggle */}
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="mb-1 text-sm font-medium text-charcoal-950 dark:text-neutral-100">
                  Replies & Comments
                </Text>
                <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                  Get notified when someone replies to your posts
                </Text>
              </View>
              <Switch
                value={communityInteractionsEnabled}
                onValueChange={handleToggleCommunityInteractions}
                disabled={loading || !userId}
                trackColor={{
                  false: '#d1d5db',
                  true: '#4f46e5',
                }}
                thumbColor={
                  communityInteractionsEnabled ? '#ffffff' : '#f3f4f6'
                }
              />
            </View>

            {/* Community Likes Toggle */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text className="mb-1 text-sm font-medium text-charcoal-950 dark:text-neutral-100">
                  Likes
                </Text>
                <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                  Get notified when someone likes your posts (max 1 per post per
                  5 min)
                </Text>
              </View>
              <Switch
                value={communityLikesEnabled}
                onValueChange={handleToggleCommunityLikes}
                disabled={loading || !userId}
                trackColor={{
                  false: '#d1d5db',
                  true: '#4f46e5',
                }}
                thumbColor={communityLikesEnabled ? '#ffffff' : '#f3f4f6'}
              />
            </View>
          </View>

          <CategoryList />
          <PlatformHelp />
        </View>
      </ScrollView>
    </>
  );
}
