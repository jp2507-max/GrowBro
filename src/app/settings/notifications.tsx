import React, { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import {
  FocusAwareStatusBar,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from '@/components/ui';
import { useNotificationPreferences } from '@/lib/hooks/use-notification-preferences';
import {
  createAndroidNotificationChannels,
  getNotificationPermissionStatus,
  type NotificationChannelId,
  openNotificationSettings,
} from '@/lib/notifications/platform-permissions';
import type { TaskReminderTiming } from '@/types/settings';

import { useCommunityNotifications } from './hooks/use-community-notifications';

function CategoryList() {
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

function PlatformHelp() {
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

interface CategoryToggleProps {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
  isChannelDisabled?: boolean;
}

function CategoryToggle({
  title,
  description,
  value,
  onValueChange,
  disabled,
  testID,
  isChannelDisabled,
}: CategoryToggleProps) {
  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 pr-4">
          <Text className="mb-1 text-sm font-medium text-charcoal-950 dark:text-neutral-100">
            {title}
          </Text>
          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
            {description}
          </Text>
          {isChannelDisabled && (
            <Text
              className="mt-1 text-xs text-warning-600 dark:text-warning-400"
              tx="settings.notifications.channelDisabled"
            />
          )}
        </View>
        <Switch
          testID={testID}
          accessibilityLabel={`Toggle ${title}`}
          value={value}
          onValueChange={onValueChange}
          onChange={onValueChange}
          disabled={disabled || isChannelDisabled}
        />
      </View>
      {isChannelDisabled && (
        <Pressable
          accessibilityRole="button"
          className="mt-2 rounded-md bg-warning-100 px-3 py-2 dark:bg-warning-900"
          onPress={openNotificationSettings}
        >
          <Text
            className="text-center text-xs font-medium text-warning-800 dark:text-warning-200"
            tx="settings.notifications.manageInSettings"
          />
        </Pressable>
      )}
    </View>
  );
}

// eslint-disable-next-line max-lines-per-function -- Complex settings screen with multiple sections
export default function NotificationSettings() {
  const {
    userId: communityUserId,
    communityInteractionsEnabled,
    communityLikesEnabled,
    loading: communityLoading,
    handleToggleCommunityInteractions,
    handleToggleCommunityLikes,
  } = useCommunityNotifications();

  const {
    preferences,
    loading,
    error,
    toggleCategory,
    updateTaskReminderTiming,
    updateQuietHours,
  } = useNotificationPreferences();

  const [permissionGranted, setPermissionGranted] = useState(false);
  const [channelStatus, setChannelStatus] = useState<
    Record<NotificationChannelId, boolean>
  >({
    task_reminders: true,
    harvest_alerts: true,
    community_activity: true,
    system_updates: true,
    marketing: true,
  });
  const [customMinutes] = useState<string>('30');

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      const status = await getNotificationPermissionStatus();
      setPermissionGranted(status.granted);
      if (status.channelStatus) {
        setChannelStatus(status.channelStatus);
      }
    };
    checkPermissions();

    // Create Android notification channels
    if (Platform.OS === 'android') {
      createAndroidNotificationChannels();
    }
  }, []);

  const handleOpenSettings = async (): Promise<void> => {
    await Linking.openSettings();
  };

  const handleTaskReminderTimingChange = async (timing: TaskReminderTiming) => {
    if (timing === 'custom') {
      const minutes = parseInt(customMinutes, 10);
      if (!isNaN(minutes) && minutes >= 1 && minutes <= 1440) {
        await updateTaskReminderTiming(timing, minutes);
      }
    } else {
      await updateTaskReminderTiming(timing);
    }
  };

  const handleQuietHoursToggle = async (enabled: boolean) => {
    if (enabled && preferences) {
      // Use existing times or defaults
      const start = preferences.quietHoursStart || '22:00';
      const end = preferences.quietHoursEnd || '07:00';
      await updateQuietHours(enabled, start, end);
    } else {
      await updateQuietHours(enabled);
    }
  };

  const isLoading = loading || communityLoading;
  const hasError = error !== null;

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

          {/* Notification Categories */}
          {permissionGranted && preferences && (
            <View className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-800">
              <Text className="mb-4 text-base font-semibold text-charcoal-950 dark:text-neutral-100">
                Notification Categories
              </Text>

              <CategoryToggle
                title="Task Reminders"
                description="Get reminders for upcoming cultivation tasks"
                value={preferences.taskReminders}
                onValueChange={(value) =>
                  toggleCategory('taskReminders', value)
                }
                disabled={isLoading}
                testID="task-reminders-switch"
                isChannelDisabled={!channelStatus.task_reminders}
              />

              {preferences.taskReminders && (
                <View className="mb-4 ml-4 rounded-lg bg-neutral-200 p-3 dark:bg-charcoal-700">
                  <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-neutral-100">
                    Reminder Timing
                  </Text>
                  <View className="space-y-2">
                    {(['hour_before', 'day_before', 'custom'] as const).map(
                      (timing) => (
                        <Pressable
                          accessibilityRole="button"
                          key={timing}
                          className="flex-row items-center py-2"
                          onPress={() => handleTaskReminderTimingChange(timing)}
                        >
                          <View
                            className={`size-5 rounded-full border-2 ${
                              preferences.taskReminderTiming === timing
                                ? 'border-primary-600 bg-primary-600'
                                : 'border-neutral-400 dark:border-neutral-500'
                            } mr-3 items-center justify-center`}
                          >
                            {preferences.taskReminderTiming === timing && (
                              <View className="size-2 rounded-full bg-white" />
                            )}
                          </View>
                          <Text className="text-sm text-charcoal-950 dark:text-neutral-100">
                            {timing === 'hour_before' && 'Hour before'}
                            {timing === 'day_before' && 'Day before'}
                            {timing === 'custom' && 'Custom'}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>
                </View>
              )}

              <CategoryToggle
                title="Harvest Alerts"
                description="Get notified about harvest timing and important harvest-related updates"
                value={preferences.harvestAlerts}
                onValueChange={(value) =>
                  toggleCategory('harvestAlerts', value)
                }
                disabled={isLoading}
                testID="harvest-alerts-switch"
                isChannelDisabled={!channelStatus.harvest_alerts}
              />

              <CategoryToggle
                title="Community Activity"
                description="Get notified about community interactions, replies, and likes"
                value={preferences.communityActivity}
                onValueChange={(value) =>
                  toggleCategory('communityActivity', value)
                }
                disabled={isLoading}
                testID="community-activity-switch"
                isChannelDisabled={!channelStatus.community_activity}
              />

              <CategoryToggle
                title="System Updates"
                description="Important app updates and announcements"
                value={preferences.systemUpdates}
                onValueChange={(value) =>
                  toggleCategory('systemUpdates', value)
                }
                disabled={isLoading}
                testID="system-updates-switch"
                isChannelDisabled={!channelStatus.system_updates}
              />

              <CategoryToggle
                title="Marketing & Tips"
                description="Optional growing tips and feature announcements (opt-in only)"
                value={preferences.marketing}
                onValueChange={(value) => toggleCategory('marketing', value)}
                disabled={isLoading}
                testID="marketing-switch"
                isChannelDisabled={!channelStatus.marketing}
              />
            </View>
          )}

          {/* Quiet Hours */}
          {permissionGranted && preferences && (
            <View className="mb-6 rounded-lg bg-neutral-100 p-4 dark:bg-charcoal-800">
              <Text className="mb-4 text-base font-semibold text-charcoal-950 dark:text-neutral-100">
                Quiet Hours
              </Text>
              <Text className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                Suppress non-critical notifications during quiet hours
              </Text>

              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-charcoal-950 dark:text-neutral-100">
                  Enabled
                </Text>
                <Switch
                  testID="quiet-hours-switch"
                  accessibilityLabel="Toggle quiet hours"
                  value={preferences.quietHoursEnabled}
                  onValueChange={handleQuietHoursToggle}
                  onChange={handleQuietHoursToggle}
                  disabled={isLoading}
                />
              </View>

              {preferences.quietHoursEnabled && (
                <View className="mt-4 space-y-2">
                  <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                    Start: {preferences.quietHoursStart || '22:00'}
                  </Text>
                  <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                    End: {preferences.quietHoursEnd || '07:00'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Community Notification Preferences (Legacy) */}
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
                onChange={handleToggleCommunityInteractions}
                accessibilityLabel="Toggle community interactions notifications"
                accessibilityHint="Enables or disables notifications for replies and comments on your posts"
                disabled={communityLoading || !communityUserId}
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
                onChange={handleToggleCommunityLikes}
                accessibilityLabel="Toggle community likes notifications"
                accessibilityHint="Enables or disables notifications when someone likes your posts"
                disabled={communityLoading || !communityUserId}
              />
            </View>
          </View>

          <CategoryList />
          <PlatformHelp />

          {hasError && (
            <View className="mb-4 rounded-lg bg-danger-100 p-3 dark:bg-danger-900">
              <Text className="text-sm text-danger-800 dark:text-danger-200">
                {error}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}
