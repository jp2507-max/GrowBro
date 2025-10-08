/**
 * Harvest Modal Component
 *
 * Modal for recording harvest data with weight inputs and validation
 * Requirements: 1.1 (modal with inputs), 1.2 (validation), 1.3 (save with timestamp)
 */

import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { PhotoCapture } from '@/components/photo-capture';
import { Button, Input, Text, View } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { enqueueHarvestPhotos } from '@/lib/uploads/harvest-photo-queue';
import type { PhotoVariants } from '@/types/photo-storage';

import {
  type HarvestFormData,
  harvestFormSchema,
  parseHarvestFormData,
} from '../../lib/harvest/harvest-form-schema';
import {
  createHarvest,
  type CreateHarvestInput,
} from '../../lib/harvest/harvest-service';
import type { WeightUnit } from '../../lib/harvest/weight-conversion';
import { toDisplayValue } from '../../lib/harvest/weight-conversion';

export interface HarvestModalProps {
  /** Control modal visibility */
  isVisible: boolean;

  /** Plant ID to link harvest to */
  plantId: string;

  /** Initial data for editing existing harvest */
  initialData?: Partial<CreateHarvestInput>;

  /** Called on successful save */
  onSubmit?: (harvest: any) => void;

  /** Called on cancel or close */
  onCancel: () => void;
}

/**
 * Unit toggle button component
 */
function UnitToggle({
  unit,
  onChange,
  testID,
}: {
  unit: WeightUnit;
  onChange: (unit: WeightUnit) => void;
  testID?: string;
}) {
  const { t } = useTranslation();

  return (
    <View className="mb-4 flex-row items-center" testID={testID}>
      <Text className="mr-3 text-base text-charcoal-950 dark:text-neutral-100">
        {t('harvest.modal.unitToggle')}:
      </Text>
      <View className="flex-row overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
        <Pressable
          onPress={() => onChange('g')}
          className={`px-4 py-2 ${unit === 'g' ? 'bg-primary-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}
          accessibilityRole="button"
          accessibilityLabel={t('harvest.units.gramsLong')}
          accessibilityHint={t('harvest.accessibility.unitToggle')}
          accessibilityState={{ selected: unit === 'g' }}
          testID={`${testID}-grams`}
        >
          <Text
            className={`text-sm font-medium ${unit === 'g' ? 'text-white' : 'text-charcoal-950 dark:text-neutral-100'}`}
          >
            {t('harvest.units.gramsLong')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChange('oz')}
          className={`px-4 py-2 ${unit === 'oz' ? 'bg-primary-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}
          accessibilityRole="button"
          accessibilityLabel={t('harvest.units.ouncesLong')}
          accessibilityHint={t('harvest.accessibility.unitToggle')}
          accessibilityState={{ selected: unit === 'oz' }}
          testID={`${testID}-ounces`}
        >
          <Text
            className={`text-sm font-medium ${unit === 'oz' ? 'text-white' : 'text-charcoal-950 dark:text-neutral-100'}`}
          >
            {t('harvest.units.ouncesLong')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Weight input field with unit awareness
 */
function WeightInput({
  control,
  name,
  label,
  unit,
  error,
  testID,
  accessibilityHint,
}: {
  control: any;
  name: 'wetWeight' | 'dryWeight' | 'trimmingsWeight';
  label: string;
  unit: WeightUnit;
  error?: string;
  testID?: string;
  accessibilityHint: string;
}) {
  const { t } = useTranslation();
  const unitLabel =
    unit === 'g' ? t('harvest.units.grams') : t('harvest.units.ounces');

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <Input
          label={`${label} (${unitLabel})`}
          placeholder={`0.0 ${unitLabel}`}
          keyboardType="decimal-pad"
          onBlur={onBlur}
          onChangeText={onChange}
          value={value || ''}
          error={error}
          testID={testID}
          accessibilityLabel={`${label} input`}
          accessibilityHint={accessibilityHint}
        />
      )}
    />
  );
}

/**
 * Get default form values from initial data
 */
function getDefaultValues(
  initialData: Partial<CreateHarvestInput> | undefined
): HarvestFormData {
  return {
    wetWeight: initialData?.wetWeightG
      ? toDisplayValue(initialData.wetWeightG, 'g').toString()
      : '',
    dryWeight: initialData?.dryWeightG
      ? toDisplayValue(initialData.dryWeightG, 'g').toString()
      : '',
    trimmingsWeight: initialData?.trimmingsWeightG
      ? toDisplayValue(initialData.trimmingsWeightG, 'g').toString()
      : '',
    unit: 'g',
    notes: initialData?.notes || '',
  };
}

/**
 * Custom hook for managing harvest modal state
 */
function useHarvestModalState(
  initialData: Partial<CreateHarvestInput> | undefined
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoVariants, setPhotoVariants] = useState<PhotoVariants[]>([]);
  const [photoUris, setPhotoUris] = useState<string[]>(
    initialData?.photos || []
  );

  return {
    isSubmitting,
    setIsSubmitting,
    photoVariants,
    setPhotoVariants,
    photoUris,
    setPhotoUris,
  };
}

/**
 * Custom hook for photo handling
 */
function usePhotoHandler(
  setPhotoVariants: React.Dispatch<React.SetStateAction<PhotoVariants[]>>,
  setPhotoUris: React.Dispatch<React.SetStateAction<string[]>>,
  t: (key: string) => string
) {
  return (variants: PhotoVariants) => {
    // Store full variants for upload queueing
    setPhotoVariants((prev) => [...prev, variants]);
    // Store URIs for display and harvest record
    setPhotoUris((prev) => [
      ...prev,
      variants.original,
      variants.resized,
      variants.thumbnail,
    ]);
    showMessage({
      message: t('harvest.photo.success'),
      type: 'success',
    });
  };
}

/**
 * Modal body with form and scrollview
 */
function ModalBody({
  control,
  currentUnit,
  onUnitChange,
  errors,
  photos,
  onAddPhoto,
  t,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  control: any;
  currentUnit: WeightUnit;
  onUnitChange: (unit: WeightUnit) => void;
  errors: any;
  photos: string[];
  onAddPhoto: (variants: PhotoVariants) => void;
  t: (key: string, options?: any) => string;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <ModalHeader t={t} />
      <ScrollView className="flex-1 p-4">
        <FormContent
          control={control}
          currentUnit={currentUnit}
          onUnitChange={onUnitChange}
          errors={errors}
          photos={photos}
          onAddPhoto={onAddPhoto}
          t={t}
        />
      </ScrollView>
      <ActionButtons
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        onSubmit={onSubmit}
        t={t}
      />
    </>
  );
}

/**
 * Main HarvestModal component
 */
export function HarvestModal({
  isVisible,
  plantId,
  initialData,
  onSubmit,
  onCancel,
}: HarvestModalProps) {
  const { t } = useTranslation();
  const {
    isSubmitting,
    setIsSubmitting,
    photoVariants,
    setPhotoVariants,
    photoUris,
    setPhotoUris,
  } = useHarvestModalState(initialData);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HarvestFormData>({
    resolver: zodResolver(harvestFormSchema),
    defaultValues: getDefaultValues(initialData),
  });

  const currentUnit = watch('unit') as WeightUnit;
  const handleAddPhoto = usePhotoHandler(setPhotoVariants, setPhotoUris, t);

  const handleUnitChange = (newUnit: WeightUnit) => {
    if (newUnit === currentUnit) return;
    setValue('unit', newUnit);
  };

  const onSubmitForm = useHandleSubmit({
    plantId,
    photoUris,
    photoVariants,
    setIsSubmitting,
    onSubmit,
    onCancel,
    t,
  });

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
        <ModalBody
          control={control}
          currentUnit={currentUnit}
          onUnitChange={handleUnitChange}
          errors={errors}
          photos={photoUris}
          onAddPhoto={handleAddPhoto}
          t={t}
          isSubmitting={isSubmitting}
          onCancel={onCancel}
          onSubmit={handleSubmit(onSubmitForm)}
        />
      </View>
    </Modal>
  );
}

