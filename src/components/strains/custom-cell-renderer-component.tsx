import { Children, cloneElement, isValidElement, memo } from 'react';
import type { ViewProps } from 'react-native';
import { View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { useSharedValue } from 'react-native-reanimated';

type Props = ViewProps & { children: React.ReactNode };

type ChildWithItemY = React.ReactElement<{ itemY?: SharedValue<number> }>;

/**
 * Custom cell renderer that provides each item with its Y position in the list.
 * This enables position-aware animations based on scroll and item location.
 *
 * Usage: Apply to FlashList via `CellRendererComponent` prop for future scroll animations.
 * Currently prepared for Task 7.1 parallax effects similar to Plants list.
 */
const Component = memo(({ children, ...props }: Props) => {
  // Tracks this cell's Y position for animation calculations
  const itemY: SharedValue<number> = useSharedValue(0);

  return (
    <View
      {...props}
      onLayout={(e) => {
        // Update position when cell layout changes
        itemY.value = e.nativeEvent.layout.y;

        // Forward the layout event to the original handler so FlashList
        // (or any parent) can still measure cells for virtualization.
        // Call safely in case props.onLayout is not provided.
        if (typeof props.onLayout === 'function') {
          props.onLayout(e);
        }
      }}
    >
      {/* Inject itemY prop into each child component for position-aware animations */}
      {Children.map(children, (child) => {
        if (isValidElement(child)) {
          return cloneElement(child as ChildWithItemY, { itemY });
        }
        return child;
      })}
    </View>
  );
});

Component.displayName = 'CustomCellRendererComponent';

export default Component;
