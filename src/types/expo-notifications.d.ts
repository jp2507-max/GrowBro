declare module 'react-native-keyboard-controller/jest';
declare module 'expo-notifications' {
  export type NotificationTriggerInput = {
    type: 'date';
    date: Date;
    channelId?: string;
  };

  export type NotificationContentInput = {
    title: string;
    body: string;
    data?: Record<string, unknown>;
    threadIdentifier?: string;
    sound?: boolean | string;
    // iOS specific fields
    subtitle?: string;
    badge?: number | string;
    // Android specific fields
    color?: string;
    priority?: 'min' | 'low' | 'default' | 'high' | 'max';
  };

  export function scheduleNotificationAsync(options: {
    content: NotificationContentInput;
    trigger: NotificationTriggerInput;
  }): Promise<string>;

  export function getAllScheduledNotificationsAsync(): Promise<
    {
      identifier: string;
      trigger: unknown;
    }[]
  >;

  export function cancelScheduledNotificationAsync(
    identifier: string
  ): Promise<void>;

  export function cancelAllScheduledNotificationsAsync(): Promise<void>;
}
