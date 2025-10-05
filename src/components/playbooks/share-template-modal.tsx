/**
 * Share Template Modal
 *
 * Modal for sharing a playbook as a community template
 */

import React from 'react';
import { type Control, Controller, useForm } from 'react-hook-form';
import { Alert } from 'react-native';

import { useShareTemplate } from '@/api/templates';
import { Button, Input, Text, View } from '@/components/ui';
import type { Playbook } from '@/lib/playbooks/sanitize-playbook';
import { validatePlaybookForSharing } from '@/lib/playbooks/sanitize-playbook';

function useShareTemplateForm(playbook: Playbook, onSuccess: () => void) {
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
        'Validation Error',
        `Cannot share playbook:\n${validation.errors.join('\n')}`
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
        'Success',
        'Your playbook has been shared with the community!'
      );
      onSuccess();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to share template'
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
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Author Handle *
      </Text>
      <Controller
        control={control}
        name="authorHandle"
        rules={{
          required: 'Author handle is required',
          minLength: {
            value: 3,
            message: 'Handle must be at least 3 characters',
          },
          maxLength: {
            value: 30,
            message: 'Handle must be at most 30 characters',
          },
          pattern: {
            value: /^[a-zA-Z0-9_-]+$/,
            message: 'Handle can only contain letters, numbers, - and _',
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <>
            <Input
              testID="share-template-handle-input"
              value={value}
              onChangeText={onChange}
              placeholder="your_handle"
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
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Description (Optional)
      </Text>
      <Controller
        control={control}
        name="description"
        rules={{
          maxLength: {
            value: 500,
            message: 'Description must be at most 500 characters',
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <>
            <Input
              testID="share-template-description-input"
              value={value}
              onChangeText={onChange}
              placeholder="Describe your playbook..."
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
}) {
  return (
    <View className="mb-6">
      <Text className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        License
      </Text>
      <Controller
        control={control}
        name="license"
        render={({ field: { value } }) => (
          <View className="rounded-lg bg-neutral-100 p-3 dark:bg-charcoal-900">
            <Text className="text-sm text-neutral-700 dark:text-neutral-300">
              {value} - Creative Commons Attribution-ShareAlike
            </Text>
            <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-500">
              Others can use and modify your playbook with attribution
            </Text>
          </View>
        )}
      />
    </View>
  );
}

function PrivacyNotice() {
  return (
    <View className="dark:bg-primary-950 mb-4 rounded-lg bg-primary-50 p-3">
      <Text className="text-xs text-primary-700 dark:text-primary-300">
        ℹ️ All personal information, plant names, and custom notes will be
        automatically removed before sharing.
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
}) {
  return (
    <View className="flex-row gap-3">
      <Button
        variant="outline"
        onPress={onCancel}
        className="flex-1"
        disabled={isPending}
      >
        <Text>Cancel</Text>
      </Button>
      <Button
        onPress={onShare}
        className="flex-1"
        disabled={isPending || !isValid}
      >
        <Text>{isPending ? 'Sharing...' : 'Share'}</Text>
      </Button>
    </View>
  );
}

function ModalHeader() {
  return (
    <>
      <Text className="mb-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        Share Playbook
      </Text>
      <Text className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
        Share your customized playbook with the community. All personal
        information will be automatically removed.
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
