/**
 * Harvest Form Component
 *
 * Extracted form logic from HarvestModal for use in Expo Router modal routes.
 * Contains all form inputs, validation, and submission logic.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import {
  type Control,
  Controller,
  type FieldErrors,
  useForm,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { PhotoCapture } from '@/components/photo-capture';
import { Button, Input, Text, View } from '@/components/ui';
import {
  type HarvestFormData,
  harvestFormSchema,
  parseHarvestFormData,
} from '@/lib/harvest/harvest-form-schema';
import {
  createHarvest,
  type CreateHarvestInput,
} from '@/lib/harvest/harvest-service';
import type { WeightUnit } from '@/lib/harvest/weight-conversion';
import { toDisplayValue } from '@/lib/harvest/weight-conversion';
import { supabase } from '@/lib/supabase';
import { enqueueHarvestPhotos } from '@/lib/uploads/harvest-photo-queue';
import type { ChartDataPoint } from '@/types/harvest';
import type { PhotoVariants } from '@/types/photo-storage';

import { HarvestChartContainer } from './harvest-chart-container';

export type HarvestFormSubmitData = CreateHarvestInput;

export type HarvestFormProps = {
  /** Plant ID to link harvest to */
  plantId: string;

  /** Initial data for editing existing harvest */
  initialData?: Partial<CreateHarvestInput>;

  /** Historical harvest data for chart display */
  historicalData?: ChartDataPoint[];

  /** Called on successful save */
  onSubmit?: (harvest: CreateHarvestInput) => void;

  /** Called on cancel */
  onCancel: () => void;
};

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

