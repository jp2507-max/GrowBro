import { DateTime } from 'luxon';
import React from 'react';
import { Platform, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  ReduceMotion,
  // @ts-ignore - Reanimated 4.x type exports issue - TODO: Track upstream fix for scrollTo types
  scrollTo,
  // @ts-ignore - Reanimated 4.x type exports issue - TODO: Track upstream fix for useAnimatedRef types
  useAnimatedRef,
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

// Number of weeks to render on each side of anchor week
const WEEKS_BUFFER = 2;

/**
 * Get the ISO week key for stable identification
 */
function getWeekKey(date: DateTime): string {
  return date.startOf('week').toFormat('yyyy-MM-dd');
}

/**
 * Calculate week offset between two dates
 */
function getWeekOffset(from: DateTime, to: DateTime): number {
  const fromWeekStart = from.startOf('week');
  const toWeekStart = to.startOf('week');
  return Math.round(toWeekStart.diff(fromWeekStart, 'weeks').weeks);
}

/**
 * Build days for multiple weeks centered on an anchor week.
 * The anchor week is stable (today's week) to prevent content shifting.
 */
function buildMultiWeekDays(
  anchorWeekStart: DateTime,
  selectedDate: DateTime,
  taskCounts?: Map<string, number>
): DayItem[][] {
  const weeks: DayItem[][] = [];

  for (
    let weekOffset = -WEEKS_BUFFER;
    weekOffset <= WEEKS_BUFFER;
    weekOffset++
  ) {
    const weekStart = anchorWeekStart.plus({ weeks: weekOffset });
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
  const selectedScale = useSharedValue(item.isSelected ? 1.08 : 1);

  React.useEffect(() => {
    selectedScale.value = withSpring(item.isSelected ? 1.08 : 1, {
      damping: 12,
      stiffness: 180,
      reduceMotion: ReduceMotion.System,
    });
  }, [item.isSelected, selectedScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * selectedScale.value }],
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
  // @ts-ignore - Reanimated 4.x: Animated.ScrollView type not exposed properly
  const scrollViewRef = useAnimatedRef<Animated.ScrollView>();
  const { width: screenWidth } = useWindowDimensions();
  const hasScrolledRef = React.useRef(false);
  const [isLayoutReady, setIsLayoutReady] = React.useState(false);

  // Anchor week is stable - only shifts when selected date goes outside buffer range
  const [anchorWeekStart, setAnchorWeekStart] = React.useState(() =>
    DateTime.now().startOf('week')
  );

  // Calculate offset from anchor to selected date's week
  const selectedWeekOffset = React.useMemo(
    () => getWeekOffset(anchorWeekStart, selectedDate),
    [anchorWeekStart, selectedDate]
  );

  // Shift anchor if selected date is outside the visible buffer
  React.useEffect(() => {
    if (Math.abs(selectedWeekOffset) > WEEKS_BUFFER) {
      setAnchorWeekStart(selectedDate.startOf('week'));
      hasScrolledRef.current = false; // Reset for instant scroll after anchor shift
    }
  }, [selectedWeekOffset, selectedDate]);

  // Build weeks centered on anchor (stable unless anchor shifts)
  const weeks = React.useMemo(
    () => buildMultiWeekDays(anchorWeekStart, selectedDate, taskCounts),
    [anchorWeekStart, selectedDate, taskCounts]
  );

  const handleLayout = React.useCallback(() => {
    if (!isLayoutReady) {
      setIsLayoutReady(true);
    }
  }, [isLayoutReady]);

  // Scroll to the correct week position based on offset from anchor
  React.useEffect(() => {
    if (isLayoutReady) {
      // Center index (WEEKS_BUFFER) + offset from anchor = target week index
      const targetWeekIndex = WEEKS_BUFFER + selectedWeekOffset;
      // Clamp to valid range
      const clampedIndex = Math.max(
        0,
        Math.min(targetWeekIndex, WEEKS_BUFFER * 2)
      );
      const scrollX = clampedIndex * screenWidth;
      scrollTo(scrollViewRef, scrollX, 0, hasScrolledRef.current);
      hasScrolledRef.current = true;
    }
  }, [selectedWeekOffset, screenWidth, isLayoutReady, scrollViewRef]);

  return (
    <Animated.ScrollView
      ref={scrollViewRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      pagingEnabled
      decelerationRate="fast"
      testID={testID}
      contentContainerStyle={styles.scrollContent}
      onLayout={handleLayout}
    >
      {weeks.map((weekDays) => (
        <View
          key={getWeekKey(weekDays[0].date)}
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
    </Animated.ScrollView>
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
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
