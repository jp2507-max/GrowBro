import { DateTime } from 'luxon';

import type { TxKeyPath } from '@/lib/i18n';
import type { NotificationSnapshot } from '@/lib/notifications/notification-storage';

type TranslateFn = (
  key: TxKeyPath,
  options?: Record<string, unknown>
) => string;

export type NotificationListItem =
  | { readonly type: 'section'; readonly key: string; readonly label: string }
  | {
      readonly type: 'notification';
      readonly key: string;
      readonly notification: NotificationSnapshot;
      readonly timestampLabel: string;
    };

type BuildNotificationListArgs = {
  readonly notifications: readonly NotificationSnapshot[];
  readonly locale: string;
  readonly now: Date;
  readonly translate: TranslateFn;
};

type FormatSectionArgs = {
  readonly created: DateTime;
  readonly now: DateTime;
  readonly translate: TranslateFn;
};

type FormatTimestampArgs = {
  readonly created: DateTime;
  readonly now: DateTime;
  readonly translate: TranslateFn;
};

export function buildNotificationListItems({
  notifications,
  locale,
  now,
  translate,
}: BuildNotificationListArgs): NotificationListItem[] {
  const nowDateTime = DateTime.fromJSDate(now).setLocale(locale).startOf('day');
  const items: NotificationListItem[] = [];
  const seenDayKeys = new Set<string>();

  for (const notification of notifications) {
    const created = DateTime.fromJSDate(notification.createdAt)
      .setLocale(locale)
      .startOf('minute');
    const dayKey = created.startOf('day').toISO() ?? `${notification.id}-day`;

    if (!seenDayKeys.has(dayKey)) {
      seenDayKeys.add(dayKey);
      items.push({
        type: 'section',
        key: `section-${dayKey}`,
        label: formatSectionLabel({ created, now: nowDateTime, translate }),
      });
    }

    items.push({
      type: 'notification',
      key: notification.id,
      notification,
      timestampLabel: formatTimestampLabel({
        created,
        now: nowDateTime,
        translate,
      }),
    });
  }

  return items;
}

function formatSectionLabel({
  created,
  now,
  translate,
}: FormatSectionArgs): string {
  const createdDay = created.startOf('day');
  const diffDays = Math.max(0, Math.floor(now.diff(createdDay, 'days').days));

  if (diffDays === 0) {
    return translate('notifications.inbox.sections.today');
  }
  if (diffDays === 1) {
    return translate('notifications.inbox.sections.yesterday');
  }
  const date = created.toLocaleString(DateTime.DATE_MED);
  return translate('notifications.inbox.sections.default', { date });
}

function formatTimestampLabel({
  created,
  now,
  translate,
}: FormatTimestampArgs): string {
  const createdDay = created.startOf('day');
  const diffDays = Math.max(0, Math.floor(now.diff(createdDay, 'days').days));
  const time = created.toLocaleString(DateTime.TIME_SIMPLE);

  if (diffDays === 0) {
    return translate('notifications.inbox.timestamp.today', { time });
  }
  if (diffDays === 1) {
    return translate('notifications.inbox.timestamp.yesterday', { time });
  }
  if (diffDays < 7) {
    const weekday = created.toLocaleString({ weekday: 'long' });
    return translate('notifications.inbox.timestamp.weekday', {
      weekday,
      time,
    });
  }
  const date = created.toLocaleString(DateTime.DATE_MED);
  return translate('notifications.inbox.timestamp.default', { date, time });
}
