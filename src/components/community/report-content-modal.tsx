/**
 * Report Content Modal
 *
 * DSA-compliant modal for reporting inappropriate content with two-track system:
 * - Illegal Content (Art. 16 compliance with jurisdiction + legal reference)
 * - Policy/Terms Breach
 *
 * Requirements: 1.1, 1.2, 1.3
 *
 * @example
 * const modalRef = useRef<ReportContentModalRef>(null);
 * <ReportContentModal ref={modalRef} contentId="post-123" onSuccess={() => {}} />
 * modalRef.current?.present();
 */

import { zodResolver } from '@hookform/resolvers/zod';
import React, { useImperativeHandle, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';
import { z } from 'zod';

import { JurisdictionSelector } from '@/components/moderation/jurisdiction-selector';
import {
  Button,
  Checkbox,
  ControlledInput,
  Modal,
  Text,
  useModal,
  View,
} from '@/components/ui';
import { showErrorMessage } from '@/components/ui/utils';
import { AuthenticationError, getAuthenticatedUserId } from '@/lib/auth';
import type { ModerationReason } from '@/lib/moderation/moderation-manager';
import { moderationManager } from '@/lib/moderation/moderation-manager';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';

type ReportContentModalProps = {
  contentId: string | number;
  contentLocator?: string; // Optional permalink/deep link
  onSuccess?: () => void;
};

export type ReportContentModalRef = {
  present: () => void;
  dismiss: () => void;
};

type ReportType = 'illegal' | 'policy';

// DSA Art. 16 compliant form schema
const createReportSchema = (t: any) =>
  z
    .object({
      reportType: z.enum(['illegal', 'policy'], {
        required_error: t('moderation.report_modal.select_reason'),
      }),
      reason: z.enum(['spam', 'harassment', 'illegal', 'other'] as const, {
        required_error: t('moderation.report_modal.select_reason'),
      }),
      jurisdiction: z.string().optional(),
      legalReference: z.string().optional(),
      explanation: z
        .string()
        .min(50, t('moderation.report_modal.explanation_too_short'))
        .max(5000, t('moderation.report_modal.explanation_too_long')),
      reporterEmail: z
        .string()
        .email(t('moderation.report_modal.evidence_url_invalid'))
        .optional()
        .or(z.literal('')),
      goodFaithDeclaration: z.literal(true, {
        errorMap: () => ({
          message: t('moderation.report_modal.good_faith_required'),
        }),
      }),
    })
    .superRefine((data, ctx) => {
      // DSA Art. 16: illegal reports must include jurisdiction and legal reference
      if (data.reportType === 'illegal') {
        if (!data.jurisdiction) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['jurisdiction'],
            message: t('moderation.report_modal.jurisdiction_required'),
          });
        }
        if (!data.legalReference || data.legalReference.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['legalReference'],
            message: t('moderation.report_modal.legal_reference_required'),
          });
        }
      }
    });

type ReportFormData = z.infer<ReturnType<typeof createReportSchema>>;

type ReasonOption = {
  value: ModerationReason;
  label: string;
  description: string;
  reportType: ReportType;
};

