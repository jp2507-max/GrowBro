import type { DateTime } from 'luxon';
import React from 'react';
import { Controller } from 'react-hook-form';

import { useScheduleForm } from '@/components/calendar/use-schedule-form';
import { Button, Input, Select, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
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

function getRecurrenceOptions(): { label: string; value: RecurrencePattern }[] {
  return [
    {
      label: translate('calendar.recurrence.daily'),
      value: 'daily',
    },
    {
      label: translate('calendar.recurrence.weekly'),
      value: 'weekly',
    },
  ];
}

function getWeekdayOptions(): { label: string; value: WeekDay }[] {
  return [
    { label: translate('calendar.weekday.mon'), value: 'MO' },
    { label: translate('calendar.weekday.tue'), value: 'TU' },
    { label: translate('calendar.weekday.wed'), value: 'WE' },
    { label: translate('calendar.weekday.thu'), value: 'TH' },
    { label: translate('calendar.weekday.fri'), value: 'FR' },
    { label: translate('calendar.weekday.sat'), value: 'SA' },
    { label: translate('calendar.weekday.sun'), value: 'SU' },
  ];
}

const INTERVAL_OPTIONS = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '7', value: 7 },
  { label: '14', value: 14 },
];

function getLabels() {
  return {
    title: translate('calendar.schedule_editor.title_label'),
    titlePlaceholder: translate('calendar.schedule_editor.title_placeholder'),
    recurrence: translate('calendar.schedule_editor.recurrence_label'),
    interval: translate('calendar.schedule_editor.interval_label'),
    weekdays: translate('calendar.schedule_editor.weekdays_label'),
    save: translate('calendar.schedule_editor.save'),
    cancel: translate('calendar.schedule_editor.cancel'),
  };
}

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
      {getWeekdayOptions().map((opt) => (
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

export function ScheduleForm(props: ScheduleFormProps): React.ReactElement {
  const {
    control,
    handleSubmit,
    formState,
    recurrencePattern,
    onSubmit,
    handleCancel,
  } = useScheduleForm(props);

  const labels = getLabels();

  return (
    <View className="gap-4 px-4 py-2">
      <View className="gap-1">
        <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {labels.title}
        </Text>
        <Controller
          control={control}
          name="title"
          rules={{ required: true }}
          render={({ field: { onChange, value } }) => (
            <Input
              value={value}
              onChangeText={onChange}
              placeholder={labels.titlePlaceholder}
              testID="schedule-title-input"
            />
          )}
        />
      </View>

      <View className="gap-1">
        <Text className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
          {labels.recurrence}
        </Text>
        <Controller
          control={control}
          name="recurrencePattern"
          render={({ field: { onChange, value } }) => (
            <Select
              value={value}
              onSelect={(v) => onChange(v as RecurrencePattern)}
              options={getRecurrenceOptions()}
              testID="schedule-recurrence-select"
            />
          )}
        />
      </View>

      <View className="gap-1">
        <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {labels.interval}
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
          <Text className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {labels.weekdays}
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
          label={labels.cancel}
          onPress={handleCancel}
          className="flex-1"
          testID="schedule-cancel-button"
        />
        <Button
          variant="default"
          label={labels.save}
          onPress={handleSubmit(onSubmit)}
          disabled={!formState.isValid || formState.isSubmitting}
          className="flex-1"
          testID="schedule-save-button"
        />
      </View>
    </View>
  );
}
