import { DateTime } from 'luxon';

import { buildDtstartTimestamps } from '@/lib/growbro-task-engine/utils';
import i18n from '@/lib/i18n';
import { PlantEventKind } from '@/lib/plants/plant-event-kinds';

import type { TaskIntent, TwinState } from '../twin-types';

type TriState = 'yes' | 'no' | 'unsure';
type DrynessSeverity = 'mild' | 'moderate' | 'severe';

type DrynessSymptomPayload = {
  severity: DrynessSeverity;
  topDry: TriState;
  wateredLast12h: TriState;
};

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

function getClimateDescription(state: TwinState): string {
  const isFlower =
    state.stage === 'flowering_stretch' ||
    state.stage === 'flowering' ||
    state.stage === 'ripening';
  return isFlower
    ? i18n.t('tasks.climate_check.description_flower')
    : i18n.t('tasks.climate_check.description_veg');
}

function getWeeklyClimateCheckIntent(
  state: TwinState,
  start: Date
): TaskIntent {
  const { profile } = state;
  const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
    start,
    profile.timezone
  );
  return {
    engineKey: 'environment.climate_check.weekly',
    title: i18n.t('tasks.climate_check.title'),
    description: getClimateDescription(state),
    rrule: 'FREQ=WEEKLY;BYDAY=WE',
    dtstartLocal,
    dtstartUtc,
    timezone: profile.timezone,
    metadata: { category: 'environment' },
  };
}

function getDrynessSymptomIntent(
  state: TwinState,
  now: Date
): TaskIntent | null {
  const { profile } = state;
  const dryness = getLatestDrynessSymptom({
    signals: state.signals,
    now,
    maxAgeHours: 72,
  });

  if (
    dryness &&
    (dryness.payload.wateredLast12h === 'yes' ||
      dryness.payload.topDry !== 'yes' ||
      dryness.payload.severity === 'severe')
  ) {
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      dryness.occurredAt,
      profile.timezone
    );
    return {
      engineKey: 'environment.climate_check.symptom_dryness',
      title: i18n.t('tasks.climate_check.title'),
      description: getClimateDescription(state),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      count: 1,
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: {
        category: 'environment',
        trigger: 'symptom_logged',
        symptom: 'dryness',
        severity: dryness.payload.severity,
        sourceEventId: dryness.eventId,
      },
    };
  }
  return null;
}

function getIPMIntent(state: TwinState, start: Date): TaskIntent | null {
  const { profile } = state;
  const isVegOrEarlier =
    state.stage === 'germination' ||
    state.stage === 'seedling' ||
    state.stage === 'vegetative';

  const isFlowerOrLater =
    state.stage === 'flowering_stretch' ||
    state.stage === 'flowering' ||
    state.stage === 'ripening';

  if (isVegOrEarlier) {
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      start,
      profile.timezone
    );
    return {
      engineKey: 'environment.ipm_preventative',
      title: i18n.t('tasks.ipm_preventative.title'),
      description: i18n.t('tasks.ipm_preventative.description'),
      rrule: 'FREQ=WEEKLY;BYDAY=SU',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'environment' },
    };
  }

  if (isFlowerOrLater) {
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      start,
      profile.timezone
    );
    return {
      engineKey: 'environment.ipm_biological',
      title: i18n.t('tasks.ipm_biological.title'),
      description: i18n.t('tasks.ipm_biological.description'),
      rrule: 'FREQ=WEEKLY;BYDAY=SU',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'environment' },
    };
  }
  return null;
}

function getLightDistanceIntent(
  state: TwinState,
  start: Date
): TaskIntent | null {
  const { profile } = state;
  const shouldCheckLightDistance =
    (state.stage === 'flowering_stretch' || state.stage === 'flowering') &&
    profile.environment !== 'outdoor' &&
    typeof profile.heightCm === 'number';

  if (shouldCheckLightDistance) {
    const { dtstartLocal, dtstartUtc } = buildDtstartTimestamps(
      start,
      profile.timezone
    );
    return {
      engineKey: 'environment.check_light_distance',
      title: i18n.t('tasks.check_light_distance.title'),
      description: i18n.t('tasks.check_light_distance.description'),
      rrule: 'FREQ=WEEKLY;BYDAY=WE',
      dtstartLocal,
      dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'environment' },
    };
  }
  return null;
}

export function getEnvironmentIntents(state: TwinState): TaskIntent[] {
  const intents: TaskIntent[] = [];
  const { profile } = state;
  const start = profile.stageEnteredAt ?? new Date();
  const now = new Date();

  intents.push(getWeeklyClimateCheckIntent(state, start));

  const drynessIntent = getDrynessSymptomIntent(state, now);
  if (drynessIntent) intents.push(drynessIntent);

  const ipmIntent = getIPMIntent(state, start);
  if (ipmIntent) intents.push(ipmIntent);

  const lightIntent = getLightDistanceIntent(state, start);
  if (lightIntent) intents.push(lightIntent);

  return intents;
}
