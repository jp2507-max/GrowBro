import React from 'react';
import { View } from 'react-native';

import { DragHandle } from '@/components/calendar/drag-handle';
import type { EventType } from '@/components/calendar/event-type-icon';
import { EventTypeIcon } from '@/components/calendar/event-type-icon';
import { Text } from '@/components/ui/text';
import { translate } from '@/lib/i18n';
import type { Task } from '@/types/calendar';

// Metadata fields used in agenda items
type AgendaItemMetadata = {
  eventType?: string;
  outOfRange?: boolean;
  needsReview?: boolean;
};

type Props = {
  task: Pick<
    Task,
    'title' | 'description' | 'dueAtLocal' | 'status' | 'reminderAtLocal'
  > & { id: string };
  now?: Date;
  /**
   * Whether to show the drag handle for reordering
   */
  showDragHandle?: boolean;
  testID?: string;
};

export function AgendaItemRow({
  task,
  now,
  showDragHandle = false,
  testID,
}: Props): React.ReactElement {
  const isOverdue = React.useMemo(() => {
    if (task.status !== 'pending') return false;
    const reference = now ?? new Date();
    const due = new Date(task.dueAtLocal);
    return isFinite(due.getTime()) && due.getTime() < reference.getTime();
  }, [now, task.dueAtLocal, task.status]);

  const eventType = React.useMemo<EventType | null>(() => {
    if ('metadata' in task) {
      const metadata = task.metadata as AgendaItemMetadata;
      const t = metadata.eventType;
      if (t === 'feeding' || t === 'flush' || t === 'top_dress') return t;
    }
    return null;
  }, [task]);

  const isOutOfRange = React.useMemo(() => {
    if ('metadata' in task) {
      const metadata = task.metadata as AgendaItemMetadata;
      return Boolean(metadata.outOfRange);
    }
    return false;
  }, [task]);

  return (
    <View className="px-4 py-3" testID={testID}>
      <View className="flex-row items-center gap-2">
        {showDragHandle ? <DragHandle /> : null}
        {eventType ? (
          <EventTypeIcon
            type={eventType}
            size={14}
            color={isOverdue ? '#dc2626' : '#111827'}
            testID={`event-icon-${eventType}`}
          />
        ) : null}
        <Text className={isOverdue ? 'text-red-600' : 'text-neutral-900'}>
          {task.title}
        </Text>
        {isOutOfRange ? (
          <View
            accessibilityLabel={translate('calendar.out_of_range_label')}
            accessibilityHint={translate(
              'accessibility.calendar.out_of_range_hint'
            )}
            className="ml-1 rounded-full bg-rose-600 px-2 py-0.5"
          >
            <Text className="text-[10px] text-white">
              {translate('calendar.out_of_range')}
            </Text>
          </View>
        ) : null}
        {'metadata' in task &&
        (task.metadata as AgendaItemMetadata).needsReview ? (
          <View
            accessibilityLabel={translate('calendar.needs_review_label')}
            accessibilityHint={translate(
              'accessibility.calendar.needs_review_hint'
            )}
            className="ml-1 rounded-full bg-amber-500 px-2 py-0.5"
          >
            <Text className="text-[10px] text-white">
              {translate('calendar.review')}
            </Text>
          </View>
        ) : null}
      </View>
      {task.description ? (
        <Text className="text-xs text-neutral-500" numberOfLines={2}>
          {task.description}
        </Text>
      ) : null}
    </View>
  );
}
