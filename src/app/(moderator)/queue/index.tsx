/**
 * Moderator Queue Screen
 * Main queue dashboard for content moderation with SLA monitoring
 * Requirements: 2.1, 2.2, 2.3
 */

import React from 'react';

import { useModeratorQueue } from '@/api/moderation/queue';
import {
  filterQueue,
  transformQueueItem,
} from '@/api/moderation/queue-service';
import { QueueFilters } from '@/components/moderation/queue-filters';
import { QueueList } from '@/components/moderation/queue-list';
import { Text, View } from '@/components/ui';
import { showErrorMessage } from '@/components/ui/utils';

export default function ModeratorQueueScreen() {
  const [priorityFilter, setPriorityFilter] = React.useState('all');
  // TODO: Get actual moderator ID from auth context
  const moderatorId = 'current-moderator-id';

  const {
    data: queueData,
    isLoading,
    refetch,
    error,
  } = useModeratorQueue({
    variables: { moderator_id: moderatorId },
  });

  React.useEffect(() => {
    if (error) {
      showErrorMessage('Failed to load moderation queue');
    }
  }, [error]);

  const filteredReports = React.useMemo(() => {
    if (!queueData?.items) return [];
    const queuedReports = queueData.items.map(transformQueueItem);
    if (priorityFilter === 'all') return queuedReports;
    const minPriority =
      priorityFilter === 'immediate'
        ? 90
        : priorityFilter === 'illegal'
          ? 70
          : priorityFilter === 'trusted'
            ? 50
            : 0;
    return filterQueue(queuedReports, { priority_min: minPriority });
  }, [queueData?.items, priorityFilter]);

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <View className="bg-card border-b border-neutral-200 px-4 py-3 dark:border-charcoal-700">
        <Text className="text-lg font-semibold text-charcoal-900 dark:text-neutral-100">
          Queue: {filteredReports.length} reports
        </Text>
        {queueData && (
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            {queueData.pending_count} pending {'· '}
            {queueData.overdue_count} overdue
          </Text>
        )}
      </View>

      <View className="px-4 pt-4">
        <QueueFilters
          activeFilter={priorityFilter}
          onFilterChange={setPriorityFilter}
        />
      </View>

      <QueueList
        reports={filteredReports}
        isLoading={isLoading}
        onRefresh={refetch}
      />
    </View>
  );
}
