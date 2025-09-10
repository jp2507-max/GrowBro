import React from 'react';
import type {
  FlatListProps,
  ScrollViewProps,
  SectionListProps,
  TextInputProps,
  ViewProps,
  VirtualizedListProps,
} from 'react-native';
import {
  ScrollView,
  SectionList,
  TextInput,
  TouchableHighlight,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  VirtualizedList,
} from 'react-native';

// Types
export type BottomSheetScrollViewProps = {
  children?: React.ReactNode;
  style?: ScrollViewProps['style'];
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
};

export type BottomSheetBackdropProps = {
  appearsOnIndex?: number;
  disappearsOnIndex?: number;
  pressBehavior?: 'none' | 'close' | 'collapse';
  onPress?: () => void;
  children?: React.ReactNode;
};

export type BottomSheetModalProps = {
  children?: React.ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  onChange?: (index: number) => void;
  enablePanDownToClose?: boolean;
};

export type BottomSheetProps = {
  children?: React.ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  onChange?: (index: number) => void;
  enablePanDownToClose?: boolean;
};

// Mock components
export function BottomSheetModalProvider(props: {
  children: React.ReactNode;
}): React.ReactElement {
  return <>{props.children}</>;
}

export function BottomSheetBackdrop(
  props: BottomSheetBackdropProps
): React.ReactElement {
  return <>{props.children}</>;
}

type BottomSheetViewProps = {
  children?: React.ReactNode;
  style?: ViewProps['style'];
};

export function BottomSheetView(
  props: BottomSheetViewProps
): React.ReactElement {
  return <View style={props.style}>{props.children}</View>;
}

export function BottomSheetTextInput(
  props: TextInputProps
): React.ReactElement {
  return <TextInput {...props} />;
}

export function BottomSheetScrollView(
  props: BottomSheetScrollViewProps
): React.ReactElement {
  return <ScrollView {...props} />;
}

export function BottomSheetFlatList<T>(
  props: FlatListProps<T>
): React.ReactElement {
  // In test environment, render list items from data/renderItem props
  if (props.data && props.renderItem) {
    const dataArray = (props.data as T[]) || [];
    const items = dataArray.map((item: T, index: number) => {
      const key = props.keyExtractor ? props.keyExtractor(item, index) : index;
      return (
        <React.Fragment key={String(key)}>
          {props.renderItem!({ item, index, separators: {} as any })}
        </React.Fragment>
      );
    });
    return <View {...props}>{items}</View>;
  }
  // Fallback for components that pass children directly
  return (<View>{props.children}</View>) as any;
}

export function BottomSheetSectionList<T>(
  props: SectionListProps<T>
): React.ReactElement {
  return <SectionList {...props} />;
}

export function BottomSheetFlashList<T>(
  props: FlatListProps<T>
): React.ReactElement {
  // In test environment, render list items from data/renderItem props
  if (props.data && props.renderItem) {
    const dataArray = (props.data as T[]) || [];
    const items = dataArray.map((item: T, index: number) => {
      const key = props.keyExtractor ? props.keyExtractor(item, index) : index;
      return (
        <React.Fragment key={String(key)}>
          {props.renderItem!({ item, index, separators: {} as any })}
        </React.Fragment>
      );
    });
    return <View {...props}>{items}</View>;
  }
  // Fallback for components that pass children directly
  return (<View>{props.children}</View>) as any;
}

export function BottomSheetVirtualizedList<T>(
  props: VirtualizedListProps<T>
): React.ReactElement {
  return <VirtualizedList {...props} />;
}

// Mock classes
export class BottomSheetModal extends React.Component<BottomSheetModalProps> {
  snapToIndex = () => {};
  snapToPosition = () => {};
  expand = () => {};
  collapse = () => {};
  close = () => {};
  forceClose = () => {};
  present = () => {};
  dismiss = () => {};

  render() {
    return <>{this.props.children}</>;
  }
}

export class BottomSheet extends React.Component<BottomSheetProps> {
  snapToIndex = (_index: number): void => {};
  snapToPosition = (_position: number): void => {};
  expand = (): void => {};
  collapse = (): void => {};
  close = (): void => {};
  forceClose = (): void => {};

  render(): React.ReactNode {
    return <>{this.props.children}</>;
  }
}

// Types for animated values
type AnimatedValue<T = number> = {
  value: T;
};

type BottomSheetMethods = {
  snapToIndex: (index: number) => void;
  snapToPosition: (position: number | string) => void;
  expand: () => void;
  collapse: () => void;
  close: () => void;
  forceClose: () => void;
};

type BottomSheetAnimatedValues = {
  animatedIndex: AnimatedValue<number>;
  animatedPosition: AnimatedValue<number>;
};

type BottomSheetHookReturn = BottomSheetMethods & BottomSheetAnimatedValues;

// Mock hooks
export const useBottomSheet = (): BottomSheetHookReturn => ({
  snapToIndex: () => {},
  snapToPosition: () => {},
  expand: () => {},
  collapse: () => {},
  close: () => {},
  forceClose: () => {},
  animatedIndex: { value: 0 },
  animatedPosition: { value: 0 },
});

type BottomSheetModalMethods = {
  present: (data?: any) => void;
  dismiss: () => void;
  dismissAll: () => void;
};

export const useBottomSheetModal = (): BottomSheetModalMethods => ({
  present: () => {},
  dismiss: () => {},
  dismissAll: () => {},
});

type SpringConfig = {
  damping?: number;
  mass?: number;
  stiffness?: number;
  overshootClamping?: boolean;
  restDisplacementThreshold?: number;
  restSpeedThreshold?: number;
};

type TimingConfig = {
  duration?: number;
  easing?: (value: number) => number;
};

export const useBottomSheetSpringConfigs = (
  configs: SpringConfig
): SpringConfig => configs;
export const useBottomSheetTimingConfigs = (
  configs: TimingConfig
): TimingConfig => configs;

type BottomSheetInternalMethods = {
  stopAnimation: () => void;
  animateToPosition: (position: number | string) => void;
  setScrollableRef: (ref: any) => void;
  removeScrollableRef: (ref: any) => void;
};

export const useBottomSheetInternal = (): BottomSheetInternalMethods => ({
  stopAnimation: () => {},
  animateToPosition: () => {},
  setScrollableRef: () => {},
  removeScrollableRef: () => {},
});

type BottomSheetModalInternalMethods = {
  mountSheet: () => void;
  unmountSheet: () => void;
  willUnmountSheet: () => void;
};

export const useBottomSheetModalInternal =
  (): BottomSheetModalInternalMethods => ({
    mountSheet: () => {},
    unmountSheet: () => {},
    willUnmountSheet: () => {},
  });

type BottomSheetDynamicSnapPointsMethods = {
  animatedSnapPoints: AnimatedValue<(number | string)[]>;
  animatedHandleHeight: AnimatedValue<number>;
  animatedContentHeight: AnimatedValue<number>;
  handleContentLayout: (event: any) => void;
};

export const useBottomSheetDynamicSnapPoints =
  (): BottomSheetDynamicSnapPointsMethods => ({
    animatedSnapPoints: { value: [] },
    animatedHandleHeight: { value: 0 },
    animatedContentHeight: { value: 0 },
    handleContentLayout: () => {},
  });

// Re-export React Native touchable components
export { TouchableHighlight, TouchableOpacity, TouchableWithoutFeedback };

// Default export
export default BottomSheet;
