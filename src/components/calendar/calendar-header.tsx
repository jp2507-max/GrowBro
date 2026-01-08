import { DateTime } from 'luxon';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Pressable } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import {
  MonthPickerModal,
  useMonthPickerModal,
} from '@/components/calendar/month-picker-modal';
import { WeekStrip } from '@/components/calendar/week-strip';
import { Text, View } from '@/components/ui';
import { GlassButton } from '@/components/ui/glass-button';
import { CaretDown } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import { getHeaderColors } from '@/lib/theme-utils';

type CalendarHeaderProps = {
  selectedDate: DateTime;
  onDateSelect: (date: DateTime) => void;
  insets: EdgeInsets;
  /** Map of date ISO strings (YYYY-MM-DD) to task counts for indicators */
  taskCounts?: Map<string, number>;
};

const HEADER_PADDING_TOP = 12;

/**
 * Month dropdown button that opens the month picker modal
 */
function MonthDropdown({
  selectedDate,
  onPress,
}: {
  selectedDate: DateTime;
  onPress: () => void;
}): React.ReactElement {
  const monthYear = selectedDate.toFormat('MMMM yyyy').toUpperCase();

  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-1"
      accessibilityRole="button"
      accessibilityLabel={translate('calendar.month_picker.select_month')}
      accessibilityHint={translate('accessibility.calendar.month_picker_hint')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID="calendar-month-dropdown"
    >
      <Text className="text-sm font-semibold tracking-wide text-white/90 dark:text-neutral-300">
        {monthYear}
      </Text>
      <CaretDown size={16} className="text-white/90 dark:text-neutral-300" />
    </Pressable>
  );
}

/**
 * "Today" quick-jump pill button with Glass effect
 */
function TodayButton({ onPress }: { onPress: () => void }): React.ReactElement {
  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress();
  }, [onPress]);

  return (
    <GlassButton
      onPress={handlePress}
      variant="pill"
      size={32}
      accessibilityLabel={translate('calendar.header.jump_to_today')}
      accessibilityHint={translate('accessibility.calendar.jump_to_today_hint')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID="calendar-today-button"
      fallbackClassName="border border-white/30 bg-white/95 dark:bg-charcoal-800/90"
    >
      <Text className="text-sm font-semibold text-charcoal-900 dark:text-neutral-100">
        {translate('calendar.header.today')}
      </Text>
    </GlassButton>
  );
}

/**
 * Day counter display: "DAY X / Y"
 */
function DayCounter({
  selectedDate,
}: {
  selectedDate: DateTime;
}): React.ReactElement {
  const dayOfMonth = selectedDate.day;
  const daysInMonth = selectedDate.daysInMonth ?? 31;

  return (
    <View
      className="flex-row items-baseline gap-px"
      accessibilityLabel={translate('calendar.day_counter', {
        day: dayOfMonth,
        total: daysInMonth,
      })}
      accessibilityHint={translate('accessibility.calendar.day_counter_hint')}
    >
      <Text className="text-4xl font-black tracking-tight text-neutral-900 dark:text-white">
        DAY {dayOfMonth}
      </Text>
      <Text className="text-xl font-medium text-neutral-400 dark:text-neutral-500">
        / {daysInMonth}
      </Text>
    </View>
  );
}

export function CalendarHeader({
  selectedDate,
  onDateSelect,
  insets,
  taskCounts,
}: CalendarHeaderProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const headerColors = getHeaderColors(isDark);

  const monthPickerModal = useMonthPickerModal();

  const handleTodayPress = React.useCallback(() => {
    onDateSelect(DateTime.now().startOf('day'));
  }, [onDateSelect]);

  const handleMonthPickerOpen = React.useCallback(() => {
    monthPickerModal.present();
  }, [monthPickerModal]);

  const handleMonthSelect = React.useCallback(
    (date: DateTime) => {
      onDateSelect(date.startOf('day'));
    },
    [onDateSelect]
  );

  return (
    <>
      <View
        className="z-0 px-4 pb-4"
        style={{
          paddingTop: insets.top + HEADER_PADDING_TOP,
          backgroundColor: headerColors.background,
        }}
        testID="calendar-header"
      >
        {/* Top Row: Month dropdown + Today button */}
        <View className="flex-row items-center justify-between">
          <MonthDropdown
            selectedDate={selectedDate}
            onPress={handleMonthPickerOpen}
          />
          <TodayButton onPress={handleTodayPress} />
        </View>

        {/* Day Counter */}
        <View className="mt-2">
          <DayCounter selectedDate={selectedDate} />
        </View>

        {/* Week Strip - break out of px-4 and clip overflow */}
        <View className="-mx-4 mt-4 overflow-hidden">
          <WeekStrip
            selectedDate={selectedDate}
            onDateSelect={onDateSelect}
            taskCounts={taskCounts}
            testID="calendar-week-strip"
          />
        </View>
      </View>

      {/* Month Picker Modal */}
      <MonthPickerModal
        modalRef={monthPickerModal.ref}
        selectedDate={selectedDate}
        onMonthSelect={handleMonthSelect}
      />
    </>
  );
}
