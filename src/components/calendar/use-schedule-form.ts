import { DateTime } from 'luxon';
import React from 'react';
import { useForm } from 'react-hook-form';

import { rruleGenerator, type WeekDay } from '@/lib/rrule/generator';
import { createSeries, createTask, updateSeries } from '@/lib/task-manager';
import type { Series } from '@/types/calendar';

type RecurrencePattern = 'daily' | 'weekly';

export type ScheduleFormData = {
  title: string;
  recurrencePattern: RecurrencePattern;
  interval: number;
  weekdays: WeekDay[];
  startTime: string;
  plantId?: string;
};

type UseScheduleFormParams = {
  editingSeries?: Series;
  selectedDate?: DateTime;
  timezone: string;
  onSave?: () => void;
  onCancel: () => void;
};

function buildDefaultValues(s?: Series): ScheduleFormData {
  if (!s)
    return {
      title: '',
      recurrencePattern: 'daily',
      interval: 1,
      weekdays: [],
      startTime: '09:00',
    };
  return {
    title: s.title,
    recurrencePattern: s.rrule.includes('WEEKLY') ? 'weekly' : 'daily',
    interval: 1,
    weekdays: ['MO', 'WE', 'FR'] as WeekDay[],
    startTime: DateTime.fromISO(s.dtstartLocal).toFormat('HH:mm'),
    plantId: s.plantId,
  };
}

async function submitSchedule(
  data: ScheduleFormData,
  params: { selectedDate?: DateTime; timezone: string; editingSeries?: Series }
) {
  const { selectedDate, timezone, editingSeries } = params;
  const startDateTime = (selectedDate ?? DateTime.now())
    .set({
      hour: +data.startTime.split(':')[0],
      minute: +data.startTime.split(':')[1],
      second: 0,
    })
    .setZone(timezone);
  const dtstartLocal = startDateTime.toISO()!;
  const dtstartUtc = startDateTime.toUTC().toISO()!;
  const rruleString =
    data.recurrencePattern === 'weekly' && data.weekdays.length > 0
      ? rruleGenerator.generateWeeklyRRULE(data.weekdays, data.interval)
      : rruleGenerator.generateDailyRRULE(data.interval);

  if (editingSeries) {
    await updateSeries(editingSeries.id, {
      title: data.title,
      rrule: rruleString,
      dtstartLocal,
      dtstartUtc,
      timezone,
      plantId: data.plantId,
    });
  } else {
    const series = await createSeries({
      title: data.title,
      rrule: rruleString,
      dtstartLocal,
      dtstartUtc,
      timezone,
      plantId: data.plantId,
    });
    await createTask({
      title: data.title,
      seriesId: series.id,
      dueAtLocal: dtstartLocal,
      dueAtUtc: dtstartUtc,
      timezone,
      plantId: data.plantId,
    });
  }
}

export function useScheduleForm({
  editingSeries,
  selectedDate,
  timezone,
  onSave,
  onCancel,
}: UseScheduleFormParams) {
  const defaultValues = React.useMemo(
    () => buildDefaultValues(editingSeries),
    [editingSeries]
  );
  const { control, handleSubmit, watch, reset, formState } =
    useForm<ScheduleFormData>({ defaultValues });

  React.useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = React.useCallback(
    async (data: ScheduleFormData) => {
      try {
        await submitSchedule(data, { selectedDate, timezone, editingSeries });
        onSave?.();
        reset(defaultValues);
      } catch (e) {
        console.error('[ScheduleForm] Failed:', e);
      }
    },
    [selectedDate, timezone, editingSeries, onSave, reset, defaultValues]
  );

  const handleCancel = React.useCallback(() => {
    onCancel();
    reset(defaultValues);
  }, [onCancel, reset, defaultValues]);

  return {
    control,
    handleSubmit,
    formState,
    recurrencePattern: watch('recurrencePattern'),
    onSubmit,
    handleCancel,
  };
}
