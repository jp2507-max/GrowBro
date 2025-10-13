/**
 * Strain Profile Save Dialog
 *
 * Modal for saving custom strain profiles when users repeatedly
 * deviate from templates with positive outcomes.
 *
 * Requirements: 4.6
 */

import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal } from 'react-native';
import { z } from 'zod';

import { Button, Input, Text, View } from '@/components/ui';

type StrainProfileFormData = {
  name: string;
  notes?: string;
  publishPrivately: boolean;
};

interface StrainProfileSaveDialogProps {
  visible: boolean;
  defaultName?: string;
  onSave: (data: StrainProfileFormData) => void;
  onCancel: () => void;
  testID?: string;
}

// eslint-disable-next-line max-lines-per-function
export function StrainProfileSaveDialog({
  visible,
  defaultName,
  onSave,
  onCancel,
  testID = 'strain-profile-dialog',
}: StrainProfileSaveDialogProps) {
  const { t } = useTranslation();

  const strainProfileSchema = z.object({
    name: z.string().min(1, t('validation.strainNameRequired')),
    notes: z.string().optional(),
    publishPrivately: z.boolean().default(false),
  });

  const { control, handleSubmit, reset } = useForm<StrainProfileFormData>({
    resolver: zodResolver(strainProfileSchema),
    defaultValues: {
      name: defaultName ?? '',
      notes: '',
      publishPrivately: false,
    },
  });

  React.useEffect(() => {
    if (visible) {
      reset({
        name: defaultName ?? '',
        notes: '',
        publishPrivately: false,
      });
    }
  }, [visible, defaultName, reset]);

  const handleSave = handleSubmit((data) => {
    onSave(data);
    reset();
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 items-center justify-center bg-black/50 p-4">
        <View
          className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-charcoal-900"
          testID={testID}
        >
          <Text className="mb-4 text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {t('nutrient.saveStrainProfile')}
          </Text>

          <Text className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            {t('nutrient.strainProfileDescription')}
          </Text>

          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Input
                label={t('nutrient.strainName')}
                placeholder={t('nutrient.strainNamePlaceholder')}
                value={field.value}
                onChangeText={field.onChange}
                error={fieldState.error?.message}
                testID={`${testID}-name`}
              />
            )}
          />

          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <Input
                label={t('nutrient.notes')}
                placeholder={t('nutrient.strainNotesPlaceholder')}
                value={field.value ?? ''}
                onChangeText={field.onChange}
                multiline
                numberOfLines={3}
                testID={`${testID}-notes`}
              />
            )}
          />

          <Controller
            control={control}
            name="publishPrivately"
            render={({ field }) => (
              <View className="mt-3 flex-row items-center justify-between">
                <Text className="flex-1 text-sm text-neutral-700 dark:text-neutral-300">
                  {t('nutrient.publishPrivately')}
                </Text>
                <Button
                  variant={field.value ? 'default' : 'outline'}
                  label={field.value ? t('common.yes') : t('common.no')}
                  onPress={() => field.onChange(!field.value)}
                  testID={`${testID}-publish-toggle`}
                />
              </View>
            )}
          />

          <View className="mt-6 flex-row gap-3">
            <Button
              label={t('common.cancel')}
              onPress={onCancel}
              variant="outline"
              className="flex-1"
              testID={`${testID}-cancel`}
            />
            <Button
              label={t('common.save')}
              onPress={handleSave}
              className="flex-1"
              testID={`${testID}-save`}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
