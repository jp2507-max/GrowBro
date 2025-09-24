import React, { Children, cloneElement, isValidElement, memo } from 'react';
import { View, type ViewProps } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

// Reusable CellRendererComponent that injects an itemY shared value into its child.
// It updates itemY on layout; child components can consume it for scroll-based animations.
type Props = ViewProps & { children: React.ReactNode };

const CustomCellRendererComponent = memo(({ children, ...props }: Props) => {
  const itemY = useSharedValue(0);

  return (
    <View
      {...props}
      onLayout={(e) => {
        // Capture this cell's top Y relative to the list content
        itemY.value = e.nativeEvent.layout.y;
        props.onLayout?.(e);
      }}
    >
      {Children.map(children, (child) =>
        isValidElement(child)
          ? cloneElement(child as any, { itemY } as any)
          : child
      )}
    </View>
  );
});

CustomCellRendererComponent.displayName = 'CustomCellRendererComponent';

export default CustomCellRendererComponent;
