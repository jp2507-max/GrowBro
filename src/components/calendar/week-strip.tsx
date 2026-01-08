import { DateTime } from 'luxon';
import React from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { twMerge } from 'tailwind-merge';

import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type DayItem = {
  date: DateTime;
  dayOfWeek: string;
  dayOfMonth: number;
  isToday: boolean;
  isSelected: boolean;
  taskCount: number;
};

type WeekStripProps = {
  selectedDate: DateTime;
  onDateSelect: (date: DateTime) => void;
  /** Map of date ISO strings (YYYY-MM-DD) to task counts */
  taskCounts?: Map<string, number>;
  testID?: string;
};

// Number of weeks to render on each side of current week
const WEEKS_BUFFER = 2;

/**
 * Build days for multiple weeks centered on the selected date's week
 */
function buildMultiWeekDays(
  selectedDate: DateTime,
  taskCounts?: Map<string, number>
): DayItem[][] {
  const weeks: DayItem[][] = [];
  const selectedWeekStart = selectedDate.startOf('week');

  for (
    let weekOffset = -WEEKS_BUFFER;
    weekOffset <= WEEKS_BUFFER;
    weekOffset++
  ) {
    const weekStart = selectedWeekStart.plus({ weeks: weekOffset });
    const weekDays = Array.from({ length: 7 }).map((_, dayIndex) => {
      const date = weekStart.plus({ days: dayIndex });
      const dateKey = date.toFormat('yyyy-MM-dd');
      return {
        date,
        dayOfWeek: date.toFormat('ccc').toUpperCase(),
        dayOfMonth: date.day,
        isToday: date.hasSame(DateTime.now(), 'day'),
        isSelected: date.hasSame(selectedDate, 'day'),
        taskCount: taskCounts?.get(dateKey) ?? 0,
      };
    });
    weeks.push(weekDays);
  }

  return weeks;
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

  // Determine pill style based on state
  const pillStyle = item.isSelected
    ? styles.selectedPill
    : item.isToday
      ? styles.todayPill
      : styles.defaultPill;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[pillStyle, animatedStyle]}
      className={twMerge(
        'mx-0.5 min-w-[44px] items-center rounded-[18px] px-2 py-3',
        item.isSelected
          ? 'bg-primary-500'
          : item.isToday
            ? 'border-2 border-primary-400 bg-white/95 dark:border-primary-500 dark:bg-charcoal-800/95'
            : 'bg-white/90 dark:bg-charcoal-800/80'
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
          'text-[10px] font-bold uppercase tracking-wider',
          item.isSelected
            ? 'text-white/90'
            : item.isToday
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-neutral-500 dark:text-neutral-400'
        )}
      >
        {item.isToday ? todayLabel : item.dayOfWeek}
      </Text>
      <Text
        className={twMerge(
          'mt-0.5 text-2xl font-black',
          item.isSelected
            ? 'text-white'
            : item.isToday
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-charcoal-900 dark:text-neutral-50'
        )}
      >
        {item.dayOfMonth}
      </Text>
      {/* Task indicator dot */}
      {item.taskCount > 0 && (
        <View
          className={twMerge(
            'mt-1.5 size-1.5 rounded-full',
            item.isSelected ? 'bg-white' : 'bg-primary-500 dark:bg-primary-400'
          )}
          testID={`task-indicator-${item.date.toFormat('yyyy-MM-dd')}`}
        />
      )}
    </AnimatedPressable>
  );
}

export function WeekStrip({
  selectedDate,
  onDateSelect,
  taskCounts,
  testID = 'week-strip',
}: WeekStripProps): React.ReactElement {
  const scrollViewRef = React.useRef<ScrollView>(null);
  const { width: screenWidth } = useWindowDimensions();
  const hasScrolledRef = React.useRef(false);

  const weeks = React.useMemo(
    () => buildMultiWeekDays(selectedDate, taskCounts),
    [selectedDate, taskCounts]
  );

  // Scroll to center week on first render and when selected date changes
  React.useEffect(() => {
    // Delay to ensure layout is complete
    const timer = setTimeout(() => {
      if (scrollViewRef.current) {
        // Scroll to center week (index = WEEKS_BUFFER)
        const scrollX = WEEKS_BUFFER * screenWidth;
        scrollViewRef.current.scrollTo({
          x: scrollX,
          animated: hasScrolledRef.current,
        });
        hasScrolledRef.current = true;
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedDate, screenWidth]);

  return (
    <ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      pagingEnabled
      decelerationRate="fast"
      testID={testID}
      contentContainerStyle={styles.scrollContent}
    >
      {weeks.map((weekDays, weekIndex) => (
        <View
          key={`week-${weekIndex}`}
          style={{ width: screenWidth }}
          className="flex-row justify-evenly px-2"
        >
          {weekDays.map((item) => (
            <DayPill
              key={item.date.toISO()}
              item={item}
              onPress={() => onDateSelect(item.date)}
            />
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'center',
  },
  defaultPill: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  todayPill: {
    ...Platform.select({
      ios: {
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  selectedPill: {
    ...Platform.select({
      ios: {
        shadowColor: colors.primary[600],
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
    }),
  },
});
