import * as React from 'react';
import type {
  Control,
  FieldValues,
  Path,
  RegisterOptions,
} from 'react-hook-form';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TextInputProps } from 'react-native';
import {
  I18nManager,
  StyleSheet,
  TextInput as NTextInput,
  View,
} from 'react-native';
import { tv } from 'tailwind-variants';

import colors from './colors';
import { Text } from './text';

const inputTv = tv({
  slots: {
    container: 'mb-4',
    label:
      'mb-2 ml-1 text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500',
    input:
      'mt-0 rounded-2xl border-2 border-transparent bg-neutral-100 px-5 py-4 font-inter text-base font-medium leading-5 dark:bg-neutral-800 dark:text-white',
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
      },
    },
    disabled: {
      true: {
        input: 'bg-neutral-200 dark:bg-neutral-700',
      },
    },
    chunky: {
      true: {
        input: 'text-lg',
      },
    },
  },
  defaultVariants: {
    focused: false,
    error: false,
    disabled: false,
    chunky: false,
  },
});

export interface NInputProps extends TextInputProps {
  label?: string;
  disabled?: boolean;
  error?: string;
  errorTx?: string;
  chunky?: boolean;
}

type TRule<T extends FieldValues> =
  | Omit<
      RegisterOptions<T>,
      'disabled' | 'valueAsNumber' | 'valueAsDate' | 'setValueAs'
    >
  | undefined;

export type RuleType<T extends FieldValues> = { [name in keyof T]: TRule<T> };
export type InputControllerType<T extends FieldValues> = {
  name: Path<T>;
  control: Control<T>;
  rules?: TRule<T>;
};

interface ControlledInputProps<T extends FieldValues>
  extends NInputProps,
    InputControllerType<T> {}

export const Input = React.forwardRef<NTextInput, NInputProps>((props, ref) => {
  const { label, error, errorTx, testID, chunky, ...inputProps } = props;
  const {
    accessibilityLabel: inputAccessibilityLabel,
    accessibilityHint: inputAccessibilityHint,
    ...restInputProps
  } = inputProps;
  const [isFocussed, setIsFocussed] = React.useState(false);
  const { t } = useTranslation();
  const onBlur = React.useCallback(() => setIsFocussed(false), []);
  const onFocus = React.useCallback(() => setIsFocussed(true), []);

  const styles = React.useMemo(
    () =>
      inputTv({
        error: Boolean(errorTx || error),
        focused: isFocussed,
        disabled: Boolean(props.disabled),
        chunky: Boolean(chunky),
      }),
    [error, errorTx, isFocussed, props.disabled, chunky]
  );

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
      <NTextInput
        testID={testID}
        ref={ref}
        placeholderTextColor={colors.neutral[400]}
        className={styles.input()}
        onBlur={onBlur}
        onFocus={onFocus}
        accessibilityLabel={inputAccessibilityLabel ?? label ?? undefined}
        accessibilityHint={inputAccessibilityHint ?? 'Double tap to edit text'}
        {...restInputProps}
        style={StyleSheet.flatten([
          { writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr' },
          { textAlign: I18nManager.isRTL ? 'right' : 'left' },
          restInputProps.style,
        ])}
      />
      {(errorTx || error) && (
        <Text
          testID={testID ? `${testID}-error` : undefined}
          className="text-sm text-danger-400 dark:text-danger-600"
        >
          {errorTx ? t(errorTx) : error}
        </Text>
      )}
    </View>
  );
});

// only used with react-hook-form
export function ControlledInput<T extends FieldValues>(
  props: ControlledInputProps<T>
): React.ReactElement {
  const { name, control, rules, ...inputProps } = props;

  const { field, fieldState } = useController({ control, name, rules });
  return (
    <Input
      ref={field.ref}
      autoCapitalize="none"
      onChangeText={field.onChange}
      value={(field.value as string) || ''}
      {...inputProps}
      errorTx={fieldState.error?.message}
    />
  );
}
