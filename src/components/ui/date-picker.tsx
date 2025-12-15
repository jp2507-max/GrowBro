import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from 'react-hook-form';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, View } from 'react-native';
import { tv } from 'tailwind-variants';

import { Calendar } from '@/components/ui/icons';

import colors from './colors';
import { Modal, useModal } from './modal';
import { Text } from './text';

const datePickerTv = tv({
  slots: {
    container: 'mb-4',
    label: 'text-grey-100 mb-1 text-lg dark:text-neutral-100',
    input:
      'border-grey-50 mt-0 flex-row items-center justify-between rounded-xl border-[0.5px] p-3 dark:border-neutral-500 dark:bg-neutral-800',
    inputValue: 'dark:text-neutral-100',
    placeholder: 'text-neutral-400',
  },
  variants: {
    focused: {
      true: {
        input: 'border-neutral-600',
      },
    },
    error: {
      true: {
        input: 'border-danger-600',
        label: 'text-danger-600 dark:text-danger-600',
        inputValue: 'text-danger-600',
      },
    },
    disabled: {
      true: {
        input: 'bg-neutral-200',
      },
    },
  },
  defaultVariants: {
    error: false,
    disabled: false,
  },
});

export type DatePickerProps = {
  value?: Date | string;
  label?: string;
  disabled?: boolean;
  error?: string;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  testID?: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

type TRule<T extends FieldValues> =
  | Omit<
      RegisterOptions<T>,
      'disabled' | 'valueAsNumber' | 'valueAsDate' | 'setValueAs'
    >
  | undefined;

type DatePickerControllerType<T extends FieldValues> = {
  name: Path<T>;
  control: Control<T>;
  rules?: TRule<T>;
};

type ControlledDatePickerProps<T extends FieldValues> = Omit<
  DatePickerProps,
  'value' | 'onChange'
> &
  DatePickerControllerType<T>;

function parseDate(value: Date | string | undefined): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDateDisplay(date: Date | undefined, locale: string): string {
  if (!date) return '';
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

type IOSDatePickerModalProps = {
  modal: ReturnType<typeof useModal>;
  tempDate: Date;
  label?: string;
  testID?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  isDark: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  onReset: () => void;
  onDateChange: (event: DateTimePickerEvent, date?: Date) => void;
};

type DatePickerTriggerProps = {
  label?: string;
  displayValue: string;
  placeholder?: string;
  disabled: boolean;
  isOpen: boolean;
  error?: string;
  testID?: string;
  isDark: boolean;
  styles: ReturnType<typeof datePickerTv>;
  onPress: () => void;
};

function DatePickerTrigger({
  label,
  displayValue,
  placeholder,
  disabled,
  isOpen,
  error,
  testID,
  isDark,
  styles,
  onPress,
}: DatePickerTriggerProps) {
  const { t } = useTranslation();

  return (
    <View className={styles.container()}>
      {label && (
        <Text
          testID={testID ? `${testID}-label` : undefined}
          className={styles.label()}
        >
          {label}
        </Text>
      )}
      <Pressable
        className={styles.input()}
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label ?? placeholder}
        accessibilityHint={
          disabled
            ? undefined
            : t('accessibility.common.select_open_hint', {
                label: label ?? placeholder,
              })
        }
        accessibilityState={{ disabled, expanded: isOpen }}
        testID={testID ? `${testID}-trigger` : undefined}
      >
        <View className="flex-1">
          {displayValue ? (
            <Text className={styles.inputValue()}>{displayValue}</Text>
          ) : (
            <Text className={styles.placeholder()}>
              {placeholder ?? t('common.select_date')}
            </Text>
          )}
        </View>
        <Calendar
          width={20}
          height={20}
          color={isDark ? colors.neutral[400] : colors.neutral[500]}
        />
      </Pressable>
      {error && (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          className="text-sm text-danger-300 dark:text-danger-600"
        >
          {error}
        </Text>
      )}
    </View>
  );
}

function IOSDatePickerModal({
  modal,
  tempDate,
  label,
  testID,
  minimumDate,
  maximumDate,
  isDark,
  onDismiss,
  onConfirm,
  onReset,
  onDateChange,
}: IOSDatePickerModalProps) {
  const { t } = useTranslation();

  const backgroundStyle = React.useMemo(
    () => ({
      backgroundColor: isDark ? colors.charcoal[900] : colors.neutral[50],
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    }),
    [isDark]
  );

  const handleStyle = React.useMemo(
    () => ({
      backgroundColor: isDark ? colors.charcoal[600] : colors.neutral[400],
      width: 40,
      height: 5,
    }),
    [isDark]
  );

  return (
    <Modal
      ref={modal.ref}
      snapPoints={['50%']}
      onDismiss={onDismiss}
      backgroundStyle={backgroundStyle}
      handleIndicatorStyle={handleStyle}
    >
      <View className="flex-1 px-4 pb-6">
        <View className="mb-4 flex-row items-center justify-between">
          <Pressable
            onPress={onReset}
            accessibilityRole="button"
            accessibilityLabel={t('common.reset')}
            accessibilityHint={t('accessibility.common.reset_date_hint')}
            testID={testID ? `${testID}-reset` : undefined}
          >
            <Text className="text-base font-medium text-primary-600">
              {t('common.reset')}
            </Text>
          </Pressable>
          <Text className="text-base font-semibold text-charcoal-800 dark:text-neutral-100">
            {label}
          </Text>
          <Pressable
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}
            accessibilityHint={t('accessibility.common.confirm_date_hint')}
            testID={testID ? `${testID}-done` : undefined}
          >
            <Text className="text-base font-semibold text-primary-600">
              {t('common.done')}
            </Text>
          </Pressable>
        </View>

        <View className="flex-1 items-center justify-center">
          <DateTimePicker
            testID={testID ? `${testID}-picker` : undefined}
            value={tempDate}
            mode="date"
            display="inline"
            onChange={onDateChange}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            themeVariant={isDark ? 'dark' : 'light'}
            accentColor={colors.primary[600]}
          />
        </View>
      </View>
    </Modal>
  );
}

