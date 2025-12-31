import { DateTime } from 'luxon';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { twMerge } from 'tailwind-merge';

import { Pressable, Text, View } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = React.useCallback(() => {
    haptics.selection();
    scale.value = withSpring(0.92, {
      damping: 10,
      stiffness: 350,
      reduceMotion: ReduceMotion.System,
    });
  }, [scale]);

  const handlePressOut = React.useCallback(() => {
    scale.value = withSpring(1, {
      damping: 10,
      stiffness: 350,
      reduceMotion: ReduceMotion.System,
    });
  }, [scale]);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[item.isSelected && styles.selectedPill, animatedStyle]}
      className={twMerge(
        'mx-1.5 min-w-[52px] items-center rounded-2xl px-3 py-2.5',
        item.isSelected
          ? 'bg-primary-600'
          : 'border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-charcoal-800'
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
          'text-xs font-semibold',
          item.isSelected
            ? 'text-white/80'
            : item.isToday
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-neutral-500 dark:text-neutral-400'
        )}
      >
        {item.isToday ? todayLabel : item.dayOfWeek}
      </Text>
      <Text
        className={twMerge(
          'text-xl font-bold',
          item.isSelected
            ? 'text-white'
            : item.isToday
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-charcoal-900 dark:text-neutral-100'
        )}
      >
        {item.dayOfMonth}
      </Text>
    </AnimatedPressable>
  );
}

export function WeekStrip({
  selectedDate,
  onDateSelect,
  testID = 'week-strip',
}: WeekStripProps): React.ReactElement {
  const days = React.useMemo(() => buildWeekDays(selectedDate), [selectedDate]);

  return (
    <View testID={testID} className="flex-row justify-center">
      {days.map((item) => (
        <DayPill
          key={item.date.toISO()}
          item={item}
          onPress={() => onDateSelect(item.date)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  selectedPill: {
    ...Platform.select({
      ios: {
        shadowColor: '#16a34a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});
