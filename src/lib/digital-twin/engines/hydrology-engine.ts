import { DateTime } from 'luxon';

import {
  buildDtstartTimestamps,
  calculateWaterVolume,
} from '@/lib/growbro-task-engine/utils';
import i18n from '@/lib/i18n';
import { PlantEventKind } from '@/lib/plants/plant-event-kinds';

import type { TaskIntent, TwinState } from '../twin-types';

function buildIntent(
  params: Omit<TaskIntent, 'engineKey'> & { engineKey: string }
): TaskIntent {
  return { ...params };
}

function isDryPayload(payload?: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  const status = payload.status;
  const isDry = payload.isDry;
  if (typeof status === 'string' && status.toLowerCase() === 'dry') return true;
  if (typeof isDry === 'boolean') return isDry;
  return false;
}

function buildDtstartAtHour(
  date: Date,
  timezone: string,
  hour: number
): { dtstartLocal: string; dtstartUtc: string } {
  const dt = DateTime.fromJSDate(date, { zone: timezone }).set({
    hour,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  return buildDtstartTimestamps(dt.toJSDate(), timezone);
}

function isOverdueWatering(
  lastWateredAt: Date | undefined,
  maxDays: number
): boolean {
  if (!lastWateredAt) return false;
  const diff = DateTime.now().diff(
    DateTime.fromJSDate(lastWateredAt),
    'days'
  ).days;
  return diff >= maxDays;
}

function buildSoilIntents(params: {
  profile: TwinState['profile'];
  start: Date;
  now: Date;
  min: number;
  max: number;
}): TaskIntent[] {
  const { profile, start, now, min, max } = params;
  if (
    profile.medium !== 'soil' &&
    profile.medium !== 'living_soil' &&
    profile.medium !== 'other'
  ) {
    return [];
  }

  const intents: TaskIntent[] = [];
  const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
    start,
    profile.timezone
  );
  intents.push(
    buildIntent({
      engineKey: 'hydrology.check_water_need',
      title: i18n.t('tasks.check_water_need.title'),
      description: i18n.t('tasks.check_water_need.description_soil', {
        min,
        max,
      }),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology' },
    })
  );

  const maxDays = profile.medium === 'living_soil' ? 8 : 7;
  if (isOverdueWatering(profile.lastWateredAt, maxDays)) {
    const overdue = buildDtstartTimestamps(now, profile.timezone);
    intents.push(
      buildIntent({
        engineKey: 'hydrology.water_now.overdue',
        title: i18n.t('tasks.water_plant.title'),
        description: i18n.t('tasks.water_plant.description_soil_rich', {
          min,
          max,
        }),
        rrule: 'FREQ=DAILY;INTERVAL=1',
        count: 1,
        dtstartLocal: overdue.dtstartLocal,
        dtstartUtc: overdue.dtstartUtc,
        timezone: profile.timezone,
        metadata: { category: 'hydrology', trigger: 'overdue' },
      })
    );
  }

  return intents;
}

function buildCocoIntents(params: {
  profile: TwinState['profile'];
  start: Date;
}): TaskIntent[] {
  const { profile, start } = params;
  if (profile.medium !== 'coco') return [];

  const morning = buildDtstartAtHour(start, profile.timezone, 9);
  const evening = buildDtstartAtHour(start, profile.timezone, 21);

  return [
    buildIntent({
      engineKey: 'hydrology.fertigate.coco.morning',
      title: i18n.t('tasks.water_plant.title'),
      description: i18n.t('tasks.water_plant.description_coco'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: morning.dtstartLocal,
      dtstartUtc: morning.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology', medium: 'coco' },
    }),
    buildIntent({
      engineKey: 'hydrology.fertigate.coco.evening',
      title: i18n.t('tasks.water_plant.title'),
      description: i18n.t('tasks.water_plant.description_coco'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: evening.dtstartLocal,
      dtstartUtc: evening.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology', medium: 'coco' },
    }),
  ];
}

function buildHydroIntents(params: {
  profile: TwinState['profile'];
  start: Date;
}): TaskIntent[] {
  const { profile, start } = params;
  if (profile.medium !== 'hydro') return [];

  const morning = buildDtstartAtHour(start, profile.timezone, 9);
  const evening = buildDtstartAtHour(start, profile.timezone, 21);
  const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
    start,
    profile.timezone
  );

  return [
    buildIntent({
      engineKey: 'hydrology.fertigate.hydro.morning',
      title: i18n.t('tasks.water_plant.title'),
      description: i18n.t('tasks.water_plant.description_hydro'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: morning.dtstartLocal,
      dtstartUtc: morning.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology', medium: 'hydro' },
    }),
    buildIntent({
      engineKey: 'hydrology.fertigate.hydro.evening',
      title: i18n.t('tasks.water_plant.title'),
      description: i18n.t('tasks.water_plant.description_hydro'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: evening.dtstartLocal,
      dtstartUtc: evening.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology', medium: 'hydro' },
    }),
    buildIntent({
      engineKey: 'hydrology.check_ph_ec',
      title: i18n.t('tasks.check_ph_ec.title'),
      description: i18n.t('tasks.check_ph_ec.description'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology' },
    }),
    buildIntent({
      engineKey: 'hydrology.check_water_temp',
      title: i18n.t('tasks.check_water_temp.title'),
      description: i18n.t('tasks.check_water_temp.description'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology' },
    }),
    buildIntent({
      engineKey: 'hydrology.change_reservoir',
      title: i18n.t('tasks.change_reservoir.title'),
      description: i18n.t('tasks.change_reservoir.description'),
      rrule: 'FREQ=WEEKLY;INTERVAL=1',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology' },
    }),
  ];
}

function buildPotWeightIntent(params: {
  profile: TwinState['profile'];
  signals: TwinState['signals'];
  now: Date;
}): TaskIntent[] {
  const { profile, signals } = params;
  const potWeightEvent = signals.events.find(
    (event) => event.kind === PlantEventKind.POT_WEIGHT_CHECK
  );
  if (!potWeightEvent || !isDryPayload(potWeightEvent.payload ?? null)) {
    return [];
  }

  const occurredAt = DateTime.fromMillis(potWeightEvent.occurredAt).toJSDate();
  const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
    occurredAt,
    profile.timezone
  );

  return [
    buildIntent({
      engineKey: `hydrology.water_now.${potWeightEvent.id}`,
      title: i18n.t('tasks.water_plant.title'),
      description:
        profile.medium === 'coco'
          ? i18n.t('tasks.water_plant.description_coco')
          : i18n.t('tasks.water_plant.description_soil'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      count: 1,
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: {
        category: 'hydrology',
        sourceEventId: potWeightEvent.id,
      },
    }),
  ];
}

export function getHydrologyIntents(state: TwinState): TaskIntent[] {
  const { profile, signals } = state;
  const now = new Date();
  const start = profile.stageEnteredAt ?? now;
  const { min, max } = calculateWaterVolume(profile.potSizeLiters);

  return [
    ...buildSoilIntents({ profile, start, now, min, max }),
    ...buildCocoIntents({ profile, start }),
    ...buildHydroIntents({ profile, start }),
    ...buildPotWeightIntent({ profile, signals, now }),
  ];
}
