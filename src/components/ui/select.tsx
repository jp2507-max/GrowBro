import {
  BottomSheetFlatList,
  type BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import type { FieldValues } from 'react-hook-form';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, type PressableProps, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';
import { tv } from 'tailwind-variants';

import colors from '@/components/ui/colors';
import { CaretDown } from '@/components/ui/icons';

import type { InputControllerType } from './input';
import { Modal, useModal } from './modal';
import { Text } from './text';

const selectTv = tv({
  slots: {
    container: 'mb-4',
    label: 'text-grey-100 mb-1 text-lg dark:text-neutral-100',
    input:
      'border-grey-50 mt-0 flex-row items-center justify-center rounded-xl border-[0.5px] p-3  dark:border-neutral-500 dark:bg-neutral-800',
    inputValue: 'dark:text-neutral-100',
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

const List = Platform.OS === 'web' ? FlashList : BottomSheetFlatList;

export type OptionType = { label: string; value: string | number };

type OptionsProps = {
  options: OptionType[];
  onSelect: (option: OptionType) => void;
  value?: string | number;
  testID?: string;
  onDismiss?: () => void;
  title?: string;
};

function keyExtractor(item: OptionType) {
  return `select-item-${item.value}`;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Options = React.forwardRef<BottomSheetModal, OptionsProps>(
  ({ options, onSelect, value, testID, onDismiss, title }, ref) => {
    const height = options.length * 64 + 140;
    const snapPoints = React.useMemo(() => [height], [height]);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { t } = useTranslation();

    const renderSelectItem = React.useCallback(
      ({ item }: { item: OptionType }) => (
        <Option
          key={`select-item-${item.value}`}
          label={item.label}
          selected={value === item.value}
          onPress={() => onSelect(item)}
          accessibilityHint={t('accessibility.common.select_option_hint', {
            label: item.label,
          })}
          accessibilityLabel={item.label}
          testID={testID ? `${testID}-item-${item.value}` : undefined}
        />
      ),
      [onSelect, value, testID, t]
    );

    return (
      <Modal
        ref={ref}
        index={0}
        snapPoints={snapPoints}
        onDismiss={onDismiss}
        backgroundStyle={{
          backgroundColor: isDark ? colors.charcoal[900] : colors.neutral[50],
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? colors.charcoal[600] : colors.neutral[400],
          width: 40,
          height: 5,
        }}
      >
        {title && (
          <View className="px-5 pb-3 pt-1">
            <Text className="text-center text-base font-semibold text-charcoal-800 dark:text-neutral-100">
              {title}
            </Text>
          </View>
        )}
        <View className="px-4 pb-6">
          <List
            data={options}
            keyExtractor={keyExtractor}
            renderItem={renderSelectItem}
            testID={testID ? `${testID}-modal` : undefined}
            contentContainerStyle={{ gap: 8 }}
          />
        </View>
      </Modal>
    );
  }
);

const Option = React.memo(
  ({
    label,
    selected = false,
    accessibilityHint,
    accessibilityRole = 'menuitem',
    onPress,
    ...props
  }: PressableProps & {
    selected?: boolean;
    label: string;
  }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = React.useCallback(() => {
      scale.value = withTiming(0.97, { duration: 100 });
    }, [scale]);

    const handlePressOut = React.useCallback(() => {
      scale.value = withTiming(1, { duration: 150 });
    }, [scale]);

    return (
      <AnimatedPressable
        style={animatedStyle}
        className={`flex-row items-center rounded-xl px-4 py-3.5 ${
          selected
            ? 'bg-primary-600 dark:bg-primary-700'
            : 'bg-white dark:bg-charcoal-800'
        }`}
        accessibilityLabel={label}
        accessibilityRole={accessibilityRole}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ selected }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        {...props}
      >
        <Text
          className={`flex-1 text-base font-medium ${
            selected ? 'text-white' : 'text-charcoal-800 dark:text-neutral-100'
          }`}
        >
          {label}
        </Text>
        {selected && <Check selected />}
      </AnimatedPressable>
    );
  }
);

export interface SelectProps {
  value?: string | number;
  label?: string;
  disabled?: boolean;
  error?: string;
  options?: OptionType[];
  onSelect?: (value: string | number) => void;
  placeholder?: string;
  testID?: string;
}
interface ControlledSelectProps<T extends FieldValues>
  extends SelectProps,
    InputControllerType<T> {}

export const Select = (props: SelectProps) => {
  const {
    label,
    value,
    error,
    options = [],
    placeholder = 'select...',
    disabled = false,
    onSelect,
    testID,
  } = props;
  const modal = useModal();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleDismiss = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const openModal = React.useCallback(() => {
    if (disabled) {
      return;
    }
    setIsOpen(true);
    modal.present();
  }, [disabled, modal]);

  const onSelectOption = React.useCallback(
    (option: OptionType) => {
      onSelect?.(option.value);
      modal.dismiss();
      setIsOpen(false);
    },
    [modal, onSelect]
  );

  const styles = React.useMemo(
    () =>
      selectTv({
        error: Boolean(error),
        disabled,
      }),
    [error, disabled]
  );

  const textValue = React.useMemo(
    () =>
      value !== undefined
        ? (options?.filter((t) => t.value === value)?.[0]?.label ?? placeholder)
        : placeholder,
    [value, options, placeholder]
  );

  return (
    <>
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
          onPress={openModal}
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
            <Text className={styles.inputValue()}>{textValue}</Text>
          </View>
          <CaretDown />
        </Pressable>
        {error && (
          <Text
            testID={`${testID}-error`}
            className="text-sm text-danger-300 dark:text-danger-600"
          >
            {error}
          </Text>
        )}
      </View>
      <Options
        testID={testID}
        ref={modal.ref}
        options={options}
        value={value}
        onSelect={onSelectOption}
        onDismiss={handleDismiss}
      />
    </>
  );
};

// only used with react-hook-form
export function ControlledSelect<T extends FieldValues>(
  props: ControlledSelectProps<T>
) {
  const { name, control, rules, onSelect: onNSelect, ...selectProps } = props;

  const { field, fieldState } = useController({ control, name, rules });
  const onSelect = React.useCallback(
    (value: string | number) => {
      field.onChange(value);
      onNSelect?.(value);
    },
    [field, onNSelect]
  );
  return (
    <Select
      onSelect={onSelect}
      value={field.value}
      error={fieldState.error?.message}
      {...selectProps}
    />
  );
}

const Check = ({ selected, ...props }: SvgProps & { selected?: boolean }) => (
  <Svg
    width={22}
    height={22}
    fill="none"
    viewBox="0 0 25 24"
    {...props}
    className={selected ? 'stroke-white' : 'stroke-primary-600'}
  >
    <Path
      d="m20.256 6.75-10.5 10.5L4.506 12"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
