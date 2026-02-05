import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import {
  buildDtstartAtHour,
  buildDtstartTimestamps,
  calculateWaterVolume,
} from '@/lib/growbro-task-engine/utils';
import i18n from '@/lib/i18n';
import { PlantEventKind } from '@/lib/plants/plant-event-kinds';
import { database } from '@/lib/watermelon';
import type { AdjustmentSuggestionModel } from '@/lib/watermelon-models/adjustment-suggestion';

import type { TaskIntent, TwinState } from '../twin-types';

type TriState = 'yes' | 'no' | 'unsure';
type DrynessSeverity = 'mild' | 'moderate' | 'severe';

type DrynessSymptomPayload = {
  severity: DrynessSeverity;
  topDry: TriState;
  wateredLast12h: TriState;
};

const DRYNESS_SUGGESTION_MIN_EVENTS = 2;
const DRYNESS_SUGGESTION_MAX_AGE_HOURS = 7 * 24;

type ProcessEnvWithJest = NodeJS.ProcessEnv & { JEST_WORKER_ID?: string };

function isTestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    !!(
      process.env &&
      (process.env as ProcessEnvWithJest).JEST_WORKER_ID !== undefined
    )
  );
}

function isDryPayload(payload?: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  const status = payload.status;
  const isDry = payload.isDry;
  if (typeof status === 'string' && status.toLowerCase() === 'dry') return true;
  if (typeof isDry === 'boolean') return isDry;
  return false;
}

function isTriState(value: unknown): value is TriState {
  return value === 'yes' || value === 'no' || value === 'unsure';
}

function isDrynessSeverity(value: unknown): value is DrynessSeverity {
  return value === 'mild' || value === 'moderate' || value === 'severe';
}

function parseDrynessSymptomPayload(
  payload?: Record<string, unknown> | null
): DrynessSymptomPayload | null {
  if (!payload) return null;
  if (payload.symptom !== 'dryness') return null;

  const severity = payload.severity;
  const topDry = payload.topDry;
  const wateredLast12h = payload.wateredLast12h;

  if (!isDrynessSeverity(severity)) return null;
  if (!isTriState(topDry)) return null;
  if (!isTriState(wateredLast12h)) return null;

  return { severity, topDry, wateredLast12h };
}

function getLatestDrynessSymptom(params: {
  signals: TwinState['signals'];
  now: Date;
  maxAgeHours: number;
}): {
  eventId: string;
  occurredAt: Date;
  payload: DrynessSymptomPayload;
} | null {
  const { signals, now, maxAgeHours } = params;

  for (const event of signals.events) {
    if (event.kind !== PlantEventKind.SYMPTOM_LOGGED) continue;
    const parsed = parseDrynessSymptomPayload(
      (event.payload as Record<string, unknown> | null | undefined) ?? null
    );
    if (!parsed) continue;

    if (
      typeof event.occurredAt !== 'number' ||
      !Number.isFinite(event.occurredAt)
    )
      continue;

    const occurredAt = DateTime.fromMillis(event.occurredAt).toJSDate();
    const hoursOld = Math.abs(
      DateTime.fromJSDate(now).diff(DateTime.fromJSDate(occurredAt), 'hours')
        .hours
    );
    if (hoursOld > maxAgeHours) return null;

    return { eventId: event.id, occurredAt, payload: parsed };
  }

  return null;
}

function getDrynessEventKey(
  event: TwinState['signals']['events'][number]
): string {
  const payload = event.payload as Record<string, unknown> | null | undefined;
  const symptomCaseId = payload?.symptomCaseId;
  if (typeof symptomCaseId === 'string' && symptomCaseId.length > 0) {
    return symptomCaseId;
  }
  return event.id;
}

