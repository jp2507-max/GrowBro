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

let mockExpoPushToken: string | null = 'ExponentPushToken[MOCK]';
let pushTokenListener: ((payload: unknown) => void) | null = null;

export async function scheduleNotificationAsync(_: any): Promise<string> {
  return 'mock-notification-id';
}

export async function cancelScheduledNotificationAsync(
  _id: string
): Promise<void> {
  return;
}

export async function cancelAllScheduledNotificationsAsync(): Promise<void> {
  return;
}

export async function setNotificationChannelAsync(
  _id: string,
  _config: any
): Promise<void> {
  return;
}

export async function getExpoPushTokenAsync(_options?: any): Promise<{
  data?: string;
}> {
  if (!mockExpoPushToken) return { data: undefined };
  return { data: mockExpoPushToken };
}

export function addPushTokenListener(listener: (payload: unknown) => void): {
  remove: () => void;
} {
  pushTokenListener = listener;
  return {
    remove: () => {
      if (pushTokenListener === listener) {
        pushTokenListener = null;
      }
    },
  };
}

export function __setMockExpoPushToken(token: string | null): void {
  mockExpoPushToken = token;
}

export function __emitPushToken(payload: unknown): Promise<void> | void {
  const result = pushTokenListener?.(payload);
  if (result && typeof (result as Promise<any>).then === 'function') {
    return result as Promise<void>;
  }
  return result as void;
}

export async function getAllScheduledNotificationsAsync(): Promise<any[]> {
  return [];
}

export async function requestPermissionsAsync(): Promise<{
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  granted: boolean;
}> {
  return { status: 'granted', canAskAgain: false, granted: true };
}

export async function getPermissionsAsync(): Promise<{
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  granted: boolean;
}> {
  return { status: 'granted', canAskAgain: false, granted: true };
}

export const AndroidNotificationPriority = {
  MIN: -2,
  LOW: -1,
  DEFAULT: 0,
  HIGH: 1,
  MAX: 2,
} as const;

export const SchedulableTriggerInputTypes = {
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  YEARLY: 'yearly',
  CALENDAR: 'calendar',
} as const;