function useDatePickerState(props: DatePickerProps) {
  const {
    value,
    error,
    disabled = false,
    onChange,
    minimumDate,
    maximumDate,
  } = props;
  const modal = useModal();
  const { i18n } = useTranslation();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isOpen, setIsOpen] = React.useState(false);

  const parsedDate = React.useMemo(() => parseDate(value), [value]);
  const [tempDate, setTempDate] = React.useState<Date>(
    parsedDate ?? new Date()
  );

  React.useEffect(() => {
    if (parsedDate) setTempDate(parsedDate);
  }, [parsedDate]);

  const styles = React.useMemo(
    () => datePickerTv({ error: Boolean(error), disabled }),
    [error, disabled]
  );

  const displayValue = React.useMemo(
    () => formatDateDisplay(parsedDate, i18n.language),
    [parsedDate, i18n.language]
  );

  const handleOpenPicker = React.useCallback(() => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: parsedDate ?? new Date(),
        onChange: (_event: DateTimePickerEvent, selectedDate?: Date) => {
          if (selectedDate) onChange?.(selectedDate);
        },
        mode: 'date',
        minimumDate,
        maximumDate,
      });
    } else {
      setTempDate(parsedDate ?? new Date());
      setIsOpen(true);
      modal.present();
    }
  }, [disabled, parsedDate, onChange, minimumDate, maximumDate, modal]);

  const handleDismiss = React.useCallback(() => setIsOpen(false), []);
  const handleIOSChange = React.useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (selectedDate) setTempDate(selectedDate);
    },
    []
  );
  const handleConfirm = React.useCallback(() => {
    onChange?.(tempDate);
    modal.dismiss();
    setIsOpen(false);
  }, [onChange, tempDate, modal]);
  const handleReset = React.useCallback(() => {
    onChange?.(undefined);
    modal.dismiss();
    setIsOpen(false);
  }, [onChange, modal]);

  return {
    modal,
    isDark,
    isOpen,
    tempDate,
    styles,
    displayValue,
    handleOpenPicker,
    handleDismiss,
    handleIOSChange,
    handleConfirm,
    handleReset,
  };
}

export function DatePicker(props: DatePickerProps) {
  const {
    label,
    placeholder,
    disabled = false,
    error,
    testID,
    minimumDate,
    maximumDate,
  } = props;
  const {
    modal,
    isDark,
    isOpen,
    tempDate,
    styles,
    displayValue,
    handleOpenPicker,
    handleDismiss,
    handleIOSChange,
    handleConfirm,
    handleReset,
  } = useDatePickerState(props);

  return (
    <>
      <DatePickerTrigger
        label={label}
        displayValue={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        isOpen={isOpen}
        error={error}
        testID={testID}
        isDark={isDark}
        styles={styles}
        onPress={handleOpenPicker}
      />

      {Platform.OS === 'ios' && (
        <IOSDatePickerModal
          modal={modal}
          tempDate={tempDate}
          label={label}
          testID={testID}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          isDark={isDark}
          onDismiss={handleDismiss}
          onConfirm={handleConfirm}
          onReset={handleReset}
          onDateChange={handleIOSChange}
        />
      )}
    </>
  );
}

export function ControlledDatePicker<T extends FieldValues>(
  props: ControlledDatePickerProps<T>
) {
  const { name, control, rules, ...datePickerProps } = props;

  const { field, fieldState } = useController({ control, name, rules });

  const handleChange = React.useCallback(
    (date: Date | undefined) => {
      field.onChange(date ? formatDateISO(date) : undefined);
    },
    [field]
  );

  return (
    <DatePicker
      onChange={handleChange}
      value={field.value as string | undefined}
      error={fieldState.error?.message}
      {...datePickerProps}
    />
  );
}
