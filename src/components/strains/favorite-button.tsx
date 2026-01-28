import * as React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { GlassSurface } from '@/components/shared/glass-surface';
import colors from '@/components/ui/colors';
import { translate } from '@/lib';

const favoriteStyles = StyleSheet.create({
  overlayContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

type Props = {
  isFavorite: boolean;
  onToggle: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  /** Use 'overlay' for detail screen header with blurred background */
  variant?: 'default' | 'overlay';
};

const ICON_SIZE = 24;
const HEART_PATH =
  'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z';

/** Heart icon with white outline for visibility on image backgrounds */
const HeartIconWithOutline = ({ filled }: { filled: boolean }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
    {/* White outline for visibility on any background */}
    <Path
      d={HEART_PATH}
      fill="none"
      stroke="white"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Main heart icon */}
    <Path
      d={HEART_PATH}
      fill={filled ? colors.danger[500] : 'none'}
      stroke={filled ? colors.danger[500] : 'white'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

/** Heart icon for overlay variant (glass background, white stroke for visibility) */
const HeartIconSimple = ({ filled }: { filled: boolean }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
    <Path
      d={HEART_PATH}
      fill={filled ? colors.danger[500] : 'none'}
      stroke={filled ? colors.danger[500] : colors.white}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const PRESS_SPRING_CONFIG = {
  damping: 10,
  stiffness: 400,
  reduceMotion: ReduceMotion.System,
};

export const FavoriteButton = React.memo<Props>(
  ({
    isFavorite,
    onToggle,
    accessibilityLabel,
    accessibilityHint,
    testID,
    variant = 'default',
  }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(
      () => ({
        transform: [{ scale: scale.get() }],
      }),
      []
    );

    const handlePress = React.useCallback((): void => {
      // Animation
      scale.set(
        withSequence(
          withSpring(0.8, PRESS_SPRING_CONFIG),
          withSpring(1, PRESS_SPRING_CONFIG)
        )
      );

      // Trigger parent callback
      onToggle();
    }, [onToggle, scale]);

    const label =
      accessibilityLabel ??
      (isFavorite
        ? translate('strains.remove_favorite')
        : translate('strains.add_favorite'));

    const isOverlay = variant === 'overlay';

    if (isOverlay) {
      return (
        <Pressable
          onPress={handlePress}
          testID={testID ?? 'favorite-button'}
          accessibilityRole="switch"
          accessibilityState={{ checked: isFavorite }}
          accessibilityLabel={label}
          accessibilityHint={
            accessibilityHint ??
            translate('accessibility.strains.favorite_hint')
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <GlassSurface
            glassEffectStyle="clear"
            style={favoriteStyles.overlayContainer}
            fallbackClassName="bg-black/30"
          >
            <Animated.View style={animatedStyle}>
              <HeartIconSimple filled={isFavorite} />
            </Animated.View>
          </GlassSurface>
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={handlePress}
        testID={testID ?? 'favorite-button'}
        accessibilityRole="switch"
        accessibilityState={{ checked: isFavorite }}
        accessibilityLabel={label}
        accessibilityHint={
          accessibilityHint ?? translate('accessibility.strains.favorite_hint')
        }
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Animated.View style={animatedStyle}>
          <HeartIconWithOutline filled={isFavorite} />
        </Animated.View>
      </Pressable>
    );
  }
);

FavoriteButton.displayName = 'FavoriteButton';
