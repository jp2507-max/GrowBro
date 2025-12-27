import React from 'react';
import type { PressableProps, View } from 'react-native';
import { ActivityIndicator, Pressable } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { VariantProps } from 'tailwind-variants';
import { tv } from 'tailwind-variants';

import type { TxKeyPath } from '@/lib/i18n';
import { translate } from '@/lib/i18n';

import { Text } from './text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Scale factor for press animation (0.96 = 4% shrink) */
const PRESS_SCALE = 0.96;
/** Duration for press animation in ms */
const PRESS_DURATION = 120;

const button = tv({
  slots: {
    container: 'my-2 flex flex-row items-center justify-center rounded-md px-4',
    label: 'text-base font-semibold',
    indicator: 'h-6 text-white',
  },

  variants: {
    variant: {
      /** Default/Primary CTA - uses terracotta brand action color */
      default: {
        container: 'bg-terracotta-500 active:bg-terracotta-600',
        label: 'text-white',
        indicator: 'text-white',
      },
      /** Primary alias - same as default for explicit CTA usage */
      primary: {
        container: 'bg-terracotta-500 active:bg-terracotta-600',
        label: 'text-white',
        indicator: 'text-white',
      },
      secondary: {
        container: 'bg-primary-600',
        label: 'text-white',
        indicator: 'text-white',
      },
      outline: {
        container: 'border border-neutral-400 dark:border-white/20',
        label: 'text-black dark:text-neutral-100',
        indicator: 'text-black dark:text-neutral-100',
      },
      destructive: {
        container: 'bg-red-600',
        label: 'text-white',
        indicator: 'text-white',
      },
      ghost: {
        container: 'bg-transparent',
        label: 'text-black underline dark:text-white',
        indicator: 'text-black dark:text-white',
      },
      link: {
        container: 'bg-transparent',
        label: 'text-black dark:text-white',
        indicator: 'text-black dark:text-white',
      },
      /** Neutral button for non-primary actions */
      neutral: {
        container: 'bg-neutral-900 dark:bg-white',
        label: 'text-white dark:text-black',
        indicator: 'text-white dark:text-black',
      },
      /** Pill-shaped button for header actions */
      pill: {
        container: 'rounded-full bg-primary-600',
        label: 'text-white',
        indicator: 'text-white',
      },
    },
    size: {
      default: {
        container: 'h-10 px-4',
        label: 'text-base',
      },
      lg: {
        container: 'h-12 px-8',
        label: 'text-xl',
      },
      sm: {
        container: 'h-8 px-3',
        label: 'text-sm',
        indicator: 'h-2',
      },
      icon: { container: 'size-9' },
      /** Circular button for icon-only actions */
      circle: {
        container: 'size-10 rounded-full px-0',
        label: 'text-base',
      },
    },
    disabled: {
      true: {
        container: 'bg-neutral-300 dark:bg-neutral-300',
        label: 'text-neutral-600 dark:text-neutral-600',
        indicator: 'text-neutral-400 dark:text-neutral-400',
      },
    },
    fullWidth: {
      true: {
        container: '',
      },
      false: {
        container: 'self-center',
      },
    },
  },
  defaultVariants: {
    variant: 'default',
    disabled: false,
    fullWidth: true,
    size: 'default',
  },
});

type ButtonVariants = VariantProps<typeof button>;
interface Props extends ButtonVariants, Omit<PressableProps, 'disabled'> {
  label?: string;
  tx?: TxKeyPath;
  loading?: boolean;
  className?: string;
  textClassName?: string;
  /** Disable press animation (e.g., for static buttons) */
  noAnimation?: boolean;
}

export const Button = React.forwardRef<View, Props>(
  (
    {
      label: text,
      tx,
      loading = false,
      variant = 'default',
      disabled = false,
      size = 'default',
      className = '',
      testID,
      textClassName = '',
      noAnimation = false,
      onPressIn,
      onPressOut,
      ...props
    },
    ref
  ) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(
      () => ({
        transform: [{ scale: scale.value }],
      }),
      []
    );

    const handlePressIn = React.useCallback(
      (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
        if (!noAnimation && !disabled && !loading) {
          scale.value = withTiming(PRESS_SCALE, {
            duration: PRESS_DURATION,
            reduceMotion: ReduceMotion.System,
          });
        }
        onPressIn?.(e);
      },
      [scale, noAnimation, disabled, loading, onPressIn]
    );

    const handlePressOut = React.useCallback(
      (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
        if (!noAnimation && !disabled && !loading) {
          scale.value = withTiming(1, {
            duration: PRESS_DURATION,
            reduceMotion: ReduceMotion.System,
          });
        }
        onPressOut?.(e);
      },
      [scale, noAnimation, disabled, loading, onPressOut]
    );

    const styles = React.useMemo(
      () => button({ variant, disabled, size }),
      [variant, disabled, size]
    );

    // Derive a default accessibilityLabel if not provided
    const defaultA11yLabel = tx ? translate(tx) : text;

    return (
      <AnimatedPressable
        disabled={disabled || loading}
        className={styles.container({ className })}
        style={animatedStyle}
        {...props}
        ref={ref}
        testID={testID}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole={props.accessibilityRole ?? 'button'}
        accessibilityLabel={
          props.accessibilityLabel ?? defaultA11yLabel ?? undefined
        }
        accessibilityHint={
          props.accessibilityHint ??
          translate('accessibility.common.doubleTapHint' as TxKeyPath)
        }
      >
        {props.children ? (
          props.children
        ) : (
          <>
            {loading ? (
              <ActivityIndicator
                size="small"
                className={styles.indicator()}
                testID={testID ? `${testID}-activity-indicator` : undefined}
              />
            ) : (
              <Text
                testID={testID ? `${testID}-label` : undefined}
                className={styles.label({ className: textClassName })}
                tx={tx}
              >
                {text || 'DEBUG_TEST_TEXT'}
              </Text>
            )}
          </>
        )}
      </AnimatedPressable>
    );
  }
);
