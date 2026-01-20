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
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';
import { tv } from 'tailwind-variants';

import { CaretDown } from '@/components/ui/icons';

import type { InputControllerType } from './input';
import { Modal, useModal } from './modal';
import { Text } from './text';

const selectTv = tv({
  slots: {
    container: 'mb-4',
    label:
      'mb-2 ml-1 text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400',
    input:
      'mt-0 flex-row items-center justify-center rounded-2xl border-2 border-neutral-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-white/10',
    inputValue: 'text-base font-medium text-charcoal-900 dark:text-neutral-100',
  },

  variants: {
    focused: {
      true: {
        input: 'border-primary-600 dark:border-primary-400',
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
        input: 'opacity-60',
      },
    },
    chunky: {
      true: {
        input:
          'rounded-2xl border-2 border-neutral-200 bg-white px-6 py-5 dark:border-white/10 dark:bg-white/10',
        inputValue: 'text-lg',
      },
    },
  },
  defaultVariants: {
    error: false,
    disabled: false,
    chunky: false,
  },
});

const List = Platform.OS === 'web' ? FlashList : BottomSheetFlatList;

export type OptionType = {
  label: string;
  value: string | number;
  icon?: string;
};

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

const listContentStyle = { gap: 8 };

export const Options = React.forwardRef<BottomSheetModal, OptionsProps>(
  ({ options, onSelect, value, testID, onDismiss, title }, ref) => {
    const height = options.length * 64 + 140;
    const snapPoints = React.useMemo(() => [height], [height]);
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const { t } = useTranslation();

    const glassSurfaceProps = React.useMemo(
      () => ({
        glassEffectStyle: 'regular' as const,
        style: {
          borderTopLeftRadius: 35,
          borderTopRightRadius: 35,
        },
        fallbackClassName: 'bg-white dark:bg-charcoal-900',
      }),
      []
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

    const renderSelectItem = React.useCallback(
      ({ item }: { item: OptionType }) => (
        <Option
          key={`select-item-${item.value}`}
          label={item.label}
          icon={item.icon}
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
        handleIndicatorStyle={handleStyle}
        useGlassSurface
        glassSurfaceProps={glassSurfaceProps}
      >
        {title && (
          <View className="px-5 pb-3 pt-1">
            <Text className="text-center text-base font-semibold text-charcoal-800 dark:text-neutral-100">
              {title}
            </Text>
          </View>
        )}
        <View className="px-6 pb-10">
          <List
            data={options}
            keyExtractor={keyExtractor}
            renderItem={renderSelectItem}
            testID={testID ? `${testID}-modal` : undefined}
            contentContainerStyle={listContentStyle}
          />
        </View>
      </Modal>
    );
  }
);

const Option = React.memo(
  ({
    label,
    icon,
    selected = false,
    accessibilityHint,
    accessibilityRole = 'menuitem',
    onPress,
    ...props
  }: PressableProps & {
    selected?: boolean;
    label: string;
    icon?: string;
  }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = React.useCallback((): void => {
      scale.value = withTiming(0.97, {
        duration: 100,
        reduceMotion: ReduceMotion.System,
      });
    }, [scale]);

    const handlePressOut = React.useCallback((): void => {
      scale.value = withTiming(1, {
        duration: 150,
        reduceMotion: ReduceMotion.System,
      });
    }, [scale]);

    return (
      <AnimatedPressable
        style={animatedStyle}
        className={`flex-row items-center justify-between rounded-2xl p-4 ${
          selected
            ? 'border border-primary-600 bg-primary-100 dark:border-primary-400 dark:bg-primary-900/30'
            : ''
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
        <View className="flex-1 flex-row items-center">
          {icon && (
            <View
              className={`mr-3 size-8 items-center justify-center rounded-full ${
                selected
                  ? 'bg-white dark:bg-neutral-800'
                  : 'bg-neutral-100 dark:bg-white/10'
              }`}
            >
              <Text className="text-base">{icon}</Text>
            </View>
          )}
          <Text
            className={`text-lg ${
              selected
                ? 'font-bold text-primary-900 dark:text-primary-100'
                : 'font-medium text-neutral-600 dark:text-neutral-300'
            }`}
          >
            {label}
          </Text>
        </View>
        {selected && <Check />}
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
  chunky?: boolean;
}
interface ControlledSelectProps<T extends FieldValues>
  extends SelectProps,
    InputControllerType<T> {}

/** Hook to compute the selected option's label */
function useSelectedLabel(
  value: string | number | undefined,
  options: OptionType[],
  placeholder: string
): string {
  return React.useMemo(
    () =>
      value !== undefined
        ? (options?.find((opt) => opt.value === value)?.label ?? placeholder)
        : placeholder,
    [value, options, placeholder]
  );
}

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
    chunky,
  } = props;
  const modal = useModal();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleDismiss = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const openModal = React.useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    modal.present();
  }, [disabled, modal]);

  const onSelectOption = React.useCallback(
    (option: OptionType) => {
      onSelect?.(option.value);
      modal.dismiss();
    },
    [modal, onSelect]
  );

  const styles = React.useMemo(
    () =>
      selectTv({ error: Boolean(error), disabled, chunky: Boolean(chunky) }),
    [error, disabled, chunky]
  );

  const textValue = useSelectedLabel(value, options, placeholder);
  const accessibilityHint = disabled
    ? undefined
    : t('accessibility.common.select_open_hint', {
        label: label ?? placeholder,
      });

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
          accessibilityHint={accessibilityHint}
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
  const {
    name,
    control,
    rules,
    onSelect: onNSelect,
    chunky,
    ...selectProps
  } = props;

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
      chunky={chunky}
      {...selectProps}
    />
  );
}

const Check = ({ ...props }: SvgProps) => (
  <Svg
    width={22}
    height={22}
    fill="none"
    viewBox="0 0 25 24"
    {...props}
    className="stroke-primary-600 dark:stroke-primary-400"
  >
    <Path
      d="m20.256 6.75-10.5 10.5L4.506 12"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