const touchTargetStyles = StyleSheet.create({
  minimum: {
    minHeight: 44,
    minWidth: 44,
  },
});

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
      <Text className="mr-3 text-base text-charcoal-900 dark:text-neutral-100">
        {t('harvest.modal.unit_toggle')}:
      </Text>
      <View className="flex-row overflow-hidden rounded-lg border border-neutral-300 dark:border-neutral-700">
        <Pressable
          onPress={() => onChange('g')}
          className={`px-6 py-3 ${unit === 'g' ? 'bg-primary-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}
          accessibilityRole="button"
          accessibilityLabel={t('harvest.units.grams_long')}
          accessibilityHint={t('harvest.accessibility.unit_toggle')}
          accessibilityState={{ selected: unit === 'g' }}
          testID={`${testID}-grams`}
          style={touchTargetStyles.minimum}
        >
          <Text
            className={`text-sm font-medium ${unit === 'g' ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'}`}
          >
            {t('harvest.units.grams_long')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onChange('oz')}
          className={`px-6 py-3 ${unit === 'oz' ? 'bg-primary-600' : 'bg-neutral-100 dark:bg-neutral-800'}`}
          accessibilityRole="button"
          accessibilityLabel={t('harvest.units.ounces_long')}
          accessibilityHint={t('harvest.accessibility.unit_toggle')}
          accessibilityState={{ selected: unit === 'oz' }}
          testID={`${testID}-ounces`}
          style={touchTargetStyles.minimum}
        >
          <Text
            className={`text-sm font-medium ${unit === 'oz' ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'}`}
          >
            {t('harvest.units.ounces_long')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function WeightInput({
  control,
  name,
  label,
  unit,
  error,
  testID,
  accessibilityHint,
}: {
  control: Control<HarvestFormData>;
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
          accessibilityLabel={t('accessibility.modal.input_label', { label })}
          accessibilityHint={accessibilityHint}
        />
      )}
    />
  );
}

function WeightInputs({
  control,
  currentUnit,
  errors,
  t,
}: {
  control: Control<HarvestFormData>;
  currentUnit: WeightUnit;
  errors: FieldErrors<HarvestFormData>;
  t: (key: string) => string;
}) {
  return (
    <>
      <WeightInput
        control={control}
        name="wetWeight"
        label={t('harvest.modal.wet_weight')}
        unit={currentUnit}
        error={
          errors.wetWeight?.message ? t(errors.wetWeight.message) : undefined
        }
        testID="wet-weight-input"
        accessibilityHint={t('harvest.accessibility.wet_weight_input')}
      />

      <WeightInput
        control={control}
        name="dryWeight"
        label={t('harvest.modal.dry_weight')}
        unit={currentUnit}
        error={
          errors.dryWeight?.message ? t(errors.dryWeight.message) : undefined
        }
        testID="dry-weight-input"
        accessibilityHint={t('harvest.accessibility.dry_weight_input')}
      />

      <WeightInput
        control={control}
        name="trimmingsWeight"
        label={t('harvest.modal.trimmings_weight')}
        unit={currentUnit}
        error={
          errors.trimmingsWeight?.message
            ? t(errors.trimmingsWeight.message)
            : undefined
        }
        testID="trimmings-weight-input"
        accessibilityHint={t('harvest.accessibility.trimmings_weight_input')}
      />
    </>
  );
}

function NotesField({
  control,
  t,
}: {
  control: Control<HarvestFormData>;
  t: (key: string) => string;
}) {
  return (
    <Controller
      control={control}
      name="notes"
      render={({ field: { onChange, onBlur, value } }) => (
        <Input
          label={t('harvest.modal.notes')}
          placeholder={t('harvest.modal.notes_placeholder')}
          multiline
          numberOfLines={4}
          onBlur={onBlur}
          onChangeText={onChange}
          value={value}
          testID="notes-input"
          accessibilityLabel={t('harvest.accessibility.notes_input')}
          accessibilityHint={t('harvest.accessibility.notes_hint')}
        />
      )}
    />
  );
}

function PhotoSection({
  photoVariants,
  onAddPhoto,
  t,
}: {
  photoVariants: PhotoVariants[];
  onAddPhoto: (variant: PhotoVariants) => void;
  t: (key: string) => string;
}) {
  return (
    <View className="mt-4">
      <Text className="mb-2 text-base text-neutral-600 dark:text-neutral-400">
        {t('harvest.modal.photos')} ({photoVariants.length})
      </Text>
      <PhotoCapture
        onPhotoCaptured={onAddPhoto}
        onError={(error) => {
          console.warn('[HarvestForm] Photo capture error:', error);
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
    <View className="border-t border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-charcoal-900">
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t('harvest.modal.cancel')}
            variant="outline"
            onPress={onCancel}
            disabled={isSubmitting}
            testID="cancel-button"
            accessibilityLabel={t('harvest.accessibility.cancel_button')}
            accessibilityHint={t('harvest.accessibility.cancel_hint')}
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
            accessibilityLabel={t('harvest.accessibility.submit_button')}
            accessibilityHint={t('harvest.accessibility.submit_hint')}
          />
        </View>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

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
      for (const variants of photoVariants) {
        await enqueueHarvestPhotos(variants, user.id, harvestId);
      }
      console.log(
        `[HarvestForm] Queued ${photoVariants.length} photos for upload`
      );
    } else {
      console.warn(
        '[HarvestForm] No user session, skipping photo upload queue'
      );
    }
  } catch (queueError) {
    console.error('[HarvestForm] Failed to queue photo uploads:', queueError);
  }
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function -- Complex form with multiple handlers, unit conversion, photo management
export function HarvestForm({
  plantId,
  initialData,
  historicalData,
  onSubmit,
  onCancel,
}: HarvestFormProps): React.ReactElement {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoVariants, setPhotoVariants] = useState<PhotoVariants[]>([]);
  // Photo URIs state is maintained for future use (e.g., photo preview/deletion)
  const [, setPhotoUris] = useState<string[]>(
    initialData?.photos?.map((photo) => photo.localUri) || []
  );

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<HarvestFormData>({
    resolver: zodResolver(harvestFormSchema),
    defaultValues: getDefaultValues(initialData),
  });

  const currentUnit = watch('unit') as WeightUnit;

  const handleAddPhoto = React.useCallback(
    (variant: PhotoVariants) => {
      setPhotoVariants((prev) => [...prev, variant]);
      const newUris = [variant.original, variant.resized, variant.thumbnail];
      setPhotoUris((prev) => [...prev, ...newUris]);
      showMessage({
        message: t('harvest.photo.success'),
        type: 'success',
      });
    },
    [t]
  );

  const handleUnitChange = React.useCallback(
    (newUnit: WeightUnit) => {
      if (newUnit === currentUnit) return;

      const currentValues = getValues();
      const parsed = parseHarvestFormData({
        ...currentValues,
        unit: currentUnit,
      });

      const applyConvertedValue = (
        field: 'wetWeight' | 'dryWeight' | 'trimmingsWeight',
        gramsValue: number | null
      ) => {
        if (gramsValue === null || gramsValue === undefined) {
          setValue(field, '', { shouldDirty: true, shouldValidate: false });
          return;
        }

        const converted = toDisplayValue(gramsValue, newUnit);
        const formatted =
          newUnit === 'g'
            ? Math.round(converted).toString()
            : parseFloat(converted.toFixed(2)).toString();

        setValue(field, formatted, {
          shouldDirty: true,
          shouldValidate: false,
        });
      };

      applyConvertedValue('wetWeight', parsed.wetWeightG);
      applyConvertedValue('dryWeight', parsed.dryWeightG);
      applyConvertedValue('trimmingsWeight', parsed.trimmingsWeightG);

      setValue('unit', newUnit, { shouldDirty: true, shouldValidate: false });
    },
    [currentUnit, getValues, setValue]
  );

  const onSubmitForm = React.useCallback(
    async (data: HarvestFormData) => {
      setIsSubmitting(true);

      try {
        const parsedData = parseHarvestFormData(data);

        const photosForHarvest = photoVariants.flatMap((variants) => [
          { variant: 'original', localUri: variants.original },
          { variant: 'resized', localUri: variants.resized },
          { variant: 'thumbnail', localUri: variants.thumbnail },
        ]);

        const input: CreateHarvestInput = {
          plantId,
          wetWeightG: parsedData.wetWeightG ?? null,
          dryWeightG: parsedData.dryWeightG ?? null,
          trimmingsWeightG: parsedData.trimmingsWeightG ?? null,
          notes: parsedData.notes,
          photos: photosForHarvest,
        };

        const result = await createHarvest(input);

        if (result.success && result.harvest) {
          await queuePhotoUploads(photoVariants, result.harvest.id);

          showMessage({
            message: t('harvest.success.created'),
            type: 'success',
          });

          const harvestInput: CreateHarvestInput = {
            plantId: result.harvest.plantId,
            wetWeightG: result.harvest.wetWeightG ?? null,
            dryWeightG: result.harvest.dryWeightG ?? null,
            trimmingsWeightG: result.harvest.trimmingsWeightG ?? null,
            notes: result.harvest.notes,
            photos: result.harvest.photos,
          };
          onSubmit?.(harvestInput);
          onCancel();
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (error) {
        console.error('[HarvestForm] Submit error:', error);
        showMessage({
          message: t('harvest.error.create_failed'),
          type: 'danger',
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [plantId, photoVariants, t, onSubmit, onCancel]
  );

  return (
    <>
      <ScrollView className="flex-1 p-4">
        {/* Weight Chart - Show if historical data exists */}
        {historicalData && historicalData.length > 0 && (
          <View className="mb-6">
            <HarvestChartContainer
              data={historicalData}
              plantId={plantId}
              testID="harvest-form-chart"
            />
          </View>
        )}

        <UnitToggle
          unit={currentUnit}
          onChange={handleUnitChange}
          testID="unit-toggle"
        />
        <WeightInputs
          control={control}
          currentUnit={currentUnit}
          errors={errors}
          t={t}
        />
        <NotesField control={control} t={t} />
        <PhotoSection
          photoVariants={photoVariants}
          onAddPhoto={handleAddPhoto}
          t={t}
        />
      </ScrollView>
      <ActionButtons
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        onSubmit={handleSubmit(onSubmitForm)}
        t={t}
      />
    </>
  );
}
