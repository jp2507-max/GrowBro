import { DateTime } from 'luxon';
import React from 'react';
import { ScrollView } from 'react-native';
import { twMerge } from 'tailwind-merge';

import { Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

type DayItem = {
  date: DateTime;
  dayOfWeek: string;
  dayOfMonth: number;
  isToday: boolean;
  isSelected: boolean;
};

type WeekStripProps = {
  selectedDate: DateTime;
  onDateSelect: (date: DateTime) => void;
  testID?: string;
};

function buildWeekDays(selectedDate: DateTime): DayItem[] {
  const today = DateTime.now().startOf('day');
  const days: DayItem[] = [];

  for (let offset = -3; offset <= 3; offset++) {
    const date = today.plus({ days: offset });
    days.push({
      date,
      dayOfWeek: date.toFormat('ccc').toUpperCase(),
      dayOfMonth: date.day,
      isToday: offset === 0,
      isSelected: date.hasSame(selectedDate, 'day'),
    });
  }

  return days;
}

function DayPill({
  item,
  onPress,
}: {
  item: DayItem;
  onPress: () => void;
}): React.ReactElement {
  const todayLabel = translate('calendar.week_strip.today');

  return (
    <Pressable
      onPress={onPress}
      className={twMerge(
        'mx-1 items-center rounded-2xl px-3 py-2',
        item.isSelected
          ? 'bg-primary-600'
          : 'bg-neutral-100 dark:bg-neutral-800'
      )}
      accessibilityRole="button"
      accessibilityLabel={
        item.date.toFormat('EEEE, MMMM d') +
        (item.isToday ? ', ' + todayLabel : '')
      }
      accessibilityHint={translate('calendar.week_strip.select_day_hint')}
      accessibilityState={{ selected: item.isSelected }}
      testID={'week-strip-day-' + item.date.toFormat('yyyy-MM-dd')}
    >
      <Text
        className={twMerge(
          'text-xs font-medium',
          item.isSelected
            ? 'text-white'
            : 'text-neutral-500 dark:text-neutral-400'
        )}
      >
        {item.isToday ? todayLabel : item.dayOfWeek}
      </Text>
      <Text
        className={twMerge(
          'text-lg font-bold',
          item.isSelected
            ? 'text-white'
            : 'text-charcoal-900 dark:text-neutral-100'
        )}
      >
        {item.dayOfMonth}
      </Text>
    </Pressable>
  );
}

export function WeekStrip({
  selectedDate,
  onDateSelect,
  testID = 'week-strip',
}: WeekStripProps): React.ReactElement {
  const days = React.useMemo(() => buildWeekDays(selectedDate), [selectedDate]);

  return (
    <View testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-2"
      >
        {days.map((item) => (
          <DayPill
            key={item.date.toISO()}
            item={item}
            onPress={() => onDateSelect(item.date)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
