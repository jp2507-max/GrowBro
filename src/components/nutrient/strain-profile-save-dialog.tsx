/**
 * Strain Profile Save Dialog
 *
 * Bottom sheet modal for saving custom strain profiles when users repeatedly
 * deviate from templates with positive outcomes.
 *
 * Requirements: 4.6
 */

import { type BottomSheetModal } from '@gorhom/bottom-sheet';
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { Button, Modal, Text, View } from '@/components/ui';

import {
  NameField,
  NotesField,
  PublishToggleField,
  type StrainProfileFormData,
} from './strain-profile-form-fields';

export type StrainProfileSaveDialogRef = {
  present: () => void;
  dismiss: () => void;
};

interface StrainProfileSaveDialogProps {
  defaultName?: string;
  onSave: (data: StrainProfileFormData) => void;
  onCancel: () => void;
  testID?: string;
}

export const StrainProfileSaveDialog = React.forwardRef<
  StrainProfileSaveDialogRef,
  StrainProfileSaveDialogProps
>(function StrainProfileSaveDialog(
  { defaultName, onSave, onCancel, testID = 'strain-profile-dialog' },
  ref
) {
  const { t } = useTranslation();
  const modalRef = React.useRef<BottomSheetModal>(null);

  const strainProfileSchema = z.object({
    name: z.string().min(1, t('validation.strain_name_required')),
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

  React.useImperativeHandle(ref, () => ({
    present: () => {
      reset({ name: defaultName ?? '', notes: '', publishPrivately: false });
      modalRef.current?.present();
    },
    dismiss: () => modalRef.current?.dismiss(),
  }));

  const handleSave = handleSubmit((data) => {
    onSave(data);
    reset();
    modalRef.current?.dismiss();
  });

  const handleCancel = React.useCallback(() => {
    onCancel();
    modalRef.current?.dismiss();
  }, [onCancel]);

  return (
    <Modal
      ref={modalRef}
      snapPoints={['70%']}
      title={t('nutrient.save_strain_profile')}
      testID={testID}
    >
      <View className="flex-1 px-4 pb-6">
        <Text className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          {t('nutrient.strain_profile_description')}
        </Text>
        <NameField control={control} testID={testID} />
        <NotesField control={control} testID={testID} />
        <PublishToggleField control={control} testID={testID} />
        <View className="mt-6 flex-row gap-3">
          <Button
            label={t('common.cancel')}
            onPress={handleCancel}
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
    </Modal>
  );
});
