import { DateTime } from 'luxon';
import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { showErrorMessage } from '@/lib/flash-message';
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

function parseWeekdaysOrEmpty(rrule: string): WeekDay[] {
  const parsed = rruleGenerator.parseWeekdaysFromRRULE(rrule);
  return parsed.length > 0 ? parsed : [];
}

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
    weekdays: parseWeekdaysOrEmpty(s.rrule),
    startTime: DateTime.fromISO(s.dtstartLocal).toFormat('HH:mm'),
    plantId: s.plantId,
  };
}

function parseAndValidateTime(
  timeString: string,
  t: (key: string, params?: Record<string, unknown>) => string
): {
  hour: number;
  minute: number;
} {
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeString);
  if (!timeMatch) {
    throw new Error(t('calendar.errors.invalidTimeFormat', { timeString }));
  }

  const hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(t('calendar.errors.invalidTimeValues', { hour, minute }));
  }

  if (hour < 0 || hour > 23) {
    throw new Error(t('calendar.errors.invalidHour', { hour }));
  }

  if (minute < 0 || minute > 59) {
    throw new Error(t('calendar.errors.invalidMinute', { minute }));
  }

  return { hour, minute };
}

function validateAndConvertDateTime(
  dt: DateTime,
  label: string,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  if (!dt.isValid) {
    throw new Error(
      t('calendar.errors.invalidDateTime', {
        label,
        reason: dt.invalidReason,
        explanation: dt.invalidExplanation,
      })
    );
  }

  const isoString = dt.toISO();
  if (!isoString) {
    throw new Error(t('calendar.errors.failedIsoConversion', { label }));
  }

  return isoString;
}

async function submitSchedule(
  data: ScheduleFormData,
  params: {
    selectedDate?: DateTime;
    timezone: string;
    editingSeries?: Series;
    t: (key: string, params?: Record<string, unknown>) => string;
  }
): Promise<void> {
  const { selectedDate, timezone, editingSeries, t } = params;

  // Defensive validation: callers should validate weekdays for weekly recurrence,
  // but enforce here to avoid silently falling back to daily recurrence.
  if (data.recurrencePattern === 'weekly' && data.weekdays.length === 0) {
    throw new Error('Please select at least one day for weekly recurrence');
  }

  const { hour, minute } = parseAndValidateTime(data.startTime, t);

  const startDateTime = (selectedDate ?? DateTime.now())
    .set({
      hour,
      minute,
      second: 0,
      millisecond: 0,
    })
    .setZone(timezone);

  const dtstartLocal = validateAndConvertDateTime(startDateTime, 'local', t);
  const dtstartUtc = validateAndConvertDateTime(
    startDateTime.toUTC(),
    'UTC',
    t
  );

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
  const { t } = useTranslation();
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
        await submitSchedule(data, {
          selectedDate,
          timezone,
          editingSeries,
          t,
        });
        onSave?.();
        reset(defaultValues);
      } catch (e) {
        console.error('[ScheduleForm] Failed:', e);
        showErrorMessage(t('calendar.schedule_editor.save_failed'));
        throw e;
      }
    },
    [
      selectedDate,
      timezone,
      editingSeries,
      onSave,
      reset,
      defaultValues,
      setError,
      t,
    ]
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
