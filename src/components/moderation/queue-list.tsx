/**
 * Queue List Component
 * Renders list of queued reports with priority lanes
 * Requirements: 2.1, 2.2, 2.3
 */

import React from 'react';

import { ActivityIndicator, FlashList, Text, View } from '@/components/ui';
import type { QueuedReport } from '@/types/moderation';

import { QueueItem } from './queue-item';

type Props = {
  reports: QueuedReport[];
  isLoading?: boolean;
  onRefresh?: () => void;
  testID?: string;
};

export function QueueList({
  reports,
  isLoading = false,
  onRefresh,
  testID = 'queue-list',
}: Props) {
  if (isLoading && reports.length === 0) {
    return (
      <View
        className="flex-1 items-center justify-center"
        testID={`${testID}-loading`}
      >
        <ActivityIndicator size="large" />
        <Text
          className="mt-4 text-neutral-600 dark:text-neutral-400"
          tx="moderation.queue.loading"
        />
      </View>
    );
  }

  if (reports.length === 0) {
    return (
      <View
        className="flex-1 items-center justify-center p-6"
        testID={`${testID}-empty`}
      >
        <Text
          className="text-center text-lg font-medium text-neutral-700 dark:text-neutral-300"
          tx="moderation.queue.empty.title"
        />
        <Text
          className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400"
          tx="moderation.queue.empty.subtitle"
        />
      </View>
    );
  }

  return (
    <FlashList
      data={reports as unknown[]}
      renderItem={({ item }: { item: unknown }) => (
        <QueueItem report={item as QueuedReport} />
      )}
      keyExtractor={(item: unknown) => (item as QueuedReport).id}
      contentContainerClassName="px-4 py-2"
      onRefresh={onRefresh}
      refreshing={isLoading}
      testID={testID}
    />
  );
}
