/**
 * Share Template Modal
 *
 * Modal for sharing a playbook as a community template
 */

import React from 'react';
import {
  type Control,
  Controller,
  useForm,
  type UseFormHandleSubmit,
  type UseFormStateReturn,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { useShareTemplate } from '@/api/templates';
import { Button, Input, Text, View } from '@/components/ui';
import type { Playbook } from '@/lib/playbooks/sanitize-playbook';
import { validatePlaybookForSharing } from '@/lib/playbooks/sanitize-playbook';

function useShareTemplateForm(
  playbook: Playbook,
  onSuccess: () => void
): {
  control: Control<ShareTemplateFormData>;
  handleSubmit: UseFormHandleSubmit<ShareTemplateFormData>;
  formState: UseFormStateReturn<ShareTemplateFormData>;
  isPending: boolean;
} {
  const { t } = useTranslation();
  const { control, handleSubmit, formState } = useForm<ShareTemplateFormData>({
    defaultValues: {
      authorHandle: '',
      description: '',
      license: 'CC-BY-SA',
    },
  });

  const shareTemplate = useShareTemplate();

  const onSubmit = async (data: ShareTemplateFormData) => {
    const validation = validatePlaybookForSharing(playbook);
    if (!validation.valid) {
      Alert.alert(
        t('shareTemplate.validationTitle'),
        t('shareTemplate.validationMessage', {
          errors: validation.errors.join('\n'),
        })
      );
      return;
    }

    try {
      await shareTemplate.mutateAsync({
        playbook,
        authorHandle: data.authorHandle,
        description: data.description,
        license: data.license,
        isPublic: true,
      });

      Alert.alert(
        t('shareTemplate.successTitle'),
        t('shareTemplate.successMessage')
      );
      onSuccess();
    } catch (error) {
      Alert.alert(
        t('shareTemplate.errorTitle'),
        t('shareTemplate.errorMessage', {
          message:
            error instanceof Error ? error.message : 'Failed to share template',
        })
      );
    }
  };

  return {
    control,
    handleSubmit: handleSubmit(onSubmit),
    formState,
    isPending: shareTemplate.isPending,
  };
}

interface ShareTemplateFormData {
  authorHandle: string;
  description: string;
  license: string;
}

interface ShareTemplateModalProps {
  playbook: Playbook;
  onSuccess: () => void;
  onCancel: () => void;
}

function AuthorHandleField({
  control,
}: {
  control: Control<ShareTemplateFormData>;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t('playbooks.shareTemplate.authorHandle')}
      </Text>
      <Controller
        control={control}
        name="authorHandle"
        rules={{
          required: t('playbooks.shareTemplate.errors.handleRequired'),
          minLength: {
            value: 3,
            message: t('playbooks.shareTemplate.errors.handleMinLength'),
          },
          maxLength: {
            value: 30,
            message: t('playbooks.shareTemplate.errors.handleMaxLength'),
          },
          pattern: {
            value: /^[a-zA-Z0-9_-]+$/,
            message: t('playbooks.shareTemplate.errors.handlePattern'),
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <>
            <Input
              testID="share-template-handle-input"
              value={value}
              onChangeText={onChange}
              placeholder={t('playbooks.shareTemplate.placeholderHandle')}
              autoCapitalize="none"
              className="mb-1"
            />
            {error && (
              <Text className="text-xs text-danger-600">{error.message}</Text>
            )}
          </>
        )}
      />
    </View>
  );
}

function DescriptionField({
  control,
}: {
  control: Control<ShareTemplateFormData>;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t('playbooks.shareTemplate.description')}
      </Text>
      <Controller
        control={control}
        name="description"
        rules={{
          maxLength: {
            value: 500,
            message: t('playbooks.shareTemplate.errors.descriptionMaxLength'),
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <>
            <Input
              testID="share-template-description-input"
              value={value}
              onChangeText={onChange}
              placeholder={t('playbooks.shareTemplate.placeholderDescription')}
              multiline
              numberOfLines={4}
              className="mb-1"
            />
            {error && (
              <Text className="text-xs text-danger-600">{error.message}</Text>
            )}
          </>
        )}
      />
    </View>
  );
}

function LicenseField({
  control,
}: {
  control: Control<ShareTemplateFormData>;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="mb-6">
      <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t('playbooks.shareTemplate.license')}
      </Text>
      <Controller
        control={control}
        name="license"
        render={({ field: { value } }) => (
          <View className="rounded-lg bg-neutral-100 p-3 dark:bg-charcoal-900">
            <Text className="text-sm text-neutral-700 dark:text-neutral-300">
              {t('playbooks.shareTemplate.licenseText', { license: value })}
            </Text>
            <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              {t('playbooks.shareTemplate.licenseDescription')}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

function PrivacyNotice(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="dark:bg-primary-950 mb-4 rounded-lg bg-primary-50 p-3">
      <Text className="text-xs text-primary-700 dark:text-primary-300">
        {t('playbooks.shareTemplate.privacyNotice')}
      </Text>
    </View>
  );
}

function ActionButtons({
  onCancel,
  onShare,
  isPending,
  isValid,
}: {
  onCancel: () => void;
  onShare: () => void;
  isPending: boolean;
  isValid: boolean;
}): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="flex-row gap-3">
      <Button
        variant="outline"
        onPress={onCancel}
        className="flex-1"
        disabled={isPending}
        testID="share-template-cancel-button"
      >
        <Text>{t('common.cancel')}</Text>
      </Button>
      <Button
        onPress={onShare}
        className="flex-1"
        disabled={isPending || !isValid}
        testID="share-template-confirm-button"
      >
        <Text>
          {isPending
            ? t('playbooks.shareTemplate.sharing')
            : t('playbooks.shareTemplate.share')}
        </Text>
      </Button>
    </View>
  );
}

function ModalHeader(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      <Text className="mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        {t('playbooks.shareTemplate.title')}
      </Text>
      <Text className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        {t('playbooks.shareTemplate.subtitle')}
      </Text>
    </>
  );
}

export function ShareTemplateModal({
  playbook,
  onSuccess,
  onCancel,
}: ShareTemplateModalProps) {
  const { control, handleSubmit, formState, isPending } = useShareTemplateForm(
    playbook,
    onSuccess
  );

  return (
    <View className="flex-1 bg-neutral-50 p-4 dark:bg-charcoal-950">
      <ModalHeader />
      <AuthorHandleField control={control} />
      <DescriptionField control={control} />
      <LicenseField control={control} />
      <PrivacyNotice />
      <ActionButtons
        onCancel={onCancel}
        onShare={handleSubmit}
        isPending={isPending}
        isValid={formState.isValid}
      />
    </View>
  );
}