function countRecentDrynessSymptoms(params: {
  signals: TwinState['signals'];
  now: Date;
  maxAgeHours: number;
}): number {
  const { signals, now, maxAgeHours } = params;
  const seen = new Set<string>();
  let count = 0;

  for (const event of signals.events) {
    if (event.kind !== PlantEventKind.SYMPTOM_LOGGED) continue;
    const parsed = parseDrynessSymptomPayload(
      (event.payload as Record<string, unknown> | null | undefined) ?? null
    );
    if (!parsed) continue;

    if (
      typeof event.occurredAt !== 'number' ||
      !Number.isFinite(event.occurredAt)
    )
      continue;

    const occurredAt = DateTime.fromMillis(event.occurredAt).toJSDate();
    const hoursOld = Math.abs(
      DateTime.fromJSDate(now).diff(DateTime.fromJSDate(occurredAt), 'hours')
        .hours
    );
    if (hoursOld > maxAgeHours) continue;

    const key = getDrynessEventKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    count += 1;
  }

  return count;
}

async function maybeSuggestRepeatedDryness(
  state: TwinState,
  now: Date
): Promise<void> {
  if (isTestEnvironment()) return;

  const count = countRecentDrynessSymptoms({
    signals: state.signals,
    now,
    maxAgeHours: DRYNESS_SUGGESTION_MAX_AGE_HOURS,
  });
  if (count < DRYNESS_SUGGESTION_MIN_EVENTS) return;

  const plantId = state.profile.plantId;
  const reasoning = i18n.t('hydrology.adjustments.repeated_dryness', { count });
  const confidence = Math.min(0.9, 0.7 + (count - 2) * 0.05);
  const nowMs = Date.now();
  const expiresAt = nowMs + 3 * 24 * 60 * 60 * 1000;

  await database.write(async () => {
    const existing = await database
      .get<AdjustmentSuggestionModel>('adjustment_suggestions')
      .query(
        Q.where('plant_id', plantId),
        Q.where('root_cause', 'underwatering'),
        Q.where('status', 'pending')
      )
      .fetch();
    if (existing.length > 0) return;

    await database
      .get<AdjustmentSuggestionModel>('adjustment_suggestions')
      .create((record) => {
        record.plantId = plantId;
        record.suggestionType = 'watering';
        record.rootCause = 'underwatering';
        record.reasoning = reasoning;
        record.affectedTasks = [];
        record.confidence = confidence;
        record.status = 'pending';
        record.expiresAt = expiresAt;
        record.createdAt = nowMs;
        record.updatedAt = nowMs;
      });
  });
}