/**
 * Modal header component
 */
function ModalHeader({ t }: { t: (key: string) => string }) {
  return (
    <View className="border-b border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900">
      <Text className="text-2xl font-semibold text-charcoal-950 dark:text-neutral-100">
        {t('harvest.modal.title')}
      </Text>
      <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {t('harvest.modal.subtitle')}
      </Text>
    </View>
  );
}

/**
 * Form content with all inputs
 */
function FormContent({
  control,
  currentUnit,
  onUnitChange,
  errors,
  photos,
  onAddPhoto,
  t,
}: {
  control: any;
  currentUnit: WeightUnit;
  onUnitChange: (unit: WeightUnit) => void;
  errors: any;
  photos: string[];
  onAddPhoto: (variants: PhotoVariants) => void;
  t: (key: string, options?: any) => string;
}) {
  return (
    <>
      <UnitToggle
        unit={currentUnit}
        onChange={onUnitChange}
        testID="unit-toggle"
      />
      <WeightInputs
        control={control}
        currentUnit={currentUnit}
        errors={errors}
        t={t}
      />
      <NotesField control={control} t={t} />
      <PhotoSection photos={photos} onAddPhoto={onAddPhoto} t={t} />
    </>
  );
}

/**
 * Weight input fields group
 */
function WeightInputs({
  control,
  currentUnit,
  errors,
  t,
}: {
  control: any;
  currentUnit: WeightUnit;
  errors: any;
  t: (key: string) => string;
}) {
  return (
    <>
      <WeightInput
        control={control}
        name="wetWeight"
        label={t('harvest.modal.wetWeight')}
        unit={currentUnit}
        error={
          errors.wetWeight?.message ? t(errors.wetWeight.message) : undefined
        }
        testID="wet-weight-input"
        accessibilityHint={t('harvest.accessibility.wetWeightInput')}
      />

      <WeightInput
        control={control}
        name="dryWeight"
        label={t('harvest.modal.dryWeight')}
        unit={currentUnit}
        error={
          errors.dryWeight?.message ? t(errors.dryWeight.message) : undefined
        }
        testID="dry-weight-input"
        accessibilityHint={t('harvest.accessibility.dryWeightInput')}
      />

      <WeightInput
        control={control}
        name="trimmingsWeight"
        label={t('harvest.modal.trimmingsWeight')}
        unit={currentUnit}
        error={
          errors.trimmingsWeight?.message
            ? t(errors.trimmingsWeight.message)
            : undefined
        }
        testID="trimmings-weight-input"
        accessibilityHint={t('harvest.accessibility.trimmingsWeightInput')}
      />
    </>
  );
}

