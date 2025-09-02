import React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { Task } from '@/types/calendar';

type Props = {
  task: Pick<
    Task,
    'title' | 'description' | 'dueAtLocal' | 'status' | 'reminderAtLocal'
  > & { id: string };
  now?: Date;
};

export function AgendaItemRow({ task, now }: Props): React.ReactElement {
  const isOverdue = React.useMemo(() => {
    if (task.status !== 'pending') return false;
    const reference = now ?? new Date();
    const due = new Date(task.dueAtLocal);
    return isFinite(due.getTime()) && due.getTime() < reference.getTime();
  }, [now, task.dueAtLocal, task.status]);

  return (
    <View className="px-4 py-3">
      <View className="flex-row items-center gap-2">
        <Text className={isOverdue ? 'text-red-600' : 'text-neutral-900'}>
          {task.title}
        </Text>
        {'metadata' in task && (task as any).metadata?.needsReview ? (
          <View
            accessibilityLabel={translate('calendar.needs_review_label')}
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
