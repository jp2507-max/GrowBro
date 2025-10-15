/**
 * Add Inventory Item Screen
 *
 * Modal form for creating new inventory items with comprehensive validation
 * using React Hook Form + Zod.
 *
 * Requirements: 1.2, 8.1
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { z } from 'zod';

import {
  Button,
  FocusAwareStatusBar,
  Input,
  Text,
  View,
} from '@/components/ui';
import { createInventoryItem } from '@/lib/inventory/inventory-item-service';
import type { InventoryCategory } from '@/types/inventory';

type FormFieldProps = {
  control: any;
  setValue: any;
  watch: any;
};

function FormHeader({ onCancel }: { onCancel: () => void }) {
  const { t } = useTranslation();

  return (
    <View className="border-b border-neutral-200 bg-white px-4 pb-3 pt-4 dark:border-charcoal-700 dark:bg-charcoal-900">
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-charcoal-950 dark:text-white">
          {t('inventory.add_item')}
        </Text>
        <Button
          onPress={onCancel}
          variant="ghost"
          size="sm"
          testID="cancel-button"
        >
          {t('common.cancel')}
        </Button>
      </View>
    </View>
  );
}

function NameField({
  setValue,
  errors,
  isSubmitting,
}: Pick<FormFieldProps, 'setValue' | 'errors'> & { isSubmitting: boolean }) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.name')}
      </Text>
      <Input
        placeholder={t('inventory.form.name_placeholder')}
        onChangeText={(text) => setValue('name', text)}
        editable={!isSubmitting}
        testID="name-input"
      />
      {errors.name && (
        <Text className="mt-1 text-xs text-danger-600 dark:text-danger-400">
          {errors.name.message}
        </Text>
      )}
    </View>
  );
}

function CategoryField({
  setValue,
  watch,
}: Pick<FormFieldProps, 'setValue' | 'watch'>) {
  const { t } = useTranslation();
  const selectedCategory = watch('category');

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.category')}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <Button
            key={category}
            onPress={() => setValue('category', category)}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            testID={`category-${category}`}
          >
            {category}
          </Button>
        ))}
      </View>
    </View>
  );
}

function UnitField({
  setValue,
  errors,
  isSubmitting,
}: Pick<FormFieldProps, 'setValue' | 'errors'> & { isSubmitting: boolean }) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.unit')}
      </Text>
      <Input
        placeholder={t('inventory.form.unit_placeholder')}
        onChangeText={(text) => setValue('unitOfMeasure', text)}
        editable={!isSubmitting}
        testID="unit-input"
      />
      {errors.unitOfMeasure && (
        <Text className="mt-1 text-xs text-danger-600 dark:text-danger-400">
          {errors.unitOfMeasure.message}
        </Text>
      )}
    </View>
  );
}

function TrackingModeField({
  setValue,
  watch,
}: Pick<FormFieldProps, 'setValue' | 'watch'>) {
  const { t } = useTranslation();
  const selectedTrackingMode = watch('trackingMode');

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.tracking_mode')}
      </Text>
      <View className="flex-row gap-2">
        {TRACKING_MODES.map((mode) => (
          <Button
            key={mode}
            onPress={() => setValue('trackingMode', mode)}
            variant={selectedTrackingMode === mode ? 'default' : 'outline'}
            size="sm"
            disabled={false}
            testID={`tracking-mode-${mode}`}
          >
            {t(`inventory.form.tracking_${mode}`)}
          </Button>
        ))}
      </View>
    </View>
  );
}

function MinStockField({
  setValue,
  errors,
  isSubmitting,
}: Pick<FormFieldProps, 'setValue' | 'errors'> & { isSubmitting: boolean }) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.min_stock')}
      </Text>
      <Input
        placeholder="0"
        keyboardType="numeric"
        onChangeText={(text) => setValue('minStock', Number(text) || 0)}
        editable={!isSubmitting}
        testID="min-stock-input"
      />
      {errors.minStock && (
        <Text className="mt-1 text-xs text-danger-600 dark:text-danger-400">
          {errors.minStock.message}
        </Text>
      )}
    </View>
  );
}

function ReorderMultipleField({
  setValue,
  errors,
  isSubmitting,
}: Pick<FormFieldProps, 'setValue' | 'errors'> & { isSubmitting: boolean }) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.reorder_multiple')}
      </Text>
      <Input
        placeholder="1"
        keyboardType="numeric"
        onChangeText={(text) => setValue('reorderMultiple', Number(text) || 1)}
        editable={!isSubmitting}
        testID="reorder-multiple-input"
      />
      {errors.reorderMultiple && (
        <Text className="mt-1 text-xs text-danger-600 dark:text-danger-400">
          {errors.reorderMultiple.message}
        </Text>
      )}
    </View>
  );
}

function LeadTimeField({
  setValue,
  isSubmitting,
}: Pick<FormFieldProps, 'setValue'> & { isSubmitting: boolean }) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.lead_time_days')} ({t('common.optional')})
      </Text>
      <Input
        placeholder="0"
        keyboardType="numeric"
        onChangeText={(text) =>
          setValue('leadTimeDays', text ? Number(text) : undefined)
        }
        editable={!isSubmitting}
        testID="lead-time-input"
      />
    </View>
  );
}

const CATEGORIES: InventoryCategory[] = [
  'Nutrients',
  'Seeds',
  'Growing Media',
  'Tools',
  'Containers',
  'Amendments',
];

const TRACKING_MODES = ['simple', 'batched'] as const;

const addItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  category: z.enum([
    'Nutrients',
    'Seeds',
    'Growing Media',
    'Tools',
    'Containers',
    'Amendments',
  ]),
  unitOfMeasure: z.string().min(1, 'Unit is required').max(20),
  trackingMode: z.enum(['simple', 'batched']),
  isConsumable: z.boolean(),
  minStock: z.number().min(0, 'Minimum stock must be positive'),
  reorderMultiple: z.number().min(1, 'Reorder multiple must be at least 1'),
  leadTimeDays: z.number().min(0).optional(),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
});

type AddItemFormData = z.infer<typeof addItemSchema>;

export default function AddInventoryItemScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AddItemFormData>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      name: '',
      category: 'Nutrients',
      unitOfMeasure: '',
      trackingMode: 'simple',
      isConsumable: true,
      minStock: 0,
      reorderMultiple: 1,
      leadTimeDays: undefined,
      sku: '',
      barcode: '',
    },
  });

  const onSubmit = async (data: AddItemFormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const result = await createInventoryItem({
        name: data.name,
        category: data.category,
        unitOfMeasure: data.unitOfMeasure,
        trackingMode: data.trackingMode,
        isConsumable: data.isConsumable,
        minStock: data.minStock,
        reorderMultiple: data.reorderMultiple,
        leadTimeDays: data.leadTimeDays,
        sku: data.sku || undefined,
        barcode: data.barcode || undefined,
      });

      if (result.success) {
        router.back();
      } else {
        setError(result.error || 'Failed to create item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1" testID="add-inventory-item-screen">
      <FocusAwareStatusBar />
      <FormHeader onCancel={() => router.back()} />

      <ScrollView className="flex-1 p-4">
        {/* Error Message */}
        {error && (
          <View className="mb-4 rounded-lg bg-danger-50 p-3 dark:bg-danger-900/20">
            <Text className="text-sm text-danger-700 dark:text-danger-400">
              {error}
            </Text>
          </View>
        )}

        <NameField
          setValue={setValue}
          errors={errors}
          isSubmitting={isSubmitting}
        />
        <CategoryField setValue={setValue} watch={watch} errors={errors} />
        <UnitField
          setValue={setValue}
          errors={errors}
          isSubmitting={isSubmitting}
        />
        <TrackingModeField setValue={setValue} watch={watch} />
        <MinStockField
          setValue={setValue}
          errors={errors}
          isSubmitting={isSubmitting}
        />
        <ReorderMultipleField
          setValue={setValue}
          errors={errors}
          isSubmitting={isSubmitting}
        />
        <LeadTimeField setValue={setValue} isSubmitting={isSubmitting} />

        {/* Submit Button */}
        <Button
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="mt-6"
          testID="submit-button"
        >
          {isSubmitting ? t('common.saving') : t('inventory.form.submit')}
        </Button>
      </ScrollView>
    </View>
  );
}
