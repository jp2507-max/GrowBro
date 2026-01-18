import { useFocusEffect } from '@react-navigation/native';
import * as React from 'react';
import { Pressable } from 'react-native';

import { Text, View } from '@/components/ui';
import { getOutboxProcessor } from '@/lib/community/outbox-processor';
import { translate } from '@/lib/i18n';
import { database } from '@/lib/watermelon';

type OutboxBannerProps = {
  pollIntervalMs?: number;
  testID?: string;
};

export function OutboxBanner({
  pollIntervalMs = 1500,
  testID = 'community-outbox-banner',
}: OutboxBannerProps): React.ReactElement | null {
  const outboxProcessor = React.useMemo(() => getOutboxProcessor(database), []);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [failedCount, setFailedCount] = React.useState(0);
  const [isRetrying, setIsRetrying] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      let interval: ReturnType<typeof setInterval> | null = null;

      const poll = async (): Promise<void> => {
        try {
          const status = await outboxProcessor.getStatus();
          if (!isActive) return;
          setPendingCount(status.pending);
          setFailedCount(status.failed);
        } catch (error) {
          console.error('[OutboxBanner] Failed to poll outbox status', error);
        }
      };

      void poll();
      interval = setInterval(() => {
        void poll();
      }, pollIntervalMs);

      return () => {
        isActive = false;
        if (interval) clearInterval(interval);
      };
    }, [outboxProcessor, pollIntervalMs])
  );

  const hasPending = pendingCount > 0;
  const hasFailed = failedCount > 0;

  const handleRetry = React.useCallback(async (): Promise<void> => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await outboxProcessor.processQueue();
    } catch (error) {
      console.error('[OutboxBanner] Retry failed', error);
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, outboxProcessor]);

  if (!hasPending && !hasFailed) {
    return null;
  }

  if (hasFailed) {
    return (
      <View
        className="dark:bg-danger-950 flex-row items-center justify-between rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 dark:border-danger-700"
        testID={testID}
      >
        <Text className="text-sm font-medium text-danger-800 dark:text-danger-200">
          {translate('community.outbox_failed')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={translate('community.outbox_retry')}
          accessibilityHint={translate(
            'accessibility.community.outbox_retry_hint'
          )}
          onPress={handleRetry}
          disabled={isRetrying}
          className="min-h-11 rounded-md bg-danger-600 px-3 py-1.5 dark:bg-danger-700"
        >
          <Text className="text-xs font-semibold text-white">
            {isRetrying
              ? translate('community.outbox_retrying')
              : translate('community.outbox_retry')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      className="flex-row items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 dark:border-warning-700 dark:bg-warning-950"
      testID={testID}
    >
      <Text className="text-sm font-medium text-warning-800 dark:text-warning-200">
        {translate('community.outbox_sending')}
      </Text>
    </View>
  );
}
