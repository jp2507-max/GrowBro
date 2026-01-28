import { DateTime } from 'luxon';

import {
  addDays,
  buildDtstartTimestamps,
} from '@/lib/growbro-task-engine/utils';
import i18n from '@/lib/i18n';

import type { TaskIntent, TwinState } from '../twin-types';

function buildIntent(
  params: Omit<TaskIntent, 'engineKey'> & { engineKey: string }
): TaskIntent {
  return { ...params };
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

export function getCuringIntents(state: TwinState): TaskIntent[] {
  if (state.stage !== 'curing') return [];
  const { profile } = state;
  const cureStart = profile.stageEnteredAt ?? new Date();
  const intents: TaskIntent[] = [];

  // Week 1: 2x daily
  const morning = buildDtstartAtHour(cureStart, profile.timezone, 9);
  const evening = buildDtstartAtHour(cureStart, profile.timezone, 21);

  intents.push(
    buildIntent({
      engineKey: 'curing.burp.week1.morning',
      title: i18n.t('tasks.burp_jars_week1.title'),
      description: i18n.t('tasks.burp_jars_week1.description_rich'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      count: 7,
      dtstartLocal: morning.dtstartLocal,
      dtstartUtc: morning.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'curing', burpWindow: 'week1' },
    })
  );

  intents.push(
    buildIntent({
      engineKey: 'curing.burp.week1.evening',
      title: i18n.t('tasks.burp_jars_week1.title'),
      description: i18n.t('tasks.burp_jars_week1.description_rich'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      count: 7,
      dtstartLocal: evening.dtstartLocal,
      dtstartUtc: evening.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'curing', burpWindow: 'week1' },
    })
  );

  // Week 2: daily
  const week2Start = addDays(cureStart, 7);
  const week2 = buildDtstartAtHour(week2Start, profile.timezone, 9);
  intents.push(
    buildIntent({
      engineKey: 'curing.burp.week2',
      title: i18n.t('tasks.burp_jars_week1.title'),
      description: i18n.t('tasks.burp_jars_week1.description_rich'),
      rrule: 'FREQ=DAILY;INTERVAL=1',
      count: 7,
      dtstartLocal: week2.dtstartLocal,
      dtstartUtc: week2.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'curing', burpWindow: 'week2' },
    })
  );

  // Week 3+: weekly
  const week3Start = addDays(cureStart, 14);
  const week3 = buildDtstartAtHour(week3Start, profile.timezone, 9);
  intents.push(
    buildIntent({
      engineKey: 'curing.burp.week3plus',
      title: i18n.t('tasks.burp_jars_week3.title'),
      description: i18n.t('tasks.burp_jars_week3.description_rich'),
      rrule: 'FREQ=WEEKLY;INTERVAL=1',
      dtstartLocal: week3.dtstartLocal,
      dtstartUtc: week3.dtstartUtc,
      timezone: profile.timezone,
      metadata: { category: 'curing', burpWindow: 'week3plus' },
    })
  );

  return intents;
}
