import { useLocalSearchParams } from 'expo-router';
import { DateTime } from 'luxon';
import React from 'react';

import { SortableDayView } from '@/components/calendar/sortable-day-view.example';
import { ActivityIndicator, SafeAreaView, Text } from '@/components/ui';
import { getTasksByDateRange } from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

/**
 * Test route for Sortable Calendar integration.
 * Navigate to: /sortable-calendar-test?date=2025-05-15
 *
 * Purpose: Device testing for react-native-sortables intra-day task reordering.
 * This is a testable route for the SortableDayView example component.
 *
 * Feature flag: ENABLE_SORTABLES_CALENDAR must be enabled in .env
 */
export default function SortableCalendarTestScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();

  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadTasks = async () => {
      try {
        setIsLoading(true);
        // Create targetDate inside the effect to avoid unstable dependencies
        const targetDate = date ? new Date(date) : new Date();
        const startOfDay = DateTime.fromJSDate(targetDate).startOf('day');
        const endOfDay = DateTime.fromJSDate(targetDate).endOf('day');

        const fetchedTasks = await getTasksByDateRange(
          startOfDay.toJSDate(),
          endOfDay.toJSDate()
        );

        setTasks(fetchedTasks);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks');
      } finally {
        setIsLoading(false);
      }
    };

    void loadTasks();
  }, [date]);

  // Create targetDate for the component (must be before early returns)
  const displayDate = React.useMemo(
    () => (date ? new Date(date) : new Date()),
    [date]
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50 dark:bg-charcoal-950">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50 dark:bg-charcoal-950">
        <Text className="text-danger-600">{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <SortableDayView date={displayDate} tasks={tasks} />
    </SafeAreaView>
  );
}
