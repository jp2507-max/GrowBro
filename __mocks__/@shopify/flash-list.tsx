import React from 'react';
import { View } from 'react-native';

export interface FlashListProps<T> {
  data?: T[];
  renderItem?: (info: { item: T; index: number }) => React.ReactElement | null;
  keyExtractor?: (item: T, index: number) => string;
  getItemType?: (item: T, index: number) => string | number;
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
  (
    {
      data = [],
      renderItem,
      keyExtractor,
      ListEmptyComponent,
      testID,
      ...props
    },
    ref
  ) => {
    // Handle empty state
    if (data.length === 0 && ListEmptyComponent) {
      return (
        <View {...props} testID={testID} ref={ref}>
          {React.isValidElement(ListEmptyComponent) ? (
            ListEmptyComponent
          ) : (
            <ListEmptyComponent />
          )}
        </View>
      );
    }

    // For tests, render actual items if renderItem is provided
    const items = data
      .map((item, index) => {
        if (renderItem) {
          const key = keyExtractor
            ? keyExtractor(item, index)
            : `item-${index}`;
          const renderedItem = renderItem({ item, index });
          if (React.isValidElement(renderedItem)) {
            return React.cloneElement(renderedItem, { key });
          }
        }
        return null;
      })
      .filter((item): item is React.ReactElement => item !== null);

    return (
      <View {...props} testID={testID} ref={ref}>
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
