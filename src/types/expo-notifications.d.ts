declare module 'expo-notifications' {
  interface NotificationContentInput {
    title?: string | null;
    subtitle?: string | null;
    body?: string | null;
    data?: Record<string, unknown>;
    badge?: number;
    sound?: boolean | string;
    launchImageName?: string;
    color?: string;
    autoDismiss?: boolean;
    categoryIdentifier?: string;
    sticky?: boolean;
    attachments?: NotificationContentAttachmentIos[];
    interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
    threadIdentifier?: string;
  }

  interface NotificationContentAndroid {
    priority?: AndroidNotificationPriority;
  }
}
