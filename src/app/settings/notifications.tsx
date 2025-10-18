import React from 'react';
import { Linking, Platform } from 'react-native';

import {
  FocusAwareStatusBar,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from '@/components/ui';
import colors from '@/components/ui/colors';

import { useCommunityNotifications } from './hooks/use-community-notifications';

function CategoryList(): JSX.Element {
  return (
    <View className="mb-4">
      <Text
        className="mb-2 text-sm font-medium text-charcoal-950 dark:text-neutral-100"
        tx="settings.notifications.categories.title"
      />
      <View className="rounded-lg bg-neutral-100 p-3 dark:bg-charcoal-800">
        <Text
          className="mb-1 text-sm text-neutral-700 dark:text-neutral-300"
          tx="settings.notifications.categories.communityInteractions"
        />
        <Text
          className="mb-1 text-sm text-neutral-700 dark:text-neutral-300"
          tx="settings.notifications.categories.communityLikes"
        />
        <Text
          className="mb-1 text-sm text-neutral-700 dark:text-neutral-300"
          tx="settings.notifications.categories.cultivationReminders"
        />
        <Text
          className="text-sm text-neutral-700 dark:text-neutral-300"
          tx="settings.notifications.categories.systemUpdates"
        />
      </View>
    </View>
  );
}

function PlatformHelp(): JSX.Element {
  if (Platform.OS === 'android') {
    return (
      <View className="mb-6">
        <Text
          className="text-xs text-neutral-500 dark:text-neutral-500"
          tx="settings.notifications.platformHelp.android"
        />
      </View>
    );
  }

  return (
    <View className="mb-6">
      <Text
        className="text-xs text-neutral-500 dark:text-neutral-500"
        tx="settings.notifications.platformHelp.ios"
      />
    </View>
  );
}

export default function NotificationSettings(): JSX.Element {
  const {
    userId,
    communityInteractionsEnabled,
    communityLikesEnabled,
    loading,
    handleToggleCommunityInteractions,
    handleToggleCommunityLikes,
  } = useCommunityNotifications();

  const handleOpenSettings = async (): Promise<void> => {
    await Linking.openSettings();
  };

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 px-4 pt-16">
          <Text
            className="mb-6 text-2xl font-bold text-charcoal-950 dark:text-neutral-100"
            tx="settings.notifications.title"
          />

          {/* System Settings Card */}
          <View className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-800">
            <Text
              className="mb-2 text-base font-semibold text-charcoal-950 dark:text-neutral-100"
              tx="settings.notifications.systemPermissions.title"
            />
            <Text
              className="mb-4 text-sm text-neutral-600 dark:text-neutral-400"
              tx="settings.notifications.systemPermissions.description"
            />

            <Pressable
              accessibilityRole="button"
              className="rounded-md bg-primary-600 px-4 py-3"
              onPress={handleOpenSettings}
              testID="open-system-settings-button"
            >
              <Text
                className="text-center font-semibold text-white"
                tx="settings.notifications.systemPermissions.openSettings"
              />
            </Pressable>
          </View>

          {/* Community Notification Preferences */}
          <View className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-800">
            <Text
              className="mb-3 text-base font-semibold text-charcoal-950 dark:text-neutral-100"
              tx="settings.notifications.community.title"
            />

            {/* Community Interactions Toggle */}
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-4">
                <Text
                  className="mb-1 text-sm font-medium text-charcoal-950 dark:text-neutral-100"
                  tx="settings.notifications.community.repliesAndComments"
                />
                <Text
                  className="text-xs text-neutral-600 dark:text-neutral-400"
                  tx="settings.notifications.community.repliesAndCommentsDescription"
                />
              </View>
              <Switch
                testID="community-interactions-switch"
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
                <Text
                  className="mb-1 text-sm font-medium text-charcoal-950 dark:text-neutral-100"
                  tx="settings.notifications.community.likes"
                />
                <Text
                  className="text-xs text-neutral-600 dark:text-neutral-400"
                  tx="settings.notifications.community.likesDescription"
                />
              </View>
              <Switch
                testID="community-likes-switch"
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
