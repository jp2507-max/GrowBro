import type { AndroidNotificationPriority } from 'expo-notifications';

declare module 'expo-notifications' {
  interface NotificationContentInput {
    // Common fields used by the app when scheduling local notifications
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    // Expo supports either a string or boolean for the sound field across platforms
    sound?: string | boolean;
    interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
    threadIdentifier?: string;
  }

  interface NotificationContentAndroid {
    priority?: AndroidNotificationPriority;
  }
}
