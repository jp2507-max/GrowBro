import type { DateTime } from 'luxon';
import React from 'react';
import { Controller } from 'react-hook-form';

import { useScheduleForm } from '@/components/calendar/use-schedule-form';
import { Button, Input, Select, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import type { WeekDay } from '@/lib/rrule/generator';
import type { Series } from '@/types/calendar';

type RecurrencePattern = 'daily' | 'weekly';

type ScheduleFormProps = {
  editingSeries?: Series;
  selectedDate?: DateTime;
  timezone: string;
  onSave?: () => void;
  onCancel: () => void;
};

const RECURRENCE_OPTIONS: { label: string; value: RecurrencePattern }[] = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
];

const WEEKDAY_OPTIONS: { label: string; value: WeekDay }[] = [
  { label: 'Mon', value: 'MO' },
  { label: 'Tue', value: 'TU' },
  { label: 'Wed', value: 'WE' },
  { label: 'Thu', value: 'TH' },
  { label: 'Fri', value: 'FR' },
  { label: 'Sat', value: 'SA' },
  { label: 'Sun', value: 'SU' },
];

const INTERVAL_OPTIONS = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '7', value: 7 },
  { label: '14', value: 14 },
];

function WeekdaySelector({
  selected,
  onChange,
}: {
  selected: WeekDay[];
  onChange: (weekdays: WeekDay[]) => void;
}): React.ReactElement {
  const handleToggle = (day: WeekDay) => {
    const updated = selected.includes(day)
      ? selected.filter((d) => d !== day)
      : [...selected, day];
    onChange(updated);
  };

  return (
    <View className="flex-row flex-wrap gap-2">
      {WEEKDAY_OPTIONS.map((opt) => (
        <Button
          key={opt.value}
          variant={selected.includes(opt.value) ? 'default' : 'outline'}
          size="sm"
          label={opt.label}
          onPress={() => handleToggle(opt.value)}
          testID={`weekday-${opt.value}`}
        />
      ))}
    </View>
  );
}

const LABELS = {
  title: translate('calendar.schedule_editor.title_label' as TxKeyPath),
  titlePlaceholder: translate(
    'calendar.schedule_editor.title_placeholder' as TxKeyPath
  ),
  recurrence: translate(
    'calendar.schedule_editor.recurrence_label' as TxKeyPath
  ),
  interval: translate('calendar.schedule_editor.interval_label' as TxKeyPath),
  weekdays: translate('calendar.schedule_editor.weekdays_label' as TxKeyPath),
  save: translate('calendar.schedule_editor.save' as TxKeyPath),
  cancel: translate('calendar.schedule_editor.cancel' as TxKeyPath),
};

export function ScheduleForm(props: ScheduleFormProps): React.ReactElement {
  const {
    control,
    handleSubmit,
    formState,
    recurrencePattern,
    onSubmit,
    handleCancel,
  } = useScheduleForm(props);

  return (
    <View className="gap-4 px-4 py-2">
      <View className="gap-1">
        <Text className="text-sm font-medium text-text-secondary">
          {LABELS.title}
        </Text>
        <Controller
          control={control}
          name="title"
          rules={{ required: true }}
          render={({ field: { onChange, value } }) => (
            <Input
              value={value}
              onChangeText={onChange}
              placeholder={LABELS.titlePlaceholder}
              testID="schedule-title-input"
            />
          )}
        />
      </View>

      <View className="gap-1">
        <Text className="text-sm font-medium text-text-secondary">
          {LABELS.recurrence}
        </Text>
        <Controller
          control={control}
          name="recurrencePattern"
          render={({ field: { onChange, value } }) => (
            <Select
              value={value}
              onSelect={(v) => onChange(v as RecurrencePattern)}
              options={RECURRENCE_OPTIONS}
              testID="schedule-recurrence-select"
            />
          )}
        />
      </View>

      <View className="gap-1">
        <Text className="text-sm font-medium text-text-secondary">
          {LABELS.interval}
        </Text>
        <Controller
          control={control}
          name="interval"
          render={({ field: { onChange, value } }) => (
            <Select
              value={value}
              onSelect={(v) => onChange(v as number)}
              options={INTERVAL_OPTIONS}
              testID="schedule-interval-select"
            />
          )}
        />
      </View>

      {recurrencePattern === 'weekly' && (
        <View className="gap-1">
          <Text className="text-sm font-medium text-text-secondary">
            {LABELS.weekdays}
          </Text>
          <Controller
            control={control}
            name="weekdays"
            render={({ field: { onChange, value } }) => (
              <WeekdaySelector selected={value} onChange={onChange} />
            )}
          />
        </View>
      )}

      <View className="mt-4 flex-row gap-3">
        <Button
          variant="outline"
          label={LABELS.cancel}
          onPress={handleCancel}
          className="flex-1"
          testID="schedule-cancel-button"
        />
        <Button
          variant="default"
          label={LABELS.save}
          onPress={handleSubmit(onSubmit)}
          disabled={!formState.isValid || formState.isSubmitting}
          className="flex-1"
          testID="schedule-save-button"
        />
      </View>
    </View>
  );
}
