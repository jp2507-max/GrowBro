import React from 'react';

import { AgendaList } from '@/components/calendar/agenda-list';
import { CalendarEmptyState } from '@/components/calendar/calendar-empty-state';
import { DragDropProvider } from '@/components/calendar/drag-drop-provider';
import { DraggableAgendaItem } from '@/components/calendar/draggable-agenda-item';
import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';
import type { AgendaItem } from '@/types/agenda';

function useTodayAgenda(currentDate: Date): {
  items: AgendaItem[];
  isLoading: boolean;
} {
  const todayId = currentDate.toISOString().slice(0, 10);
  const items = React.useMemo<AgendaItem[]>(
    () => [
      {
        id: `header-${todayId}`,
        type: 'date-header',
        date: currentDate,
        height: 32,
      },
    ],
    [currentDate, todayId]
  );
  return { items, isLoading: false };
}

function Header({
  date,
  onPrev,
  onNext,
}: {
  date: Date;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <View
      className="flex-row items-center justify-between p-4"
      testID="calendar-header"
    >
      <Button
        variant="outline"
        size="sm"
        label="Prev"
        onPress={onPrev}
        className="w-24"
        testID="calendar-prev-button"
      />
      <Text className="text-lg font-semibold">
        {date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })}
      </Text>
      <Button
        variant="outline"
        size="sm"
        label="Next"
        onPress={onNext}
        className="w-24"
        testID="calendar-next-button"
      />
    </View>
  );
}

export default function CalendarScreen(): React.ReactElement {
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const { items, isLoading } = useTodayAgenda(currentDate);

  const onPrev = React.useCallback(() => {
    setCurrentDate(
      (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)
    );
  }, []);
  const onNext = React.useCallback(() => {
    setCurrentDate(
      (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    );
  }, []);

  const onConvertToTask = React.useCallback(() => {
    // TODO: Navigate to task creation screen or open task creation modal
    console.log('Convert sample task to real task');
  }, []);

  const renderItem = React.useCallback(({ item }: { item: AgendaItem }) => {
    if (item.type === 'date-header') {
      return (
        <View className="px-4 py-2">
          <Text
            className="text-xs uppercase text-neutral-500"
            tx="calendar.today"
          />
        </View>
      );
    }
    if (item.type === 'task' && item.task) {
      return (
        <DraggableAgendaItem
          task={item.task as any}
          testID={`agenda-item-row-${item.task.id}`}
        />
      );
    }
    return null;
  }, []);

  const hasNoTasks = items.length === 1 && items[0].type === 'date-header';

  return (
    <DragDropProvider>
      <View className="flex-1" testID="calendar-screen">
        <FocusAwareStatusBar />
        <Header date={currentDate} onPrev={onPrev} onNext={onNext} />
        {hasNoTasks && !isLoading ? (
          <CalendarEmptyState onConvertToTask={onConvertToTask} />
        ) : (
          <AgendaList
            data={items}
            isLoading={isLoading}
            renderItem={renderItem}
          />
        )}
      </View>
    </DragDropProvider>
  );
}
