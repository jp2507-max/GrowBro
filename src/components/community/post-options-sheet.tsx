import { BottomSheetView } from '@gorhom/bottom-sheet';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Modal, type ModalRef, Pressable, Text } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Trash } from '@/components/ui/icons';

type PostOptionsSheetProps = {
  onDelete: () => void;
  isDeleting?: boolean;
};

export type PostOptionsSheetRef = ModalRef;

export const PostOptionsSheet = React.forwardRef<
  ModalRef,
  PostOptionsSheetProps
>(function PostOptionsSheet({ onDelete, isDeleting = false }, ref) {
  const { t } = useTranslation();

  return (
    <Modal
      ref={ref}
      snapPoints={['25%']}
      title={t('community.postOptions.title', { defaultValue: 'Post Options' })}
      enableDynamicSizing={false}
    >
      <BottomSheetView className="px-4 pb-8">
        {/* Delete Option */}
        <Pressable
          onPress={onDelete}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel={t('community.postOptions.delete', {
            defaultValue: 'Delete post',
          })}
          accessibilityHint={t('community.postOptions.deleteHint', {
            defaultValue: 'Deletes this post with a 15 second undo window',
          })}
          className="flex-row items-center gap-3 rounded-xl bg-danger-50 p-4 active:opacity-70 dark:bg-danger-900/20"
        >
          <Trash size={22} color={colors.danger[500]} />
          <Text className="flex-1 text-base font-medium text-danger-600 dark:text-danger-400">
            {t('community.postOptions.delete', { defaultValue: 'Delete' })}
          </Text>
        </Pressable>
      </BottomSheetView>
    </Modal>
  );
});
