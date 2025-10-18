/**
 * Report Content Modal
 *
 * Modal for reporting inappropriate content with reason selection and validation.
 * Requirements: 7.1, 7.5
 *
 * @example
 * const modalRef = useRef<ReportContentModalRef>(null);
 * <ReportContentModal ref={modalRef} contentId="post-123" onSuccess={() => {}} />
 * modalRef.current?.present();
 */

import React, { useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { Button, Modal, Text, useModal, View } from '@/components/ui';
import { showErrorMessage } from '@/components/ui/utils';
import { AuthenticationError, getAuthenticatedUserId } from '@/lib/auth';
import type { ModerationReason } from '@/lib/moderation/moderation-manager';
import { moderationManager } from '@/lib/moderation/moderation-manager';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

type ReportContentModalProps = {
  contentId: string | number;
  onSuccess?: () => void;
};

export type ReportContentModalRef = {
  present: () => void;
  dismiss: () => void;
};

type ReasonOption = {
  value: ModerationReason;
  label: string;
  description: string;
};

export const ReportContentModal = React.forwardRef<
  ReportContentModalRef,
  ReportContentModalProps
>(({ contentId, onSuccess }, ref) => {
  const { t } = useTranslation();
  const modal = useModal();
  const [selectedReason, setSelectedReason] = useState<ModerationReason | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({
    present: modal.present,
    dismiss: modal.dismiss,
  }));

  const reasons: ReasonOption[] = [
    {
      value: 'spam',
      label: t('moderation.report_modal.reason_spam'),
      description: t('moderation.report_modal.reason_spam_desc'),
    },
    {
      value: 'harassment',
      label: t('moderation.report_modal.reason_harassment'),
      description: t('moderation.report_modal.reason_harassment_desc'),
    },
    {
      value: 'illegal',
      label: t('moderation.report_modal.reason_illegal'),
      description: t('moderation.report_modal.reason_illegal_desc'),
    },
    {
      value: 'other',
      label: t('moderation.report_modal.reason_other'),
      description: t('moderation.report_modal.reason_other_desc'),
    },
  ];

  const handleSubmit = async () => {
    if (!selectedReason) {
      setError(t('moderation.report_modal.select_reason'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const userId = await getAuthenticatedUserId();
      const result = await moderationManager.reportContent(
        contentId,
        selectedReason,
        userId
      );

      if (result.status === 'sent' || result.status === 'queued') {
        // Show success message
        const message =
          result.status === 'sent'
            ? t('moderation.report_modal.success')
            : t('moderation.report_modal.queued');

        // Close modal first, then show success
        modal.dismiss();

        // Reset state
        setSelectedReason(null);
        setError('');

        // Call success callback
        onSuccess?.();

        // Show toast after a short delay to ensure modal is closed
        setTimeout(() => {
          // We'll use the existing flash message system
          console.log(message);
        }, 300);
      }
    } catch (err) {
      if (err instanceof AuthenticationError) {
        showErrorMessage(t('moderation.authentication_required'));
      } else {
        captureCategorizedErrorSync(err);
        setError(t('moderation.report_failed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedReason(null);
    setError('');
    modal.dismiss();
  };

  return (
    <Modal
      ref={modal.ref}
      snapPoints={['70%']}
      title={t('moderation.report_modal.title')}
      testID="report-content-modal"
    >
      <ScrollView className="flex-1 px-4">
        <View className="mb-6">
          <Text className="text-sm text-neutral-600 dark:text-neutral-400">
            {t('moderation.report_modal.subtitle')}
          </Text>
        </View>

        <View className="mb-6">
          {reasons.map((reason) => (
            <ReasonOption
              key={reason.value}
              option={reason}
              selected={selectedReason === reason.value}
              onSelect={() => setSelectedReason(reason.value)}
              testID={`report-reason-${reason.value}`}
            />
          ))}
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
              label={t('moderation.report_modal.cancel')}
              variant="outline"
              onPress={handleCancel}
              disabled={isSubmitting}
              testID="report-cancel-btn"
            />
          </View>
          <View className="flex-1">
            <Button
              label={
                isSubmitting
                  ? t('moderation.report_modal.submitting')
                  : t('moderation.report_modal.submit')
              }
              onPress={handleSubmit}
              disabled={isSubmitting || !selectedReason}
              testID="report-submit-btn"
            />
          </View>
        </View>
      </ScrollView>
    </Modal>
  );
});

ReportContentModal.displayName = 'ReportContentModal';

/**
 * Reason option component
 */
function ReasonOption({
  option,
  selected,
  onSelect,
  testID,
}: {
  option: ReasonOption;
  selected: boolean;
  onSelect: () => void;
  testID: string;
}) {
  return (
    <View
      className={`mb-3 rounded-lg border-2 p-4 ${
        selected
          ? 'dark:bg-primary-950 border-primary-600 bg-primary-50 dark:border-primary-500'
          : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-charcoal-900'
      }`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${option.label}. ${option.description}`}
      testID={testID}
    >
      <View
        className="cursor-pointer"
        onTouchEnd={onSelect}
        accessibilityRole="button"
      >
        <View className="mb-2 flex-row items-center">
          <View
            className={`mr-3 size-5 items-center justify-center rounded-full border-2 ${
              selected
                ? 'border-primary-600 bg-primary-600 dark:border-primary-500 dark:bg-primary-500'
                : 'border-neutral-400 dark:border-neutral-600'
            }`}
          >
            {selected && <View className="size-2 rounded-full bg-white" />}
          </View>
          <Text className="flex-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {option.label}
          </Text>
        </View>
        <Text className="ml-8 text-sm text-neutral-600 dark:text-neutral-400">
          {option.description}
        </Text>
      </View>
    </View>
  );
}
