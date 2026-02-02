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
import { scheduleOnUI } from 'react-native-worklets';

import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';

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
// Total weeks rendered: anchor + buffer on each side
const TOTAL_WEEKS = WEEKS_BUFFER * 2 + 1;

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
    selectedScale.set(
      withSpring(item.isSelected ? 1.08 : 1, {
        damping: 12,
        stiffness: 180,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [item.isSelected, selectedScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() * selectedScale.get() }],
  }));

  const handlePressIn = React.useCallback(() => {
    haptics.selection();
    scale.set(
      withSpring(0.92, {
        damping: 10,
        stiffness: 350,
        reduceMotion: ReduceMotion.System,
      })
    );
  }, [scale]);

  const handlePressOut = React.useCallback(() => {
    scale.set(
      withSpring(1, {
        damping: 10,
        stiffness: 350,
        reduceMotion: ReduceMotion.System,
      })
    );
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
      className={cn(
        'items-center mx-0.5 px-2 py-4 min-w-[52px] rounded-[24px]',
        item.isSelected
          ? 'bg-lime-400'
          : item.isToday
            ? 'border border-lime-400/40 bg-white/10'
            : 'border border-white/5 bg-white/5'
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
        className={cn(
          'text-[10px] font-semibold uppercase tracking-wider',
          item.isSelected
            ? 'text-charcoal-950'
            : item.isToday
              ? 'text-lime-400'
              : 'text-white/50'
        )}
      >
        {item.dayOfWeek}
      </Text>
      <Text
        className={cn(
          'mt-1 text-xl font-bold',
          item.isSelected
            ? 'text-charcoal-950'
            : item.isToday
              ? 'text-white'
              : 'text-white'
        )}
      >
        {item.dayOfMonth}
      </Text>
      {/* Task indicator dot */}
      <View
        className={cn(
          'mt-2 size-1.5 rounded-full',
          item.taskCount > 0
            ? item.isSelected
              ? 'bg-charcoal-950'
              : 'bg-lime-400'
            : 'bg-transparent'
        )}
        testID={`task-indicator-${item.date.toFormat('yyyy-MM-dd')}`}
      />
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
  const scrollToWeek = React.useCallback(
    (x: number, animated: boolean): void => {
      scrollTo(scrollViewRef, x, 0, animated);
    },
    [scrollViewRef]
  );

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
        Math.min(targetWeekIndex, TOTAL_WEEKS - 1)
      );
      const scrollX = clampedIndex * screenWidth;
      scheduleOnUI(scrollToWeek, scrollX, hasScrolledRef.current);
      hasScrolledRef.current = true;
    }
  }, [selectedWeekOffset, screenWidth, isLayoutReady, scrollToWeek]);

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
    // No shadow for default pills in Stitch design
  },
  todayPill: {
    ...Platform.select({
      ios: {
        shadowColor: colors.neon.lime,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  selectedPill: {
    ...Platform.select({
      ios: {
        shadowColor: colors.neon.lime,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 15,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
