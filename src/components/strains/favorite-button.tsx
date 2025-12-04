import * as React from 'react';
import { Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import colors from '@/components/ui/colors';
import { translate } from '@/lib';

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

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
    {/* White outline for visibility on any background */}
    <Path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill="none"
      stroke="white"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Main heart icon */}
    <Path
      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
      fill={filled ? colors.danger[500] : 'none'}
      stroke={filled ? colors.danger[500] : 'white'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

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
        transform: [{ scale: scale.value }],
      }),
      []
    );

    const handlePress = React.useCallback(() => {
      // Animation
      scale.value = withSpring(0.8, { damping: 10, stiffness: 400 }, () => {
        'worklet';
        scale.value = withSpring(1, { damping: 10, stiffness: 400 });
      });

      // Trigger parent callback
      onToggle();
    }, [onToggle, scale]);

    const label =
      accessibilityLabel ??
      (isFavorite
        ? translate('strains.remove_favorite')
        : translate('strains.add_favorite'));

    const isOverlay = variant === 'overlay';

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
        className={
          isOverlay
            ? 'size-10 items-center justify-center rounded-full bg-black/20 active:bg-black/30'
            : undefined
        }
      >
        <Animated.View style={animatedStyle}>
          <HeartIcon filled={isFavorite} />
        </Animated.View>
      </Pressable>
    );
  }
);

FavoriteButton.displayName = 'FavoriteButton';
