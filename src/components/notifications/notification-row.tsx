import React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import type { NotificationSnapshot } from '@/lib/notifications/notification-storage';

type Props = {
  readonly notification: NotificationSnapshot;
  readonly timestampLabel: string;
  readonly markAsReadLabel: string;
  readonly unreadLabel: string;
  readonly openHint: string;
  readonly onOpen: (notification: NotificationSnapshot) => void;
  readonly onMarkAsRead: (notification: NotificationSnapshot) => void;
};

export const NotificationRow = React.memo(function NotificationRow({
  notification,
  timestampLabel,
  markAsReadLabel,
  unreadLabel,
  openHint,
  onOpen,
  onMarkAsRead,
}: Props): React.ReactElement {
  const isUnread = notification.readAt === null;
  const accessibilityLabel = buildAccessibilityLabel({
    isUnread,
    unreadLabel,
    notification,
    timestampLabel,
  });
  const accessibilityHint = buildAccessibilityHint({
    isUnread,
    markAsReadLabel,
    openHint,
  });
  const cardClasses = isUnread
    ? 'border-primary-400/60 bg-primary-50/70 dark:border-primary-500/60 dark:bg-primary-500/15'
    : 'border-neutral-200 dark:border-charcoal-700 bg-card';

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      className={`mx-4 mt-3 rounded-2xl border px-4 py-3 shadow-sm shadow-black/5 ${cardClasses}`.trim()}
      onPress={() => onOpen(notification)}
      testID={`notification-row-${notification.id}`}
    >
      <View className="flex-row items-start justify-between gap-x-3">
        <View className="flex-1 gap-y-1">
          <View className="flex-row items-center gap-x-2">
            <UnreadIndicator
              isVisible={isUnread}
              notificationId={notification.id}
            />
            <Text
              className="text-base font-semibold text-charcoal-900 dark:text-neutral-100"
              numberOfLines={2}
            >
              {notification.title}
            </Text>
          </View>
          <Text
            className="text-sm text-neutral-600 dark:text-neutral-400"
            numberOfLines={3}
          >
            {notification.body}
          </Text>
          <Text className="text-text-secondary text-xs">{timestampLabel}</Text>
        </View>
        <MarkAsReadButton
          isVisible={isUnread}
          label={markAsReadLabel}
          notification={notification}
          onMarkAsRead={onMarkAsRead}
        />
      </View>
    </Pressable>
  );
});

NotificationRow.displayName = 'NotificationRow';

type AccessibilityLabelArgs = {
  isUnread: boolean;
  unreadLabel: string;
  notification: NotificationSnapshot;
  timestampLabel: string;
};

type AccessibilityHintArgs = {
  isUnread: boolean;
  markAsReadLabel: string;
  openHint: string;
};

function buildAccessibilityLabel({
  isUnread,
  unreadLabel,
  notification,
  timestampLabel,
}: AccessibilityLabelArgs): string {
  const parts = [
    isUnread ? unreadLabel : null,
    notification.title,
    notification.body,
    timestampLabel,
  ].filter(Boolean) as string[];
  return parts.join(', ');
}

function buildAccessibilityHint({
  isUnread,
  markAsReadLabel,
  openHint,
}: AccessibilityHintArgs): string {
  return isUnread ? `${markAsReadLabel}. ${openHint}` : openHint;
}

type UnreadIndicatorProps = {
  isVisible: boolean;
  notificationId: string;
};

function UnreadIndicator({
  isVisible,
  notificationId,
}: UnreadIndicatorProps): React.ReactElement | null {
  if (!isVisible) {
    return null;
  }
  return (
    <View
      accessibilityElementsHidden
      className="size-2 rounded-full bg-primary-500"
      importantForAccessibility="no"
      testID={`notification-row-${notificationId}-unread-indicator`}
    />
  );
}

type MarkAsReadButtonProps = {
  isVisible: boolean;
  label: string;
  notification: NotificationSnapshot;
  onMarkAsRead: (notification: NotificationSnapshot) => void;
};

function MarkAsReadButton({
  isVisible,
  label,
  notification,
  onMarkAsRead,
}: MarkAsReadButtonProps): React.ReactElement | null {
  if (!isVisible) {
    return null;
  }
  return (
    <Pressable
      accessibilityRole="button"
      className="self-start rounded-full px-3 py-1"
      onPress={(event) => {
        event.stopPropagation();
        onMarkAsRead(notification);
      }}
      testID={`notification-row-${notification.id}-mark-read`}
    >
      <Text className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
        {label}
      </Text>
    </Pressable>
  );
}
