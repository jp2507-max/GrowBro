/**
 * Modal
 * Dependencies:
 * - @gorhom/bottom-sheet.
 *
 * Props:
 * - All `BottomSheetModalProps` props.
 * - `title` (string | undefined): Optional title for the modal header.
 *
 * Usage Example:
 * import { Modal, useModal, type ModalRef } from '@/components/ui';
 * import { BottomSheetScrollView } from '@/components/ui/modal'; // for scrollable content
 *
 * function DisplayModal() {
 *   const { ref, present, dismiss } = useModal();
 *
 *   return (
 *     <View>
 *       <Modal
 *         snapPoints={['60%']} // optional
 *         title="Modal Title"
 *         ref={ref}
 *       >
 *         Modal Content
 *       </Modal>
 *     </View>
 *   );
 * }
 *
 */

import type {
  BottomSheetBackdropProps,
  BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  useBottomSheet,
  useBottomSheetTimingConfigs,
} from '@gorhom/bottom-sheet';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
} from 'react-native-reanimated';
import { Path, Svg } from 'react-native-svg';

import colors from '@/components/ui/colors';

import { Text } from './text';

// Re-export for cleaner imports in modal components
export type ModalRef = BottomSheetModal;
export { BottomSheetScrollView, BottomSheetView };

type ModalProps = BottomSheetModalProps & {
  title?: string;
  testID?: string;
};

type ModalForwardedRef = React.ForwardedRef<BottomSheetModal>;

type ModalHeaderProps = {
  title?: string;
  dismiss: () => void;
};

export const useModal = () => {
  const ref = React.useRef<BottomSheetModal>(null);
  const present = React.useCallback((data?: Record<string, unknown>) => {
    ref.current?.present(data);
  }, []);
  const dismiss = React.useCallback(() => {
    ref.current?.dismiss();
  }, []);
  return { ref, present, dismiss };
};

export const Modal = React.forwardRef(
  (
    {
      snapPoints: _snapPoints = ['60%'],
      title,
      detached = false,
      handleComponent: customHandleComponent,
      handleIndicatorStyle,
      ...props
    }: ModalProps,
    ref: ModalForwardedRef
  ) => {
    const detachedProps = React.useMemo(
      () => getDetachedProps(detached),
      [detached]
    );
    const modal = useModal();
    const snapPoints = React.useMemo(() => _snapPoints, [_snapPoints]);

    React.useImperativeHandle(
      ref,
      () => (modal.ref.current as BottomSheetModal) || null
    );

    const renderHandleWithHeader = React.useCallback(
      () => (
        <>
          <View className="mb-8 mt-2 h-1 w-12 self-center rounded-lg bg-charcoal-400 dark:bg-charcoal-700" />
          <ModalHeader title={title} dismiss={modal.dismiss} />
        </>
      ),
      [title, modal.dismiss]
    );

    const animationConfigs = useBottomSheetTimingConfigs({
      duration: 250,
    });

    return (
      <BottomSheetModal
        {...props}
        {...detachedProps}
        ref={modal.ref}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={props.backdropComponent || renderBackdrop}
        enableDynamicSizing={false}
        handleIndicatorStyle={handleIndicatorStyle}
        animationConfigs={animationConfigs}
        handleComponent={customHandleComponent || renderHandleWithHeader}
      />
    );
  }
);

/**
 * Custom Backdrop
 */

const CustomBackdrop = ({ style }: BottomSheetBackdropProps) => {
  const { close } = useBottomSheet();
  const { t } = useTranslation();
  return (
    <Animated.View
      entering={FadeIn.duration(50).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(20).reduceMotion(ReduceMotion.System)}
      style={[style, styles.backdrop]}
    >
      <Pressable
        onPress={() => close()}
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.modal.backdrop_label')}
        accessibilityHint={t('accessibility.modal.backdrop_hint')}
      />
    </Animated.View>
  );
};

export const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <CustomBackdrop {...props} />
);

/**
 *
 * @param detached
 * @returns
 *
 * @description
 * In case the modal is detached, we need to add some extra props to the modal to make it look like a detached modal.
 */

const getDetachedProps = (detached: boolean) => {
  if (detached) {
    return {
      detached: true,
      bottomInset: 46,
      style: styles.detached,
    } as Partial<BottomSheetModalProps>;
  }
  return {} as Partial<BottomSheetModalProps>;
};

/**
 * ModalHeader
 */

const ModalHeader = React.memo(({ title, dismiss }: ModalHeaderProps) => {
  return (
    <>
      {title && (
        <View className="flex-row px-2 py-4">
          <View className="size-[24px]" />
          <View className="flex-1">
            <Text className="text-center text-base font-bold text-ink-900 dark:text-white">
              {title}
            </Text>
          </View>
        </View>
      )}
      <CloseButton close={dismiss} />
    </>
  );
});

const CloseButton = ({ close }: { close: () => void }) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={close}
      className="absolute right-3 top-3 size-[24px] items-center justify-center "
      hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
      accessibilityLabel={t('accessibility.modal.close_label')}
      accessibilityRole="button"
      accessibilityHint={t('accessibility.modal.close_hint')}
    >
      <Svg
        className="fill-neutral-300 dark:fill-white"
        width={24}
        height={24}
        fill="none"
        viewBox="0 0 24 24"
      >
        <Path d="M18.707 6.707a1 1 0 0 0-1.414-1.414L12 10.586 6.707 5.293a1 1 0 0 0-1.414 1.414L10.586 12l-5.293 5.293a1 1 0 1 0 1.414 1.414L12 13.414l5.293 5.293a1 1 0 0 0 1.414-1.414L13.414 12l5.293-5.293Z" />
      </Svg>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    // Use centralized design token for charcoal 950 and append alpha '66' for backdrop
    backgroundColor: `${colors.charcoal[950]}66`,
  },
  detached: {
    marginHorizontal: 16,
    overflow: 'hidden',
  },
});
