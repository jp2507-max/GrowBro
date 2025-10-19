/**
 * PendingActionBadge
 *
 * Small badge indicator for pending actions (likes, comments, etc.)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { tv } from 'tailwind-variants';

import { Text, View } from '@/components/ui';

const badgeVariants = tv({
  slots: {
    container:
      'flex-row items-center justify-center self-start rounded-full px-2 py-0.5',
    text: 'text-xs font-medium',
  },
  variants: {
    status: {
      pending: {
        container: 'bg-warning-200 dark:bg-warning-900',
        text: 'text-warning-800 dark:text-warning-100',
      },
      failed: {
        container: 'bg-danger-200 dark:bg-danger-900',
        text: 'text-danger-800 dark:text-danger-100',
      },
      processed: {
        container: 'bg-success-200 dark:bg-success-900',
        text: 'text-success-800 dark:text-success-100',
      },
    },
  },
  defaultVariants: {
    status: 'pending',
  },
});

type PendingActionBadgeProps = {
  status: 'pending' | 'failed' | 'processed';
  className?: string;
};

export function PendingActionBadge({
  status,
  className,
}: PendingActionBadgeProps) {
  const { t } = useTranslation();
  const styles = badgeVariants({ status });

  // Don't show badge for processed actions
  if (status === 'processed') {
    return null;
  }

  return (
    <View className={styles.container({ className })}>
      <Text className={styles.text()}>
        {status === 'pending'
          ? t('pendingAction.pending')
          : t('pendingAction.failed')}
      </Text>
    </View>
  );
}
