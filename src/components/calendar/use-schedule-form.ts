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
    recurrencePattern:
      (rruleGenerator.parseFrequencyFromRRULE(s.rrule) as RecurrencePattern) ||
      'daily',
    interval: rruleGenerator.parseIntervalFromRRULE(s.rrule) ?? 1,
    weekdays: (() => {
      const parsed = rruleGenerator.parseWeekdaysFromRRULE(s.rrule);
      return parsed.length > 0 ? parsed : [];
    })(),
    startTime: DateTime.fromISO(s.dtstartLocal).toFormat('HH:mm'),
    plantId: s.plantId,
  };
}

function parseAndValidateTime(timeString: string): {
  hour: number;
  minute: number;
} {
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeString);
  if (!timeMatch) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:mm`);
  }

  const hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`Invalid time values: hour=${hour}, minute=${minute}`);
  }

  if (hour < 0 || hour > 23) {
    throw new Error(`Hour must be between 0 and 23, got ${hour}`);
  }

  if (minute < 0 || minute > 59) {
    throw new Error(`Minute must be between 0 and 59, got ${minute}`);
  }

  return { hour, minute };
}

function validateAndConvertDateTime(dt: DateTime, label: string): string {
  if (!dt.isValid) {
    throw new Error(
      `Invalid ${label} DateTime: ${dt.invalidReason} - ${dt.invalidExplanation}`
    );
  }

  const isoString = dt.toISO();
  if (!isoString) {
    throw new Error(`Failed to convert ${label} DateTime to ISO string`);
  }

  return isoString;
}

async function submitSchedule(
  data: ScheduleFormData,
  params: { selectedDate?: DateTime; timezone: string; editingSeries?: Series }
): Promise<void> {
  const { selectedDate, timezone, editingSeries } = params;

  // Defensive validation: callers should validate weekdays for weekly recurrence,
  // but enforce here to avoid silently falling back to daily recurrence.
  if (data.recurrencePattern === 'weekly' && data.weekdays.length === 0) {
    throw new Error('Please select at least one day for weekly recurrence');
  }

  const { hour, minute } = parseAndValidateTime(data.startTime);

  const startDateTime = (selectedDate ?? DateTime.now())
    .set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    })
    .setZone(timezone);

  const dtstartLocal = validateAndConvertDateTime(startDateTime, 'local');
  const dtstartUtc = validateAndConvertDateTime(startDateTime.toUTC(), 'UTC');

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
  const { control, handleSubmit, watch, reset, formState, setError } =
    useForm<ScheduleFormData>({ defaultValues });

  React.useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const onSubmit = React.useCallback(
    async (data: ScheduleFormData) => {
      // validate weekly weekdays selection at the form level so the UI can show an error
      if (data.recurrencePattern === 'weekly' && data.weekdays.length === 0) {
        setError('weekdays', {
          type: 'required',
          message: 'Please select at least one day for weekly recurrence',
        });
        return;
      }

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
