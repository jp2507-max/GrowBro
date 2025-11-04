import React, { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

import {
  FocusAwareStatusBar,
  Input,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from '@/components/ui';
import { useNotificationPreferences } from '@/lib/hooks/use-notification-preferences';
import { translate } from '@/lib/i18n';
import {
  createAndroidNotificationChannels,
  getNotificationPermissionStatus,
  type NotificationChannelId,
  openNotificationSettings,
} from '@/lib/notifications/platform-permissions';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';
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
  txTitle: string;
  txDescription: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
  isChannelDisabled?: boolean;
}

function CategoryToggle({
  txTitle,
  txDescription,
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
          <Text
            className="mb-1 text-sm font-medium text-charcoal-950 dark:text-neutral-100"
            tx={txTitle as any}
          />
          <Text
            className="text-xs text-neutral-600 dark:text-neutral-400"
            tx={txDescription as any}
          />
          {isChannelDisabled && (
            <Text
              className="mt-1 text-xs text-warning-600 dark:text-warning-400"
              tx="settings.notifications.channelDisabled"
            />
          )}
        </View>
        <Switch
          testID={testID}
          accessibilityLabel={`Toggle ${txTitle}`}
          accessibilityHint="Toggle this setting"
          value={value}
          onValueChange={onValueChange}
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
  const [customMinutes, setCustomMinutes] = useState<string>('30');

  // Initialize custom minutes from preferences when loaded
  useEffect(() => {
    if (preferences?.customReminderMinutes) {
      setCustomMinutes(preferences.customReminderMinutes.toString());
    }
  }, [preferences?.customReminderMinutes]);

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
      createAndroidNotificationChannels().catch((error) => {
        captureCategorizedErrorSync(error, {
          source: 'notifications',
          feature: 'settings',
          action: 'create_channels',
        });
      });
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
              accessibilityHint="Open system notification settings"
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
              <Text
                className="mb-4 text-base font-semibold text-charcoal-950 dark:text-neutral-100"
                tx="settings.notifications.categories.sectionTitle"
              />

              <CategoryToggle
                txTitle="settings.notifications.categories.taskReminders"
                txDescription="settings.notifications.categories.taskRemindersDescription"
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
                  <Text
                    className="mb-2 text-sm font-medium text-charcoal-950 dark:text-neutral-100"
                    tx="settings.notifications.taskReminderTiming.title"
                  />
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
                            {timing === 'hour_before' && (
                              <Text tx="settings.notifications.taskReminderTiming.hourBefore" />
                            )}
                            {timing === 'day_before' && (
                              <Text tx="settings.notifications.taskReminderTiming.dayBefore" />
                            )}
                            {timing === 'custom' && (
                              <Text tx="settings.notifications.taskReminderTiming.custom" />
                            )}
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>

                  {preferences.taskReminderTiming === 'custom' && (
                    <View className="mt-3">
                      <Text
                        className="mb-2 text-xs text-neutral-600 dark:text-neutral-400"
                        tx="settings.notifications.taskReminderTiming.customMinutes"
                      />
                      <Input
                        testID="custom-minutes-input"
                        placeholder="30"
                        value={customMinutes}
                        onChangeText={(text) => {
                          // Only allow numeric input
                          const numericValue = text.replace(/[^0-9]/g, '');
                          if (
                            numericValue === '' ||
                            (parseInt(numericValue, 10) >= 1 &&
                              parseInt(numericValue, 10) <= 1440)
                          ) {
                            setCustomMinutes(numericValue);
                          }
                        }}
                        keyboardType="numeric"
                        maxLength={4}
                        className="text-sm"
                        accessibilityLabel="Custom reminder minutes"
                        accessibilityHint="Enter the number of minutes before task to send reminder (1-1440)"
                      />
                      <Text
                        className="mt-1 text-xs text-neutral-500 dark:text-neutral-500"
                        tx="settings.notifications.taskReminderTiming.customMinutesHelp"
                      />
                    </View>
                  )}
                </View>
              )}

              <CategoryToggle
                txTitle="settings.notifications.categories.harvestAlerts"
                txDescription="settings.notifications.categories.harvestAlertsDescription"
                value={preferences.harvestAlerts}
                onValueChange={(value) =>
                  toggleCategory('harvestAlerts', value)
                }
                disabled={isLoading}
                testID="harvest-alerts-switch"
                isChannelDisabled={!channelStatus.harvest_alerts}
              />

              <CategoryToggle
                txTitle="settings.notifications.categories.communityActivity"
                txDescription="settings.notifications.categories.communityActivityDescription"
                value={preferences.communityActivity}
                onValueChange={(value) =>
                  toggleCategory('communityActivity', value)
                }
                disabled={isLoading}
                testID="community-activity-switch"
                isChannelDisabled={!channelStatus.community_activity}
              />

              <CategoryToggle
                txTitle="settings.notifications.categories.systemUpdatesCategory"
                txDescription="settings.notifications.categories.systemUpdatesDescription"
                value={preferences.systemUpdates}
                onValueChange={(value) =>
                  toggleCategory('systemUpdates', value)
                }
                disabled={isLoading}
                testID="system-updates-switch"
                isChannelDisabled={!channelStatus.system_updates}
              />

              <CategoryToggle
                txTitle="settings.notifications.categories.marketing"
                txDescription="settings.notifications.categories.marketingDescription"
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
                {translate('notifications.quietHours.title')}
              </Text>
              <Text className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
                {translate('notifications.quietHours.description')}
              </Text>

              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-medium text-charcoal-950 dark:text-neutral-100">
                  {translate('notifications.quietHours.enabled')}
                </Text>
                <Switch
                  testID="quiet-hours-switch"
                  accessibilityLabel={translate(
                    'notifications.quietHours.toggleLabel'
                  )}
                  accessibilityHint={translate(
                    'notifications.quietHours.toggleHint'
                  )}
                  value={preferences.quietHoursEnabled}
                  onValueChange={handleQuietHoursToggle}
                  disabled={isLoading}
                />
              </View>

              {preferences.quietHoursEnabled && (
                <View className="mt-4 space-y-2">
                  <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                    {translate('notifications.quietHours.startLabel', {
                      time: preferences.quietHoursStart || '22:00',
                    })}
                  </Text>
                  <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                    {translate('notifications.quietHours.endLabel', {
                      time: preferences.quietHoursEnd || '07:00',
                    })}
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
