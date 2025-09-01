export const AndroidImportance = {
  DEFAULT: 3,
  HIGH: 4,
  LOW: 2,
  MIN: 1,
  NONE: 0,
} as const;

export const AndroidNotificationVisibility = {
  PRIVATE: 0,
  PUBLIC: 1,
  SECRET: -1,
} as const;

export async function scheduleNotificationAsync(_: any): Promise<string> {
  return 'mock-notification-id';
}

export async function cancelScheduledNotificationAsync(
  _id: string
): Promise<void> {
  return;
}

export async function setNotificationChannelAsync(
  _id: string,
  _config: any
): Promise<void> {
  return;
}

export async function requestPermissionsAsync(): Promise<{
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
}> {
  return { status: 'granted', canAskAgain: false };
}

export async function getPermissionsAsync(): Promise<{
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
}> {
  return { status: 'granted', canAskAgain: false };
}
