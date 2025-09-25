import React from 'react';
import { FlatList, type FlatListProps } from 'react-native';

// Mock FlashList as FlatList for tests since FlashList has complex native dependencies
export interface FlashListProps<T>
  extends Omit<FlatListProps<T>, 'estimatedItemSize'> {
  estimatedItemSize?: number;
}

const FlashListComponent = React.forwardRef<any, FlashListProps<any>>(
  (props, ref) => {
    const { estimatedItemSize: _estimatedItemSize, ...flatListProps } = props;
    return React.createElement(FlatList, { ...flatListProps, ref });
  }
);

FlashListComponent.displayName = 'FlashList';

export const FlashList = FlashListComponent as React.ComponentType<
  FlashListProps<any>
>;

export default {
  FlashList,
};
