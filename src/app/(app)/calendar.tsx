import React from 'react';

import { AgendaItemRow } from '@/components/calendar/agenda-item';
import { AgendaList } from '@/components/calendar/agenda-list';
import { DraggableAgendaItem } from '@/components/calendar/draggable-agenda-item';
import { DragDropProvider } from '@/components/calendar/drag-drop-provider';
import { Button, FocusAwareStatusBar, Text, View } from '@/components/ui';
import type { AgendaItem } from '@/types/agenda';

function useTodayAgenda(): { items: AgendaItem[]; isLoading: boolean } {
  const now = React.useMemo(() => new Date(), []);
  const todayId = now.toISOString().slice(0, 10);
  const items = React.useMemo<AgendaItem[]>(
    () => [
      {
        id: `header-${todayId}`,
        type: 'date-header',
        date: now,
        height: 32,
      },
    ],
    [now, todayId]
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
    <View className="flex-row items-center justify-between p-4">
      <Button
        variant="outline"
        size="sm"
        label="Prev"
        onPress={onPrev}
        className="w-24"
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
      />
    </View>
  );
}

export default function CalendarScreen(): React.ReactElement {
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date());
  const { items, isLoading } = useTodayAgenda();

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

  const renderItem = React.useCallback(({ item }: { item: AgendaItem }) => {
    if (item.type === 'date-header') {
      return (
        <View className="px-4 py-2">
          <Text className="text-xs uppercase text-neutral-500">Today</Text>
        </View>
      );
    }
    if (item.type === 'task' && item.task) {
      return <DraggableAgendaItem task={item.task as any} />;
    }
    return null;
  }, []);

  return (
    <DragDropProvider>
      <View className="flex-1">
        <FocusAwareStatusBar />
        <Header date={currentDate} onPrev={onPrev} onNext={onNext} />
        <AgendaList data={items} isLoading={isLoading} renderItem={renderItem} />
      </View>
    </DragDropProvider>
  );
}
