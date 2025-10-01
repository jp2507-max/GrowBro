import { Children, cloneElement, isValidElement, memo } from 'react';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';

/**
 * Custom cell renderer that provides each item with its Y position in the list.
 * This enables position-aware animations based on scroll and item location.
 *
 * Usage: Apply to FlashList via `CellRendererComponent` prop for future scroll animations.
 * Currently prepared for Task 7.1 parallax effects similar to Plants list.
 */
const Component = memo(({ children, ...props }: any) => {
  // Tracks this cell's Y position for animation calculations
  const itemY: SharedValue<number> = useSharedValue(0);

  return (
    <View
      {...props}
      onLayout={(e) => {
        // Update position when cell layout changes
        itemY.value = e.nativeEvent.layout.y;
      }}
    >
      {/* Inject itemY prop into each child component for position-aware animations */}
      {Children.map(children, (child) => {
        if (isValidElement(child)) {
          return cloneElement(child, { itemY } as any);
        }
        return child;
      })}
    </View>
  );
});

Component.displayName = 'CustomCellRendererComponent';

export default Component;
