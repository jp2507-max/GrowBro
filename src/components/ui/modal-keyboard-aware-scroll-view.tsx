// source https://kirillzyusko.github.io/react-native-keyboard-controller/docs/api/components/keyboard-aware-scroll-view
/**
 * This component is used to handle the keyboard in a modal.
 * It is a wrapper around the `KeyboardAwareScrollView` component from `react-native-keyboard-controller`.
 * It is used to handle the keyboard in a modal.
 * example usage:
      export function Example() {
        return (
          <Modal>
            <BottomSheetKeyboardAwareScrollView>
            </BottomSheetKeyboardAwareScrollView>
          </Modal>
        );
        }
 */
import {
  type BottomSheetScrollViewMethods,
  createBottomSheetScrollableComponent,
  SCROLLABLE_TYPE,
} from '@gorhom/bottom-sheet';
import { type BottomSheetScrollViewProps } from '@gorhom/bottom-sheet/src/components/bottomSheetScrollable/types';
import { type ComponentType, memo } from 'react';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewProps,
} from 'react-native-keyboard-controller';
import Reanimated from 'react-native-reanimated';

type BottomSheetKeyboardAwareProps = BottomSheetScrollViewProps &
  KeyboardAwareScrollViewProps;

const AnimatedScrollView = Reanimated.createAnimatedComponent(
  KeyboardAwareScrollView
) as ComponentType<BottomSheetKeyboardAwareProps>;

const BottomSheetScrollViewComponent = createBottomSheetScrollableComponent<
  BottomSheetScrollViewMethods,
  BottomSheetKeyboardAwareProps
>(SCROLLABLE_TYPE.SCROLLVIEW, AnimatedScrollView);
const BottomSheetKeyboardAwareScrollView = memo(BottomSheetScrollViewComponent);

BottomSheetKeyboardAwareScrollView.displayName =
  'BottomSheetKeyboardAwareScrollView';

export default BottomSheetKeyboardAwareScrollView;