function isOverdueWatering(
  lastWateredAt: Date | undefined,
  maxDays: number,
  now: Date
): boolean {
  if (!lastWateredAt) return false;
  const diff = DateTime.fromJSDate(now).diff(
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
  intents.push({
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
  });

  const maxDays = profile.medium === 'living_soil' ? 8 : 7;
  if (isOverdueWatering(profile.lastWateredAt, maxDays, now)) {
    const overdue = buildDtstartTimestamps(now, profile.timezone);
    intents.push({
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
    });
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
    {
      engineKey: 'hydrology.fertigate.coco.morning',
      title: i18n.t('tasks.water_plant.title'),
      description: i18n.t('tasks.water_plant.description_coco'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: morning.dtstartLocal,
      dtstartUtc: morning.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology', medium: 'coco' },
    },
    {
      engineKey: 'hydrology.fertigate.coco.evening',
      title: i18n.t('tasks.water_plant.title'),
      description: i18n.t('tasks.water_plant.description_coco'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: evening.dtstartLocal,
      dtstartUtc: evening.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology', medium: 'coco' },
    },
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
    {
      engineKey: 'hydrology.fertigate.hydro.morning',
      title: i18n.t('tasks.water_plant.title'),
      description: i18n.t('tasks.water_plant.description_hydro'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: morning.dtstartLocal,
      dtstartUtc: morning.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology', medium: 'hydro' },
    },
    {
      engineKey: 'hydrology.fertigate.hydro.evening',
      title: i18n.t('tasks.water_plant.title'),
      description: i18n.t('tasks.water_plant.description_hydro'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: evening.dtstartLocal,
      dtstartUtc: evening.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology', medium: 'hydro' },
    },
    {
      engineKey: 'hydrology.check_ph_ec',
      title: i18n.t('tasks.check_ph_ec.title'),
      description: i18n.t('tasks.check_ph_ec.description'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology' },
    },
    {
      engineKey: 'hydrology.check_water_temp',
      title: i18n.t('tasks.check_water_temp.title'),
      description: i18n.t('tasks.check_water_temp.description'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology' },
    },
    {
      engineKey: 'hydrology.change_reservoir',
      title: i18n.t('tasks.change_reservoir.title'),
      description: i18n.t('tasks.change_reservoir.description'),
      rrule: 'FREQ=WEEKLY;INTERVAL=1',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'hydrology' },
    },
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

  if (
    typeof potWeightEvent.occurredAt !== 'number' ||
    !Number.isFinite(potWeightEvent.occurredAt)
  ) {
    return [];
  }

  const occurredAt = DateTime.fromMillis(potWeightEvent.occurredAt).toJSDate();
  const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
    occurredAt,
    profile.timezone
  );

  return [
    {
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
    },
  ];
}

function buildDrynessTriageIntents(params: {
  profile: TwinState['profile'];
  signals: TwinState['signals'];
  now: Date;
  min: number;
  max: number;
}): TaskIntent[] {
  const { profile, signals, now, min, max } = params;

  const symptom = getLatestDrynessSymptom({
    signals,
    now,
    maxAgeHours: 72,
  });
  if (!symptom) return [];

  const dtstart = buildDtstartTimestamps(symptom.occurredAt, profile.timezone);
  const { payload } = symptom;

  const intents: TaskIntent[] = [];

  const shouldAddWaterNow =
    payload.topDry === 'yes' && payload.wateredLast12h === 'no';

  if (shouldAddWaterNow) {
    const description =
      profile.medium === 'coco'
        ? i18n.t('tasks.water_plant.description_coco_rich', { min, max })
        : profile.medium === 'hydro'
          ? i18n.t('tasks.water_plant.description_hydro')
          : i18n.t('tasks.water_plant.description_soil_rich', { min, max });

    intents.push({
      engineKey: 'hydrology.water_now.symptom_dryness',
      title: i18n.t('tasks.water_plant.title'),
      description,
      rrule: 'FREQ=DAILY;INTERVAL=1',
      count: 1,
      dtstartLocal: dtstart.dtstartLocal,
      dtstartUtc: dtstart.dtstartUtc,
      timezone: profile.timezone,
      metadata: {
        category: 'hydrology',
        trigger: 'symptom_logged',
        symptom: 'dryness',
        severity: payload.severity,
        sourceEventId: symptom.eventId,
      },
    });
  }

  const shouldAddCheckWaterNeed =
    profile.medium !== 'hydro' && !shouldAddWaterNow;

  if (shouldAddCheckWaterNeed) {
    const description =
      profile.medium === 'coco'
        ? i18n.t('tasks.check_water_need.description_coco', { min, max })
        : i18n.t('tasks.check_water_need.description_soil', { min, max });

    intents.push({
      engineKey: 'hydrology.check_water_need.symptom_dryness',
      title: i18n.t('tasks.check_water_need.title'),
      description,
      rrule: 'FREQ=DAILY;INTERVAL=1',
      count: 1,
      dtstartLocal: dtstart.dtstartLocal,
      dtstartUtc: dtstart.dtstartUtc,
      timezone: profile.timezone,
      metadata: {
        category: 'hydrology',
        trigger: 'symptom_logged',
        symptom: 'dryness',
        severity: payload.severity,
        sourceEventId: symptom.eventId,
      },
    });
  }

  return intents;
}

export async function getHydrologyIntents(
  state: TwinState,
  now: Date = new Date()
): Promise<TaskIntent[]> {
  const { profile, signals } = state;
  const start = profile.stageEnteredAt ?? now;
  const { min, max } = calculateWaterVolume(profile.potSizeLiters);

  const intents: TaskIntent[] = [
    ...buildSoilIntents({ profile, start, now, min, max }),
    ...buildCocoIntents({ profile, start }),
    ...buildHydroIntents({ profile, start }),
    ...buildPotWeightIntent({ profile, signals, now }),
    ...buildDrynessTriageIntents({ profile, signals, now, min, max }),
  ];

  try {
    await maybeSuggestRepeatedDryness(state, now);
  } catch (error) {
    console.warn(
      '[hydrology-engine] Failed to create repeated dryness suggestion',
      error
    );
  }

  return intents;
}
