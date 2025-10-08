import React from 'react';
import { View } from 'react-native';

export interface FlashListProps<T> {
  data?: T[];
  renderItem?: (info: { item: T; index: number }) => React.ReactElement | null;
  testID?: string;
  estimatedItemSize?: number;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  onScroll?: (event: any) => void;
  scrollEventThrottle?: number;
  removeClippedSubviews?: boolean;
  drawDistance?: number;
  recycleBufferedViews?: boolean;
  maxToRenderPerBatch?: number;
  windowSize?: number;
  updateCellsBatchingPeriod?: number;
  contentContainerStyle?: any;
  ListHeaderComponent?: React.ComponentType | React.ReactElement;
  ListEmptyComponent?: React.ComponentType | React.ReactElement;
  ListFooterComponent?: React.ComponentType | React.ReactElement;
  initialScrollIndex?: number;
}

const FlashListComponent = React.forwardRef<any, FlashListProps<any>>(
  ({ data = [], renderItem, testID, ...props }, ref) => {
    // For tests, render actual items if renderItem is provided
    const items = data.map((item, index) => {
      if (renderItem) {
        return React.cloneElement(renderItem({ item, index }), {
          key: `item-${index}`,
        });
      }
      return null;
    });

    return (
      <View ref={ref} testID={testID} {...props}>
        {items}
      </View>
    );
  }
);

FlashListComponent.displayName = 'FlashList';

export const FlashList = FlashListComponent as React.ComponentType<
  FlashListProps<any>
> & {
  displayName?: string;
};

FlashList.displayName = 'FlashList';

export default FlashList;
