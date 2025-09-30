import * as Notifications from 'expo-notifications';

type SetBadgeCountFn = (count: number) => Promise<void>;

const notificationsModule = Notifications as unknown as {
  setBadgeCountAsync?: SetBadgeCountFn;
};

const setBadgeCountAsync: SetBadgeCountFn =
  notificationsModule.setBadgeCountAsync ?? (async () => {});

const BADGE_TAG = '[notification-badge]';

function sanitizeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  return Math.floor(count);
}

export async function updateAppBadgeCount(count: number): Promise<void> {
  const sanitized = sanitizeCount(count);
  try {
    await setBadgeCountAsync(sanitized);
  } catch (error) {
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    console.warn(`${BADGE_TAG} failed to update badge`, message);
  }
}

export function __sanitizeBadgeCount(count: number): number {
  return sanitizeCount(count);
}
