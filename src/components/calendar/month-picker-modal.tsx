import { DateTime } from 'luxon';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { twMerge } from 'tailwind-merge';

import { Modal, Text, useModal, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowLeft, ArrowRight } from '@/components/ui/icons';
import { BottomSheetView } from '@/components/ui/modal';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

type MonthPickerModalProps = {
  modalRef: React.RefObject<
    ReturnType<typeof useModal>['ref']['current'] | null
  >;
  selectedDate: DateTime;
  onMonthSelect: (date: DateTime) => void;
};

function MonthButton({
  month,
  year,
  isSelected,
  isCurrent,
  onPress,
}: {
  month: number;
  year: number;
  isSelected: boolean;
  isCurrent: boolean;
  onPress: () => void;
}): React.ReactElement {
  const monthName = DateTime.local(year, month + 1).toFormat('MMM');

  const handlePress = React.useCallback(() => {
    haptics.selection();
    onPress();
  }, [onPress]);

  return (
    <Pressable
      onPress={handlePress}
      className={twMerge(
        'flex-1 items-center justify-center rounded-xl py-3',
        isSelected && 'bg-primary-600',
        isCurrent && !isSelected && 'bg-primary-100 dark:bg-primary-900/30'
      )}
      accessibilityRole="button"
      accessibilityLabel={monthName}
      accessibilityHint="Selects this month"
      accessibilityState={{ selected: isSelected }}
    >
      <Text
        className={twMerge(
          'text-base font-semibold',
          isSelected
            ? 'text-white'
            : isCurrent
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-neutral-800 dark:text-neutral-100'
        )}
      >
        {monthName}
      </Text>
    </Pressable>
  );
}

function YearSelector({
  year,
  onYearChange,
}: {
  year: number;
  onYearChange: (year: number) => void;
}): React.ReactElement {
  const handlePrevious = React.useCallback(() => {
    haptics.selection();
    onYearChange(year - 1);
  }, [year, onYearChange]);

  const handleNext = React.useCallback(() => {
    haptics.selection();
    onYearChange(year + 1);
  }, [year, onYearChange]);

  return (
    <View className="mb-4 flex-row items-center justify-center gap-6">
      <Pressable
        onPress={handlePrevious}
        className="size-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-charcoal-800"
        accessibilityRole="button"
        accessibilityLabel="Previous year"
        accessibilityHint="Goes to the previous year"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ArrowLeft color={colors.neutral[600]} />
      </Pressable>

      <Text className="min-w-[80px] text-center text-xl font-bold text-neutral-900 dark:text-neutral-100">
        {year}
      </Text>

      <Pressable
        onPress={handleNext}
        className="size-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-charcoal-800"
        accessibilityRole="button"
        accessibilityLabel="Next year"
        accessibilityHint="Goes to the next year"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ArrowRight color={colors.neutral[600]} />
      </Pressable>
    </View>
  );
}

export function MonthPickerModal({
  modalRef,
  selectedDate,
  onMonthSelect,
}: MonthPickerModalProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const today = DateTime.now();

  const [displayYear, setDisplayYear] = React.useState(selectedDate.year);

  // Sync display year when selectedDate changes
  React.useEffect(() => {
    setDisplayYear(selectedDate.year);
  }, [selectedDate.year]);

  const handleMonthSelect = React.useCallback(
    (month: number) => {
      const newDate = selectedDate.set({ year: displayYear, month: month + 1 });
      onMonthSelect(newDate);
      modalRef.current?.dismiss();
    },
    [selectedDate, displayYear, onMonthSelect, modalRef]
  );

  const title = translate('calendar.month_picker.title');

  const backgroundStyle = React.useMemo(
    () => ({
      backgroundColor: isDark ? colors.darkSurface.card : colors.white,
      borderTopLeftRadius: 35,
      borderTopRightRadius: 35,
    }),
    [isDark]
  );

  const handleStyle = React.useMemo(
    () => ({
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#D4D4D4',
      width: 48,
      height: 6,
      borderRadius: 3,
    }),
    [isDark]
  );

  return (
    <Modal
      ref={modalRef}
      snapPoints={['45%']}
      title={title}
      testID="month-picker-modal"
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={handleStyle}
    >
      <BottomSheetView style={styles.content}>
        <YearSelector year={displayYear} onYearChange={setDisplayYear} />

        {/* Month grid - 3 columns x 4 rows */}
        <View className="gap-2">
          {[0, 1, 2, 3].map((row) => (
            <View key={row} className="flex-row gap-2">
              {[0, 1, 2].map((col) => {
                const monthIndex = row * 3 + col;
                const isSelected =
                  selectedDate.month === monthIndex + 1 &&
                  selectedDate.year === displayYear;
                const isCurrent =
                  today.month === monthIndex + 1 && today.year === displayYear;

                return (
                  <MonthButton
                    key={monthIndex}
                    month={monthIndex}
                    year={displayYear}
                    isSelected={isSelected}
                    isCurrent={isCurrent}
                    onPress={() => handleMonthSelect(monthIndex)}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </BottomSheetView>
    </Modal>
  );
}

export { useModal as useMonthPickerModal };

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});
