declare module 'react-native-keyboard-controller/jest';
declare module 'expo-notifications' {
  interface NotificationContentInput {
    threadIdentifier?: string;
    subtitle?: string;
    badge?: number;
    color?: string;
    priority?: 'min' | 'low' | 'default' | 'high' | 'max';
  }

  interface NotificationTriggerInput {
    channelId?: string;
  }
}
