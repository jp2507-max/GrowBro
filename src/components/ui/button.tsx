import React from 'react';
import type { PressableProps, View } from 'react-native';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
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

import { GlassSurface } from '../shared/glass-surface';
import { Text } from './text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Scale factor for press animation (0.96 = 4% shrink) */
const PRESS_SCALE = 0.96;
/** Duration for press animation in ms */
const PRESS_DURATION = 120;

const button = tv({
  slots: {
    container: 'my-2 flex flex-row items-center justify-center rounded-md px-4',
    label: 'font-inter text-base font-semibold',
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
      /** Glass button with iOS 26+ liquid glass effect, blur fallback on older devices */
      glass: {
        container: 'overflow-hidden',
        label: 'text-neutral-900 dark:text-white',
        indicator: 'text-neutral-900 dark:text-white',
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

interface ButtonContentProps {
  loading: boolean;
  testID?: string;
  indicatorClass: string;
  labelClass: string;
  tx?: TxKeyPath;
  text?: string;
}

function ButtonContent({
  loading,
  testID,
  indicatorClass,
  labelClass,
  tx,
  text,
}: ButtonContentProps) {
  if (loading) {
    return (
      <ActivityIndicator
        size="small"
        className={indicatorClass}
        testID={testID ? `${testID}-activity-indicator` : undefined}
      />
    );
  }
  return (
    <Text
      testID={testID ? `${testID}-label` : undefined}
      className={labelClass}
      tx={tx}
    >
      {text}
    </Text>
  );
}

const glassButtonStyles = StyleSheet.create({
  surface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
});

type PressEvent = Parameters<NonNullable<PressableProps['onPressIn']>>[0];

interface UsePressAnimationOptions {
  noAnimation: boolean;
  disabled: boolean;
  loading: boolean;
  onPressIn?: PressableProps['onPressIn'];
  onPressOut?: PressableProps['onPressOut'];
}

function usePressAnimation(opts: UsePressAnimationOptions) {
  const { noAnimation, disabled, loading, onPressIn, onPressOut } = opts;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(
    () => ({ transform: [{ scale: scale.get() }] }),
    []
  );

  const handlePressIn = React.useCallback(
    (e: PressEvent) => {
      if (!noAnimation && !disabled && !loading) {
        scale.set(
          withTiming(PRESS_SCALE, {
            duration: PRESS_DURATION,
            reduceMotion: ReduceMotion.System,
          })
        );
      }
      onPressIn?.(e);
    },
    [scale, noAnimation, disabled, loading, onPressIn]
  );

  const handlePressOut = React.useCallback(
    (e: PressEvent) => {
      if (!noAnimation && !disabled && !loading) {
        scale.set(
          withTiming(1, {
            duration: PRESS_DURATION,
            reduceMotion: ReduceMotion.System,
          })
        );
      }
      onPressOut?.(e);
    },
    [scale, noAnimation, disabled, loading, onPressOut]
  );

  return { animatedStyle, handlePressIn, handlePressOut };
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
    const { animatedStyle, handlePressIn, handlePressOut } = usePressAnimation({
      noAnimation,
      disabled,
      loading,
      onPressIn,
      onPressOut,
    });

    const styles = React.useMemo(
      () => button({ variant, disabled, size }),
      [variant, disabled, size]
    );

    // Derive a default accessibilityLabel if not provided
    const defaultA11yLabel = tx ? translate(tx) : text;
    const isGlass = variant === 'glass';
    const labelClass = styles.label({ className: textClassName });
    const indicatorClass = styles.indicator();

    const content = (
      <ButtonContent
        loading={loading}
        testID={testID}
        indicatorClass={indicatorClass}
        labelClass={labelClass}
        tx={tx}
        text={text}
      />
    );

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
        {props.children ??
          (isGlass ? (
            <GlassSurface
              glassEffectStyle="clear"
              isInteractive
              style={glassButtonStyles.surface}
              fallbackClassName="bg-white/20 dark:bg-charcoal-800/50"
            >
              {content}
            </GlassSurface>
          ) : (
            content
          ))}
      </AnimatedPressable>
    );
  }
);
