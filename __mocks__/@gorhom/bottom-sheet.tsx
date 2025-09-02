import React from 'react';
import { View, ScrollView, TextInput, FlatList, SectionList, VirtualizedList, TouchableOpacity, TouchableHighlight, TouchableWithoutFeedback } from 'react-native';

// Types
export type BottomSheetScrollViewProps = {
  children?: React.ReactNode;
  style?: any;
  contentContainerStyle?: any;
  [key: string]: any;
};

export type BottomSheetBackdropProps = {
  appearsOnIndex?: number;
  disappearsOnIndex?: number;
  pressBehavior?: 'none' | 'close' | 'collapse';
  onPress?: () => void;
  children?: React.ReactNode;
  [key: string]: any;
};

export type BottomSheetModalProps = {
  children?: React.ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  onChange?: (index: number) => void;
  enablePanDownToClose?: boolean;
  [key: string]: any;
};

export type BottomSheetProps = {
  children?: React.ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  onChange?: (index: number) => void;
  enablePanDownToClose?: boolean;
  [key: string]: any;
};

// Mock components
export const BottomSheetModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

export const BottomSheetBackdrop: React.FC<BottomSheetBackdropProps> = ({ children }) => <>{children}</>;

export const BottomSheetView: React.FC<{ children?: React.ReactNode; style?: any }> = ({ children, style }) => (
  <View style={style}>{children}</View>
);

export const BottomSheetTextInput: React.FC<any> = (props) => <TextInput {...props} />;

export const BottomSheetScrollView: React.FC<BottomSheetScrollViewProps> = (props) => <ScrollView {...props} />;

export const BottomSheetFlatList: React.FC<any> = (props) => <FlatList {...props} />;

export const BottomSheetSectionList: React.FC<any> = (props) => <SectionList {...props} />;

export const BottomSheetFlashList: React.FC<any> = (props) => <FlatList {...props} />;

export const BottomSheetVirtualizedList: React.FC<any> = (props) => <VirtualizedList {...props} />;

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
  snapToIndex = () => {};
  snapToPosition = () => {};
  expand = () => {};
  collapse = () => {};
  close = () => {};
  forceClose = () => {};

  render() {
    return <>{this.props.children}</>;
  }
}

// Mock hooks
export const useBottomSheet = () => ({
  snapToIndex: () => {},
  snapToPosition: () => {},
  expand: () => {},
  collapse: () => {},
  close: () => {},
  forceClose: () => {},
  animatedIndex: { value: 0 },
  animatedPosition: { value: 0 },
});

export const useBottomSheetModal = () => ({
  dismiss: () => {},
  dismissAll: () => {},
});

export const useBottomSheetSpringConfigs = (configs: any) => configs;
export const useBottomSheetTimingConfigs = (configs: any) => configs;

export const useBottomSheetInternal = () => ({
  stopAnimation: () => {},
  animateToPosition: () => {},
  setScrollableRef: () => {},
  removeScrollableRef: () => {},
});

export const useBottomSheetModalInternal = () => ({
  mountSheet: () => {},
  unmountSheet: () => {},
  willUnmountSheet: () => {},
});

export const useBottomSheetDynamicSnapPoints = () => ({
  animatedSnapPoints: { value: [] },
  animatedHandleHeight: { value: 0 },
  animatedContentHeight: { value: 0 },
  handleContentLayout: () => {},
});

// Re-export React Native touchable components
export { TouchableOpacity, TouchableHighlight, TouchableWithoutFeedback };

// Default export
export default BottomSheet;
