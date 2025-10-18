declare module 'expo-notifications' {
  type NotificationContentInput = {
    title?: string | null;
    subtitle?: string | null;
    body?: string | null;
    data?: Record<string, unknown>;
    badge?: number;
    sound?: boolean | string;
    launchImageName?: string;
    vibrate?: number[];
    priority?: string;
    color?: string;
    autoDismiss?: boolean;
    categoryIdentifier?: string;
    sticky?: boolean;
    attachments?: any[]; // NotificationContentAttachmentIos[]
    interruptionLevel?: 'passive' | 'active' | 'timeSensitive' | 'critical';
    threadIdentifier?: string;
  };
}
