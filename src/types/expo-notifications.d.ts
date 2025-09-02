declare module 'react-native-keyboard-controller/jest';
declare module 'expo-notifications' {
  export type NotificationTriggerInput = {
    type: 'date';
    date: Date;
  };

  export function scheduleNotificationAsync(options: {
    content: { title?: string; body?: string; data?: Record<string, any> };
    trigger?: NotificationTriggerInput | null | undefined;
  }): Promise<string>;
}
