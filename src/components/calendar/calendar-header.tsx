import { LinearGradient } from 'expo-linear-gradient';
import { DateTime } from 'luxon';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { ContextChips } from '@/components/calendar/context-chips';
import {
  MonthPickerModal,
  useMonthPickerModal,
} from '@/components/calendar/month-picker-modal';
import { WeekStrip } from '@/components/calendar/week-strip';
import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Calendar } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

// Stitch-inspired organic gradient - deep forest green
const HEADER_GRADIENT_COLORS = {
  light: [colors.charcoal[950], colors.charcoal[950]] as const,
  dark: [colors.charcoal[950], colors.charcoal[950]] as const,
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  brandingText: {
    textShadowColor: colors.neon.lime,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});

type CalendarHeaderProps = {
  selectedDate: DateTime;
  onDateSelect: (date: DateTime) => void;
  insets: EdgeInsets;
  /** Map of date ISO strings (YYYY-MM-DD) to task counts for indicators */
  taskCounts?: Map<string, number>;
};

const HEADER_PADDING_TOP = 12;

/**
 * GrowBro branding - replaces day counter in Stitch design
 */
function HeaderBranding(): React.ReactElement {
  return (
    <View className="flex-col">
      <Text
        className="text-2xl font-bold tracking-tight text-lime-400"
        style={styles.brandingText}
      >
        GrowBro
      </Text>
      <Text className="text-[10px] font-medium uppercase tracking-widest text-white/50">
        {translate('calendar.header.lifecycle_tracker')}
      </Text>
    </View>
  );
}

/**
 * Month picker pill button with calendar icon - Stitch style
 */
function MonthPickerPill({
  selectedDate,
  onPress,
}: {
  selectedDate: DateTime;
  onPress: () => void;
}): React.ReactElement {
  const monthYear = selectedDate.toFormat('MMM yyyy');

  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-4 pr-1"
      accessibilityRole="button"
      accessibilityLabel={translate('calendar.month_picker.select_month')}
      accessibilityHint={translate('accessibility.calendar.month_picker_hint')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID="calendar-month-dropdown"
    >
      <Text className="text-sm font-bold text-white">{monthYear}</Text>
      <View className="size-8 items-center justify-center rounded-full bg-white/10">
        <Calendar size={18} color={colors.white} />
      </View>
    </Pressable>
  );
}

/**
 * Today button - jumps to current date
 */
function TodayButton({
  onPress,
  isToday,
}: {
  onPress: () => void;
  isToday: boolean;
}): React.ReactElement | null {
  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress();
  }, [onPress]);

  // Don't show if already viewing today
  if (isToday) return null;

  return (
    <Pressable
      onPress={handlePress}
      className="rounded-full border border-lime-400/30 bg-lime-400/10 px-3 py-1.5"
      accessibilityRole="button"
      accessibilityLabel={translate('calendar.header.jump_to_today')}
      accessibilityHint="Jumps to current date"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      testID="calendar-today-button"
    >
      <Text className="text-xs font-semibold text-lime-400">
        {translate('calendar.header.today')}
      </Text>
    </Pressable>
  );
}

export function CalendarHeader({
  selectedDate,
  onDateSelect,
  insets,
  taskCounts,
}: CalendarHeaderProps): React.ReactElement {
  const monthPickerModal = useMonthPickerModal();
  const today = React.useMemo(() => DateTime.now().startOf('day'), []);
  const isSelectedToday = selectedDate.hasSame(today, 'day');

  const handleMonthPickerOpen = React.useCallback(() => {
    monthPickerModal.present();
  }, [monthPickerModal]);

  const handleMonthSelect = React.useCallback(
    (date: DateTime) => {
      onDateSelect(date.startOf('day'));
    },
    [onDateSelect]
  );

  const handleJumpToToday = React.useCallback(() => {
    onDateSelect(today);
  }, [onDateSelect, today]);

  return (
    <>
      <LinearGradient
        colors={HEADER_GRADIENT_COLORS.dark}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.headerContainer,
          { paddingTop: insets.top + HEADER_PADDING_TOP },
        ]}
        testID="calendar-header"
      >
        {/* Top Row: GrowBro branding + Today + Month picker pill */}
        <View className="flex-row items-center justify-between pb-2">
          <HeaderBranding />
          <View className="flex-row items-center gap-2">
            <TodayButton
              onPress={handleJumpToToday}
              isToday={isSelectedToday}
            />
            <MonthPickerPill
              selectedDate={selectedDate}
              onPress={handleMonthPickerOpen}
            />
          </View>
        </View>

        {/* Week Strip - break out of px-4 and clip overflow */}
        <View className="-mx-4 mt-2 overflow-hidden">
          <WeekStrip
            selectedDate={selectedDate}
            onDateSelect={onDateSelect}
            taskCounts={taskCounts}
            testID="calendar-week-strip"
          />
        </View>

        {/* Context Chips */}
        <View className="-mx-4 mt-4">
          <ContextChips />
        </View>
      </LinearGradient>

      {/* Month Picker Modal */}
      <MonthPickerModal
        modalRef={monthPickerModal.ref}
        selectedDate={selectedDate}
        onMonthSelect={handleMonthSelect}
      />
    </>
  );
}
