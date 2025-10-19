import type { AndroidNotificationPriority } from 'expo-notifications';

declare module 'expo-notifications' {
  interface NotificationContentInput {
    interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
    threadIdentifier?: string;
  }

  interface NotificationContentAndroid {
    priority?: AndroidNotificationPriority;
  }
}