function useReportContentForm(
  contentId: string | number,
  onSuccess?: () => void
) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<ReportFormData>({
    resolver: zodResolver(createReportSchema(t)),
    defaultValues: {
      reportType: 'policy',
      reason: undefined,
      jurisdiction: undefined,
      legalReference: '',
      explanation: '',
      reporterEmail: '',
      goodFaithDeclaration: undefined,
    },
  });

  const reportType = watch('reportType');
  const reason = watch('reason');
  const explanation = watch('explanation');

  const reasons: ReasonOption[] = [
    {
      value: 'spam',
      label: t('moderation.report_modal.reason_spam'),
      description: t('moderation.report_modal.reason_spam_desc'),
      reportType: 'policy',
    },
    {
      value: 'harassment',
      label: t('moderation.report_modal.reason_harassment'),
      description: t('moderation.report_modal.reason_harassment_desc'),
      reportType: 'policy',
    },
    {
      value: 'illegal',
      label: t('moderation.report_modal.reason_illegal'),
      description: t('moderation.report_modal.reason_illegal_desc'),
      reportType: 'illegal',
    },
    {
      value: 'other',
      label: t('moderation.report_modal.reason_other'),
      description: t('moderation.report_modal.reason_other_desc'),
      reportType: 'policy',
    },
  ];

  const submitReport = handleSubmit(async (data) => {
    setIsSubmitting(true);

    try {
      const userId = await getAuthenticatedUserId();

      // TODO: In Step 6, enhance moderationManager to accept full DSA Art. 16 payload
      // For now, we use the existing interface
      const result = await moderationManager.reportContent(
        contentId,
        data.reason,
        userId
      );

      if (result.status === 'sent' || result.status === 'queued') {
        const message =
          result.status === 'sent'
            ? t('moderation.report_modal.success')
            : t('moderation.report_modal.queued');

        // Reset form and call success callback
        reset();
        onSuccess?.();

        // Show toast after a short delay
        setTimeout(() => {
          console.log(message);
        }, 300);
      }
    } catch (err) {
      if (err instanceof AuthenticationError) {
        showErrorMessage(t('moderation.authentication_required'));
      } else {
        captureCategorizedErrorSync(err);
        showErrorMessage(t('moderation.report_failed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  });

  const resetForm = () => {
    reset();
  };

  const charCount = explanation?.length || 0;

  return {
    control,
    errors,
    reportType,
    reason,
    reasons,
    submitReport,
    resetForm,
    isSubmitting,
    charCount,
  };
}

function ReportContentForm({
  control,
  errors,
  reportType,
  reason: _reason,
  reasons,
  onSubmit,
  onCancel,
  isSubmitting,
  charCount,
}: {
  control: any;
  errors: any;
  reportType: ReportType;
  reason: ModerationReason | undefined;
  reasons: ReasonOption[];
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  charCount: number;
}) {
  const { t } = useTranslation();

  // Filter reasons based on report type
  const filteredReasons = reasons.filter((r) => {
    if (reportType === 'illegal') return r.value === 'illegal';
    return r.value !== 'illegal';
  });

  return (
    <ScrollView className="flex-1 px-4">
      {/* Subtitle */}
      <View className="mb-6">
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('moderation.report_modal.subtitle')}
        </Text>
      </View>

      {/* Report Type Selection */}
      <View className="mb-6">
        <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {t('moderation.report_modal.report_type_label')}
        </Text>
        <Controller
          control={control}
          name="reportType"
          render={({ field: { value, onChange } }) => (
            <View className="gap-3">
              <ReportTypeOption
                type="policy"
                label={t('moderation.report_modal.report_type_policy')}
                description={t(
                  'moderation.report_modal.report_type_policy_desc'
                )}
                selected={value === 'policy'}
                onSelect={() => onChange('policy')}
                testID="report-type-policy"
              />
              <ReportTypeOption
                type="illegal"
                label={t('moderation.report_modal.report_type_illegal')}
                description={t(
                  'moderation.report_modal.report_type_illegal_desc'
                )}
                selected={value === 'illegal'}
                onSelect={() => onChange('illegal')}
                testID="report-type-illegal"
              />
            </View>
          )}
        />
      </View>

      {/* Reason Selection */}
      <View className="mb-6">
        <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {t('moderation.report_modal.select_reason')}
        </Text>
        <Controller
          control={control}
          name="reason"
          render={({ field: { value, onChange } }) => (
            <View>
              {filteredReasons.map((r) => (
                <ReasonOptionComponent
                  key={r.value}
                  option={r}
                  selected={value === r.value}
                  onSelect={() => onChange(r.value)}
                  testID={`report-reason-${r.value}`}
                />
              ))}
            </View>
          )}
        />
        {errors.reason && (
          <Text className="mt-2 text-sm text-danger-600 dark:text-danger-400">
            {errors.reason.message as string}
          </Text>
        )}
      </View>

      {/* Jurisdiction (illegal reports only) */}
      {reportType === 'illegal' && (
        <View className="mb-6">
          <JurisdictionSelector
            control={control}
            name="jurisdiction"
            errors={errors}
            testID="jurisdiction-selector"
          />
        </View>
      )}

      {/* Legal Reference (illegal reports only) */}
      {reportType === 'illegal' && (
        <View className="mb-6">
          <ControlledInput
            control={control}
            name="legalReference"
            label={t('moderation.report_modal.legal_reference_label')}
            placeholder={t(
              'moderation.report_modal.legal_reference_placeholder'
            )}
            error={errors.legalReference?.message as string}
            testID="legal-reference-input"
          />
        </View>
      )}

      {/* Explanation */}
      <View className="mb-6">
        <ControlledInput
          control={control}
          name="explanation"
          label={t('moderation.report_modal.explanation_label')}
          placeholder={t('moderation.report_modal.explanation_placeholder')}
          multiline
          numberOfLines={6}
          error={errors.explanation?.message as string}
          testID="explanation-input"
        />
        <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {t('moderation.report_modal.char_count', {
            count: charCount,
            max: 5000,
          })}
        </Text>
      </View>

      {/* Reporter Email (optional) */}
      <View className="mb-6">
        <ControlledInput
          control={control}
          name="reporterEmail"
          label={t('moderation.report_modal.reporter_email_label')}
          placeholder={t('moderation.report_modal.reporter_email_placeholder')}
          keyboardType="email-address"
          error={errors.reporterEmail?.message as string}
          testID="reporter-email-input"
        />
      </View>

      {/* Good Faith Declaration */}
      <View className="mb-6">
        <Controller
          control={control}
          name="goodFaithDeclaration"
          render={({ field: { value, onChange } }) => (
            <Checkbox
              checked={value === true}
              onChange={onChange}
              label={t('moderation.report_modal.good_faith_declaration_label')}
              accessibilityLabel={t(
                'moderation.report_modal.good_faith_declaration_label'
              )}
              accessibilityHint="Check this box to confirm you are submitting this report in good faith"
              testID="good-faith-checkbox"
            />
          )}
        />
        {errors.goodFaithDeclaration && (
          <Text className="mt-2 text-sm text-danger-600 dark:text-danger-400">
            {errors.goodFaithDeclaration.message as string}
          </Text>
        )}
      </View>

      {/* Actions */}
      <View className="mb-4 flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t('moderation.report_modal.cancel')}
            variant="outline"
            onPress={onCancel}
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
            onPress={onSubmit}
            disabled={isSubmitting}
            testID="report-submit-btn"
          />
        </View>
      </View>
    </ScrollView>
  );
}

export const ReportContentModal = React.forwardRef<
  ReportContentModalRef,
  ReportContentModalProps
>(({ contentId, onSuccess }, ref) => {
  const { t } = useTranslation();
  const modal = useModal();

  const {
    control,
    errors,
    reportType,
    reason,
    reasons,
    submitReport,
    resetForm,
    isSubmitting,
    charCount,
  } = useReportContentForm(contentId, onSuccess);

  useImperativeHandle(ref, () => ({
    present: modal.present,
    dismiss: modal.dismiss,
  }));

  const handleSubmit = async () => {
    await submitReport();
    modal.dismiss();
  };

  const handleCancel = () => {
    resetForm();
    modal.dismiss();
  };

  return (
    <Modal
      ref={modal.ref}
      snapPoints={['90%']}
      title={t('moderation.report_modal.title')}
      testID="report-content-modal"
    >
      <ReportContentForm
        control={control}
        errors={errors}
        reportType={reportType}
        reason={reason}
        reasons={reasons}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
        charCount={charCount}
      />
    </Modal>
  );
});

ReportContentModal.displayName = 'ReportContentModal';

/**
 * Report Type Option Component
 */
function ReportTypeOption({
  type: _type,
  label,
  description,
  selected,
  onSelect,
  testID,
}: {
  type: ReportType;
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onSelect}
      className={`rounded-lg border-2 p-4 ${
        selected
          ? 'dark:bg-primary-950 border-primary-600 bg-primary-50 dark:border-primary-500'
          : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-charcoal-900'
      }`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}. ${description}`}
      accessibilityHint="Double tap to select this report type"
      testID={testID}
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
          {label}
        </Text>
      </View>
      <Text className="ml-8 text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </Text>
    </Pressable>
  );
}

/**
 * Reason Option Component
 */
function ReasonOptionComponent({
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
    <Pressable
      onPress={onSelect}
      className={`mb-3 rounded-lg border-2 p-4 ${
        selected
          ? 'dark:bg-primary-950 border-primary-600 bg-primary-50 dark:border-primary-500'
          : 'border-neutral-200 bg-white dark:border-neutral-700 dark:bg-charcoal-900'
      }`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${option.label}. ${option.description}`}
      accessibilityHint="Double tap to select this reason for reporting"
      testID={testID}
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
    </Pressable>
  );
}
