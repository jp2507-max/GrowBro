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
  ({ data: _data = [], testID }, ref) => {
    // For performance tests, just render a simple view with testID
    // The actual rendering logic is not needed for timing measurements
    return <View ref={ref} testID={testID} />;
  }
);

FlashListComponent.displayName = 'FlashList';

export const FlashList = FlashListComponent as React.ComponentType<
  FlashListProps<any>
>;

export default FlashList;
