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
import {
  type Control,
  Controller,
  type FieldErrors,
  useForm,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { z } from 'zod';

import {
  Button,
  ControlledInput,
  FocusAwareStatusBar,
  Input,
  Text,
  View,
} from '@/components/ui';
import { createInventoryItem } from '@/lib/inventory/inventory-item-service';
import type { InventoryCategory } from '@/types/inventory';

// Form schema and type
const useAddItemSchema = () => {
  const { t, i18n } = useTranslation();
  return React.useMemo(
    () =>
      z.object({
        name: z
          .string()
          .min(1, t('inventory.form.validation.nameRequired'))
          .max(100, t('inventory.form.validation.nameMaxLength')),
        category: z.enum([
          'Nutrients',
          'Seeds',
          'Growing Media',
          'Tools',
          'Containers',
          'Amendments',
        ]),
        unitOfMeasure: z
          .string()
          .min(1, t('inventory.form.validation.unitRequired'))
          .max(20, t('inventory.form.validation.unitMaxLength')),
        trackingMode: z.enum(['simple', 'batched']),
        isConsumable: z.boolean(),
        minStock: z
          .number()
          .min(0, t('inventory.form.validation.minStockPositive')),
        reorderMultiple: z
          .number()
          .min(1, t('inventory.form.validation.reorderMultipleMin')),
        leadTimeDays: z.number().min(0).optional(),
        sku: z.string().max(50).optional(),
        barcode: z.string().max(50).optional(),
      }),
    [i18n.language, t]
  );
};

type AddItemFormData = z.infer<ReturnType<typeof useAddItemSchema>>;

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
  control,
  errors: _errors,
  isSubmitting,
  serverValidationErrors: _serverValidationErrors,
}: {
  control: Control<AddItemFormData>;
  errors: FieldErrors<AddItemFormData>;
  isSubmitting: boolean;
  serverValidationErrors: Record<string, string>;
}) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.name')}
      </Text>
      <ControlledInput
        control={control}
        name="name"
        placeholder={t('inventory.form.name_placeholder')}
        editable={!isSubmitting}
        testID="name-input"
      />
    </View>
  );
}

function CategoryField({ control }: { control: Control<AddItemFormData> }) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.category')}
      </Text>
      <Controller
        control={control}
        name="category"
        render={({ field: { onChange, value } }) => (
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                onPress={() => onChange(category)}
                variant={value === category ? 'default' : 'outline'}
                size="sm"
                testID={`category-${category}`}
              >
                {category}
              </Button>
            ))}
          </View>
        )}
      />
    </View>
  );
}

function UnitField({
  control,
  errors: _errors,
  isSubmitting,
  serverValidationErrors: _serverValidationErrors,
}: {
  control: Control<AddItemFormData>;
  errors: FieldErrors<AddItemFormData>;
  isSubmitting: boolean;
  serverValidationErrors: Record<string, string>;
}) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.unit')}
      </Text>
      <ControlledInput
        control={control}
        name="unitOfMeasure"
        placeholder={t('inventory.form.unit_placeholder')}
        editable={!isSubmitting}
        testID="unit-input"
      />
    </View>
  );
}

function TrackingModeField({ control }: { control: Control<AddItemFormData> }) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.tracking_mode')}
      </Text>
      <Controller
        control={control}
        name="trackingMode"
        render={({ field: { onChange, value } }) => (
          <View className="flex-row gap-2">
            {TRACKING_MODES.map((mode) => (
              <Button
                key={mode}
                onPress={() => onChange(mode)}
                variant={value === mode ? 'default' : 'outline'}
                size="sm"
                disabled={false}
                testID={`tracking-mode-${mode}`}
              >
                {t(`inventory.form.tracking_${mode}`)}
              </Button>
            ))}
          </View>
        )}
      />
    </View>
  );
}

function MinStockField({
  control,
  errors: _errors,
  isSubmitting,
}: {
  control: Control<AddItemFormData>;
  errors: FieldErrors<AddItemFormData>;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.min_stock')}
      </Text>
      <Controller
        control={control}
        name="minStock"
        render={({ field: { onChange, onBlur, value, ref }, fieldState }) => (
          <Input
            ref={ref}
            value={value?.toString() || ''}
            placeholder="0"
            keyboardType="numeric"
            onChangeText={(text) => {
              if (text === '') {
                onChange(0); // Allow empty to be converted to 0, validation will handle required
              } else {
                const numValue = Number(text);
                if (!isNaN(numValue)) {
                  onChange(numValue);
                }
                // If invalid, don't call onChange - let validation catch it
              }
            }}
            onBlur={onBlur}
            editable={!isSubmitting}
            testID="min-stock-input"
            errorTx={fieldState.error?.message}
          />
        )}
      />
    </View>
  );
}

