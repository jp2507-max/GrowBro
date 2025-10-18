/**
 * PendingActionBadge
 *
 * Small badge indicator for pending actions (likes, comments, etc.)
 */

import React from 'react';
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
      confirmed: {
        container: 'bg-success-200 dark:bg-success-900',
        text: 'text-success-800 dark:text-success-100',
      },
    },
  },
  defaultVariants: {
    status: 'pending',
  },
});

interface PendingActionBadgeProps {
  status: 'pending' | 'failed' | 'confirmed';
  className?: string;
}

export function PendingActionBadge({
  status,
  className,
}: PendingActionBadgeProps) {
  const styles = badgeVariants({ status });

  // Don't show badge for confirmed actions
  if (status === 'confirmed') {
    return null;
  }

  return (
    <View className={styles.container({ className })}>
      <Text className={styles.text()}>
        {status === 'pending' ? 'Pending' : 'Failed'}
      </Text>
    </View>
  );
}
