import React from 'react';

import { Text, View } from '@/components/ui';
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
      <Text className={isOverdue ? 'text-red-600' : 'text-neutral-900'}>
        {task.title}
      </Text>
      {task.description ? (
        <Text className="text-xs text-neutral-500" numberOfLines={2}>
          {task.description}
        </Text>
      ) : null}
    </View>
  );
}