function ReorderMultipleField({
  control,
  errors: _errors,
  isSubmitting,
}: {
  control: Control<AddItemFormData>;
  errors: FieldErrors<AddItemFormData>;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.reorder_multiple')}
      </Text>
      <Controller
        control={control}
        name="reorderMultiple"
        render={({ field: { onChange, onBlur, value, ref }, fieldState }) => (
          <Input
            ref={ref}
            value={value?.toString() || ''}
            placeholder="1"
            keyboardType="numeric"
            onChangeText={(text) => {
              if (text === '') {
                onChange(1); // Allow empty to be converted to 1, validation will handle required
              } else {
                const numValue = Number(text);
                if (!isNaN(numValue)) {
                  onChange(numValue);
                }
                // If invalid, don't call onChange - let validation catch it
              }
            }}
            onBlur={onBlur}
            editable={!isSubmitting}
            testID="reorder-multiple-input"
            errorTx={fieldState.error?.message}
          />
        )}
      />
    </View>
  );
}

function LeadTimeField({
  control,
  isSubmitting,
}: {
  control: Control<AddItemFormData>;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.lead_time_days')} ({t('common.optional')})
      </Text>
      <Controller
        control={control}
        name="leadTimeDays"
        render={({ field: { onChange, onBlur, value, ref }, fieldState }) => (
          <Input
            ref={ref}
            value={value?.toString() || ''}
            placeholder="0"
            keyboardType="numeric"
            onChangeText={(text) => {
              if (text === '') {
                onChange(undefined); // Allow empty for optional field
              } else {
                const numValue = Number(text);
                if (!isNaN(numValue)) {
                  onChange(numValue);
                }
                // If invalid, don't call onChange - let validation catch it
              }
            }}
            onBlur={onBlur}
            editable={!isSubmitting}
            testID="lead-time-input"
            errorTx={fieldState.error?.message}
          />
        )}
      />
    </View>
  );
}

function SkuField({
  control,
  isSubmitting,
  serverValidationErrors,
}: {
  control: Control<AddItemFormData>;
  isSubmitting: boolean;
  serverValidationErrors: Record<string, string>;
}) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.sku')} ({t('common.optional')})
      </Text>
      <Controller
        control={control}
        name="sku"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            value={value}
            placeholder={t('inventory.form.sku_placeholder')}
            onChangeText={onChange}
            onBlur={onBlur}
            editable={!isSubmitting}
            testID="sku-input"
          />
        )}
      />
      {serverValidationErrors.sku && (
        <Text className="mt-1 text-xs text-danger-600 dark:text-danger-400">
          {serverValidationErrors.sku}
        </Text>
      )}
    </View>
  );
}

function BarcodeField({
  control,
  isSubmitting,
}: {
  control: Control<AddItemFormData>;
  isSubmitting: boolean;
}) {
  const { t } = useTranslation();

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-medium text-charcoal-950 dark:text-white">
        {t('inventory.form.barcode')} ({t('common.optional')})
      </Text>
      <Controller
        control={control}
        name="barcode"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            value={value}
            placeholder={t('inventory.form.barcode_placeholder')}
            onChangeText={onChange}
            onBlur={onBlur}
            editable={!isSubmitting}
            testID="barcode-input"
          />
        )}
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

export default function AddInventoryItemScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [serverValidationErrors, setServerValidationErrors] = React.useState<
    Record<string, string>
  >({});

  const addItemSchema = useAddItemSchema();

  const {
    control,
    handleSubmit,
    formState: { errors },
    clearErrors,
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
      setServerValidationErrors({});

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
        // Handle validation errors by mapping them to specific form fields
        if (result.validationErrors && result.validationErrors.length > 0) {
          // Clear previous field errors
          clearErrors();

          // Map validation errors to server validation errors state
          const fieldErrors: Record<string, string> = {};
          result.validationErrors.forEach((validationError) => {
            fieldErrors[validationError.field] = validationError.message;
          });

          setServerValidationErrors(fieldErrors);

          // Only set global error if there are additional non-field errors
          if (result.error) {
            setError(result.error);
          }
        } else {
          // No validation errors, set global error
          setError(result.error || 'Failed to create item');
        }
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
          <View
            className="mb-4 rounded-lg bg-danger-50 p-3 dark:bg-danger-900/20"
            testID="global-error-container"
          >
            <Text className="text-sm text-danger-700 dark:text-danger-400">
              {error}
            </Text>
          </View>
        )}

        <NameField
          control={control}
          errors={errors}
          isSubmitting={isSubmitting}
          serverValidationErrors={serverValidationErrors}
        />
        <CategoryField control={control} />
        <UnitField
          control={control}
          errors={errors}
          isSubmitting={isSubmitting}
          serverValidationErrors={serverValidationErrors}
        />
        <TrackingModeField control={control} />
        <MinStockField
          control={control}
          errors={errors}
          isSubmitting={isSubmitting}
        />
        <ReorderMultipleField
          control={control}
          errors={errors}
          isSubmitting={isSubmitting}
        />
        <LeadTimeField control={control} isSubmitting={isSubmitting} />
        <SkuField
          control={control}
          isSubmitting={isSubmitting}
          serverValidationErrors={serverValidationErrors}
        />
        <BarcodeField control={control} isSubmitting={isSubmitting} />

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
