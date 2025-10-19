/**
 * Moderator Tools Modal
 *
 * Modal for moderators/admins to hide/unhide content with mandatory reason.
 * Requirements: 7.2, 7.3, 7.6, 7.7, 10.3
 *
 * @example
 * const modalRef = useRef<ModeratorToolsModalRef>(null);
 * <ModeratorToolsModal ref={modalRef} contentType="post" contentId="123" isHidden={false} />
 * modalRef.current?.present();
 */

import React, { useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { useHideContent } from '@/api/moderation/use-hide-content';
import { useUnhideContent } from '@/api/moderation/use-unhide-content';
import { Button, Input, Modal, Text, useModal, View } from '@/components/ui';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

type ModeratorToolsModalProps = {
  contentType: 'post' | 'comment';
  contentId: string;
  isHidden: boolean;
  onSuccess?: () => void;
};

export type ModeratorToolsModalRef = {
  present: () => void;
  dismiss: () => void;
};

type ModeratorToolsModalContentProps = {
  t: (key: string) => string;
  reason: string;
  setReason: (reason: string) => void;
  error: string;
  isHidden: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
};

function ModeratorToolsModalContent({
  t,
  reason,
  setReason,
  error,
  isHidden,
  isSubmitting,
  onSubmit,
  onCancel,
}: ModeratorToolsModalContentProps) {
  return (
    <ScrollView className="flex-1 px-4">
      <View className="mb-6">
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {isHidden
            ? t('moderation.moderator_modal.unhide_subtitle')
            : t('moderation.moderator_modal.hide_subtitle')}
        </Text>
      </View>

      <View className="mb-4">
        <Text className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {t('moderation.moderator_modal.reason_label')}
        </Text>
        <Input
          value={reason}
          onChangeText={setReason}
          placeholder={t('moderation.moderator_modal.reason_placeholder')}
          multiline
          numberOfLines={4}
          maxLength={500}
          textAlignVertical="top"
          testID="moderator-reason-input"
          accessibilityLabel={t('moderation.moderator_modal.reason_label')}
          accessibilityHint={t(
            'moderation.moderator_modal.reason_accessibility'
          )}
        />
        <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {reason.length}/500
        </Text>
      </View>

      {error ? (
        <View className="mb-4">
          <Text className="text-sm text-danger-600 dark:text-danger-400">
            {error}
          </Text>
        </View>
      ) : null}

      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t('moderation.moderator_modal.cancel')}
            variant="outline"
            onPress={onCancel}
            disabled={isSubmitting}
            testID="moderator-cancel-btn"
          />
        </View>
        <View className="flex-1">
          <Button
            label={
              isSubmitting
                ? t('moderation.moderator_modal.submitting')
                : isHidden
                  ? t('moderation.moderator_modal.unhide_submit')
                  : t('moderation.moderator_modal.hide_submit')
            }
            onPress={onSubmit}
            disabled={isSubmitting}
            variant={isHidden ? 'default' : 'destructive'}
            testID="moderator-submit-btn"
          />
        </View>
      </View>

      <View className="dark:bg-warning-950 mb-2 rounded-lg bg-warning-50 p-3">
        <Text className="text-xs text-warning-800 dark:text-warning-200">
          {t('moderation.moderator_modal.audit_notice')}
        </Text>
      </View>
    </ScrollView>
  );
}

export const ModeratorToolsModal = React.forwardRef<
  ModeratorToolsModalRef,
  ModeratorToolsModalProps
>(({ contentType, contentId, isHidden, onSuccess }, ref) => {
  const { t } = useTranslation();
  const modal = useModal();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const hideContentMutation = useHideContent();
  const unhideContentMutation = useUnhideContent();

  const isSubmitting =
    hideContentMutation.isPending || unhideContentMutation.isPending;

  useImperativeHandle(ref, () => ({
    present: modal.present,
    dismiss: modal.dismiss,
  }));

  const handleSubmit = async () => {
    if (!isHidden && !reason.trim()) {
      setError(t('moderation.moderator_modal.reason_required'));
      return;
    }

    setError('');

    try {
      if (isHidden) {
        // Unhide content
        await unhideContentMutation.mutateAsync({
          contentType,
          contentId,
        });

        showMessage({
          message: t('moderation.moderator_modal.unhide_success'),
          type: 'success',
        });
      } else {
        // Hide content
        await hideContentMutation.mutateAsync({
          contentType,
          contentId,
          reason: reason.trim(),
        });

        showMessage({
          message: t('moderation.moderator_modal.hide_success'),
          type: 'success',
        });
      }

      // Reset state and close
      setReason('');
      modal.dismiss();
      onSuccess?.();
    } catch (err) {
      captureCategorizedErrorSync(err);
      setError(
        isHidden
          ? t('moderation.moderator_modal.unhide_failed')
          : t('moderation.moderator_modal.hide_failed')
      );
    }
  };

  const handleCancel = () => {
    setReason('');
    setError('');
    modal.dismiss();
  };

  return (
    <Modal
      ref={modal.ref}
      snapPoints={['60%']}
      title={
        isHidden
          ? t('moderation.moderator_modal.unhide_title')
          : t('moderation.moderator_modal.hide_title')
      }
      testID="moderator-tools-modal"
    >
      <ModeratorToolsModalContent
        t={t}
        reason={reason}
        setReason={setReason}
        error={error}
        isHidden={isHidden}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </Modal>
  );
});

ModeratorToolsModal.displayName = 'ModeratorToolsModal';
