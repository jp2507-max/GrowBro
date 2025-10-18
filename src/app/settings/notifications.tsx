import React from 'react';
import { Linking, Platform, Switch } from 'react-native';

import {
  FocusAwareStatusBar,
  Pressable,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { colors } from '@/components/ui/colors';

import { useCommunityNotifications } from './hooks/use-community-notifications';

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
  const {
    userId,
    communityInteractionsEnabled,
    communityLikesEnabled,
    loading,
    handleToggleCommunityInteractions,
    handleToggleCommunityLikes,
  } = useCommunityNotifications();

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
                  false: colors.neutral[300],
                  true: colors.indigo[600],
                }}
                thumbColor={
                  communityInteractionsEnabled
                    ? colors.white
                    : colors.neutral[50]
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
                  false: colors.neutral[300],
                  true: colors.indigo[600],
                }}
                thumbColor={
                  communityLikesEnabled ? colors.white : colors.neutral[50]
                }
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
