import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import colors from '@/components/ui/colors';
import { Text } from '@/components/ui/text';
import {
  cancelDatePickerSheetRequest,
  resolveDatePickerSheetRequest,
} from '@/lib/date-picker-sheet-registry';

function parseDateParam(
  param: string | string[] | undefined
): Date | undefined {
  if (!param) return undefined;
  const dateStr = Array.isArray(param) ? param[0] : param;
  const timestamp = Date.parse(dateStr);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp);
}

export default function DatePickerFormSheet(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const requestId = Array.isArray(params.requestId)
    ? params.requestId[0]
    : params.requestId;
  const title = Array.isArray(params.title) ? params.title[0] : params.title;

  const initialDate = React.useMemo(
    () => parseDateParam(params.value) ?? new Date(),
    [params.value]
  );
  const minDate = React.useMemo(
    () => parseDateParam(params.minimumDate),
    [params.minimumDate]
  );
  const maxDate = React.useMemo(
    () => parseDateParam(params.maximumDate),
    [params.maximumDate]
  );

  const [tempDate, setTempDate] = React.useState<Date>(initialDate);

  // Validate required params - log warning but let render guard handle the UI
  React.useEffect(() => {
    if (!requestId) {
      console.warn('[DatePickerFormSheet] Missing required requestId param');
    }
  }, [requestId]);

  // Handle cancel/dismiss
  const handleCancel = React.useCallback(() => {
    if (requestId) {
      cancelDatePickerSheetRequest(requestId);
    }
    router.back();
  }, [requestId, router]);

  // Handle confirm
  const handleConfirm = React.useCallback(() => {
    if (requestId) {
      resolveDatePickerSheetRequest(requestId, tempDate);
    }
    router.back();
  }, [requestId, tempDate, router]);

  const onChange = React.useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    },
    []
  );

  if (!requestId) {
    return <View className="flex-1 bg-white dark:bg-charcoal-900" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetAllowedDetents: [0.5, 0.8], // Allow half or mostly full screen
          sheetGrabberVisible: true,
        }}
      />
      <View className="flex-1 bg-white pt-4 dark:bg-charcoal-900">
        {/* Header */}
        <View className="mb-4 flex-row items-center justify-between px-4">
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            accessibilityHint={t('accessibility.modal.close_hint')}
            hitSlop={20}
          >
            <Text className="text-base font-medium text-primary-600 dark:text-primary-400">
              {t('common.cancel')}
            </Text>
          </Pressable>

          <Text className="text-base font-semibold text-charcoal-800 dark:text-neutral-100">
            {title || t('common.select_date')}
          </Text>

          <Pressable
            onPress={handleConfirm}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}
            accessibilityHint={t('accessibility.common.confirm_date_hint')}
            hitSlop={20}
          >
            <Text className="text-base font-bold text-primary-600 dark:text-primary-400">
              {t('common.done')}
            </Text>
          </Pressable>
        </View>

        {/* Date Picker */}
        <View className="flex-1 items-center px-4">
          <DateTimePicker
            testID="date-picker-sheet-datetimepicker"
            value={tempDate}
            mode="date"
            display="inline"
            onChange={onChange}
            minimumDate={minDate}
            maximumDate={maxDate}
            themeVariant={isDark ? 'dark' : 'light'}
            accentColor={colors.primary[600]}
            style={styles.picker}
            textColor={isDark ? colors.neutral[100] : colors.charcoal[900]}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  picker: {
    // Ensure picker honors width constraints
    width: Platform.OS === 'ios' ? '100%' : undefined,
  },
});
