import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import type { OptionType } from '@/components/ui';
import { Button, Input, Select, Text, View } from '@/components/ui';
import { translate } from '@/lib';

const eventSchema = z.object({
  type: z.enum(['fill', 'dilute', 'nutrient_add', 'ph_adjust', 'flush']),
  phDelta: z.number().min(-3).max(3).optional(),
  ecDelta: z.number().min(-5).max(5).optional(),
  note: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

type Props = {
  reservoirId: string;
  onSubmit: (data: EventFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  testID?: string;
};

const eventTypeOptions: OptionType[] = [
  { value: 'fill', label: 'Refill' },
  { value: 'dilute', label: 'Dilute' },
  { value: 'nutrient_add', label: 'Add Nutrients' },
  { value: 'ph_adjust', label: 'pH Adjustment' },
  { value: 'flush', label: 'Flush' },
];

function PHDeltaField({ control, errors }: any) {
  return (
    <>
      <Controller
        control={control}
        name="phDelta"
        render={({ field: { onChange, value } }) => (
          <Input
            label={translate('nutrient.event.phDelta')}
            placeholder="0.0"
            keyboardType="decimal-pad"
            value={value?.toString() ?? ''}
            onChangeText={(text) => onChange(parseFloat(text) || 0)}
            error={errors.phDelta?.message}
            testID="ph-delta-input"
          />
        )}
      />
      <Text className="text-xs text-neutral-500">
        {translate('nutrient.event.phDeltaHint')}
      </Text>
    </>
  );
}

function ECDeltaField({ control, errors }: any) {
  return (
    <>
      <Controller
        control={control}
        name="ecDelta"
        render={({ field: { onChange, value } }) => (
          <Input
            label={translate('nutrient.event.ecDelta')}
            placeholder="0.0"
            keyboardType="decimal-pad"
            value={value?.toString() ?? ''}
            onChangeText={(text) => onChange(parseFloat(text) || 0)}
            error={errors.ecDelta?.message}
            testID="ec-delta-input"
          />
        )}
      />
      <Text className="text-xs text-neutral-500">
        {translate('nutrient.event.ecDeltaHint')}
      </Text>
    </>
  );
}

function FormFields({ control, errors }: any) {
  return (
    <>
      <Controller
        control={control}
        name="type"
        render={({ field: { onChange, value } }) => (
          <Select
            label={translate('nutrient.event.type')}
            options={eventTypeOptions}
            value={value}
            onSelect={(v) => onChange(String(v))}
            testID="type-select"
          />
        )}
      />

      <PHDeltaField control={control} errors={errors} />
      <ECDeltaField control={control} errors={errors} />

      <Controller
        control={control}
        name="note"
        render={({ field: { onChange, value } }) => (
          <Input
            label={translate('nutrient.event.note')}
            placeholder={translate('nutrient.event.notePlaceholder')}
            multiline
            numberOfLines={3}
            value={value ?? ''}
            onChangeText={onChange}
            testID="note-input"
          />
        )}
      />
    </>
  );
}

export function ReservoirEventForm({
  reservoirId: _reservoirId,
  onSubmit,
  onCancel,
  isSubmitting = false,
  testID,
}: Props): React.ReactElement {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      type: 'nutrient_add',
      phDelta: 0,
      ecDelta: 0,
      note: '',
    },
  });

  return (
    <View className="gap-4 p-4" testID={testID}>
      <Text className="text-lg font-semibold text-neutral-900">
        {translate('nutrient.event.logEvent')}
      </Text>

      <FormFields control={control} errors={errors} />

      <View className="mt-4 flex-row gap-3">
        <Button
          variant="outline"
          label={translate('settings.cancel')}
          onPress={onCancel}
          className="flex-1"
          testID="cancel-button"
        />
        <Button
          label={translate('settings.save_changes')}
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          disabled={isSubmitting}
          className="flex-1"
          testID="submit-button"
        />
      </View>
    </View>
  );
}
