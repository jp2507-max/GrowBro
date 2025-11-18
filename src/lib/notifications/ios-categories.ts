import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import i18n from '@/lib/i18n';

export type IOSCategoryKey =
  | 'COMMUNITY_INTERACTIONS'
  | 'COMMUNITY_LIKES'
  | 'CULTIVATION_REMINDERS'
  | 'SYSTEM_UPDATES';

type CategoryDefinition = {
  identifier: IOSCategoryKey;
  actions: IOSNotificationAction[];
  options?: IOSNotificationCategoryOptions;
};

type IOSNotificationAction = {
  identifier: string;
  buttonTitle: string;
  textInput?: {
    submitButtonTitle: string;
    placeholder?: string;
  };
  options?: {
    opensAppToForeground?: boolean;
    isDestructive?: boolean;
  };
};

type IOSNotificationCategoryOptions = {
  allowAnnouncement?: boolean;
  intentIdentifiers?: string[];
};

type NotificationsWithIOS = typeof Notifications & {
  setNotificationCategoryAsync: (
    identifier: string,
    actions: IOSNotificationAction[],
    options?: IOSNotificationCategoryOptions
  ) => Promise<void>;
};

function createCategoryDefinitions(): CategoryDefinition[] {
  return [
    {
      identifier: 'COMMUNITY_INTERACTIONS',
      actions: [
        {
          identifier: 'REPLY',
          buttonTitle: i18n.t('notifications.actions.reply'),
          textInput: {
            submitButtonTitle: i18n.t('notifications.actions.replySubmit'),
            placeholder: i18n.t('notifications.actions.replyPlaceholder'),
          },
        },
        {
          identifier: 'VIEW_PROFILE',
          buttonTitle: i18n.t('notifications.actions.viewProfile'),
          options: { opensAppToForeground: true },
        },
      ],
      options: { allowAnnouncement: true },
    },
    {
      identifier: 'COMMUNITY_LIKES',
      actions: [
        {
          identifier: 'VIEW_POST',
          buttonTitle: i18n.t('notifications.actions.viewPost'),
          options: { opensAppToForeground: true },
        },
      ],
    },
    {
      identifier: 'CULTIVATION_REMINDERS',
      actions: [
        {
          identifier: 'MARK_DONE',
          buttonTitle: i18n.t('notifications.actions.markDone'),
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'SNOOZE',
          buttonTitle: i18n.t('notifications.actions.snooze'),
        },
      ],
      options: {
        allowAnnouncement: true,
        intentIdentifiers: ['growbro.tasks'],
      },
    },
    {
      identifier: 'SYSTEM_UPDATES',
      actions: [
        {
          identifier: 'VIEW_DETAILS',
          buttonTitle: i18n.t('notifications.actions.viewDetails'),
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'DISMISS',
          buttonTitle: i18n.t('notifications.actions.dismiss'),
          options: { isDestructive: true },
        },
      ],
    },
  ];
}

export async function registerNotificationCategories(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const iosNotifications = Notifications as NotificationsWithIOS;
  const categoryDefinitions = createCategoryDefinitions();
  await Promise.all(
    categoryDefinitions.map((definition) =>
      iosNotifications.setNotificationCategoryAsync(
        definition.identifier,
        definition.actions,
        definition.options
      )
    )
  );
}