/**
 * Notes input field
 */
function NotesField({
  control,
  t,
}: {
  control: any;
  t: (key: string) => string;
}) {
  return (
    <Controller
      control={control}
      name="notes"
      render={({ field: { onChange, onBlur, value } }) => (
        <Input
          label={t('harvest.modal.notes')}
          placeholder={t('harvest.modal.notesPlaceholder')}
          multiline
          numberOfLines={4}
          onBlur={onBlur}
          onChangeText={onChange}
          value={value}
          testID="notes-input"
          accessibilityLabel={t('harvest.accessibility.notesInput')}
          accessibilityHint={t('harvest.accessibility.notesHint')}
        />
      )}
    />
  );
}

/**
 * Photo capture section with PhotoCapture component
 */
function PhotoSection({
  photos,
  onAddPhoto,
  t,
}: {
  photos: string[];
  onAddPhoto: (variants: any) => void;
  t: (key: string) => string;
}) {
  return (
    <View className="mt-4">
      <Text className="mb-2 text-base text-neutral-700 dark:text-neutral-300">
        {t('harvest.modal.photos')} ({photos.length})
      </Text>
      <PhotoCapture
        onPhotoCaptured={onAddPhoto}
        onError={(error) => {
          console.warn('[HarvestModal] Photo capture error:', error);
          showMessage({
            message: t('harvest.photo.errors.capture_failed'),
            type: 'warning',
          });
        }}
        buttonText={t('harvest.photo.actions.add_photo')}
      />
    </View>
  );
}

/**
 * Action buttons (submit/cancel)
 */
function ActionButtons({
  isSubmitting,
  onCancel,
  onSubmit,
  t,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  t: (key: string) => string;
}) {
  return (
    <View className="border-t border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900">
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t('harvest.modal.cancel')}
            variant="outline"
            onPress={onCancel}
            disabled={isSubmitting}
            testID="cancel-button"
            accessibilityLabel={t('harvest.accessibility.cancelButton')}
            accessibilityHint={t('harvest.accessibility.cancelHint')}
          />
        </View>
        <View className="flex-1">
          <Button
            label={
              isSubmitting
                ? t('harvest.modal.submitting')
                : t('harvest.modal.submit')
            }
            onPress={onSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
            testID="submit-button"
            accessibilityLabel={t('harvest.accessibility.submitButton')}
            accessibilityHint={t('harvest.accessibility.submitHint')}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Queue photo uploads to Supabase Storage
 */
async function queuePhotoUploads(
  photoVariants: PhotoVariants[],
  harvestId: string
): Promise<void> {
  if (photoVariants.length === 0) return;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Queue all photo variants for background upload
      for (const variants of photoVariants) {
        await enqueueHarvestPhotos(variants, user.id, harvestId);
      }
      console.log(
        `[HarvestModal] Queued ${photoVariants.length} photos for upload`
      );
    } else {
      console.warn(
        '[HarvestModal] No user session, skipping photo upload queue'
      );
    }
  } catch (queueError) {
    // Don't fail the harvest creation if queueing fails
    console.error('[HarvestModal] Failed to queue photo uploads:', queueError);
  }
}

/**
 * Custom hook for form submission logic
 */
function useHandleSubmit({
  plantId,
  photoUris,
  photoVariants,
  setIsSubmitting,
  onSubmit,
  onCancel,
  t,
}: {
  plantId: string;
  photoUris: string[];
  photoVariants: PhotoVariants[];
  setIsSubmitting: (value: boolean) => void;
  onSubmit: ((harvest: any) => void) | undefined;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  return async (data: HarvestFormData) => {
    setIsSubmitting(true);

    try {
      const parsedData = parseHarvestFormData(data);

      const input: CreateHarvestInput = {
        plantId,
        wetWeightG: parsedData.wetWeightG,
        dryWeightG: parsedData.dryWeightG,
        trimmingsWeightG: parsedData.trimmingsWeightG,
        notes: parsedData.notes,
        photos: photoUris,
      };

      const result = await createHarvest(input);

      if (result.success && result.harvest) {
        // Queue photo uploads to Supabase Storage after local harvest creation
        await queuePhotoUploads(photoVariants, result.harvest.id);

        showMessage({
          message: t('harvest.success.created'),
          type: 'success',
        });
        onSubmit?.(result.harvest);
        onCancel();
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[HarvestModal] Submit error:', error);
      showMessage({
        message: t('harvest.error.createFailed'),
        type: 'danger',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
}
