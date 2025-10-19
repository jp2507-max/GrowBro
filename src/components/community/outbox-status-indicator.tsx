/**
 * OutboxStatusIndicator
 *
 * Shows pending/failed status for queued actions with retry/cancel options
 */

import React from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { tv } from 'tailwind-variants';

import { Text, View } from '@/components/ui';
import { database } from '@/lib/watermelon';

import { getOutboxProcessor } from '../../lib/community/outbox-processor';

const statusVariants = tv({
  slots: {
    container: 'flex-row items-center gap-2 rounded-lg px-3 py-2',
    text: 'text-sm font-medium',
    button: 'rounded px-2 py-1',
    buttonText: 'text-xs font-semibold',
  },
  variants: {
    status: {
      pending: {
        container: 'dark:bg-warning-950 bg-warning-100',
        text: 'text-warning-800 dark:text-warning-200',
      },
      failed: {
        container: 'dark:bg-danger-950 bg-danger-100',
        text: 'text-danger-800 dark:text-danger-200',
      },
    },
  },
});

interface OutboxStatusIndicatorProps {
  entryId: string;
  status: 'pending' | 'failed';
  retryCount?: number;
  className?: string;
}

export function OutboxStatusIndicator({
  entryId,
  status,
  retryCount = 0,
  className,
}: OutboxStatusIndicatorProps) {
  const [isRetrying, setIsRetrying] = React.useState(false);
  const styles = statusVariants({ status });
  const outboxProcessor = getOutboxProcessor(database);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await outboxProcessor.retryEntry(entryId);
    } catch (error) {
      console.error('Failed to retry entry:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancel = async () => {
    try {
      await outboxProcessor.cancelEntry(entryId);
    } catch (error) {
      console.error('Failed to cancel entry:', error);
    }
  };

  if (status === 'pending') {
    return (
      <View className={styles.container({ className })}>
        <ActivityIndicator size="small" />
        <Text className={styles.text()}>
          {retryCount > 0 ? `Retrying (${retryCount}/5)...` : 'Sending...'}
        </Text>
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View className={styles.container({ className })}>
        <Text className={styles.text()}>Failed to send</Text>
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            onPress={handleRetry}
            disabled={isRetrying}
            className={styles.button({
              className: 'bg-danger-600 dark:bg-danger-700',
            })}
          >
            <Text className={styles.buttonText({ className: 'text-white' })}>
              {isRetrying ? 'Retrying...' : 'Retry'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={handleCancel}
            className={styles.button({
              className: 'bg-neutral-300 dark:bg-neutral-700',
            })}
          >
            <Text
              className={styles.buttonText({
                className: 'text-neutral-800 dark:text-neutral-200',
              })}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return null;
}
