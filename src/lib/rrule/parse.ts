import { DateTime } from 'luxon';

import type {
  RRuleConfig,
  RRuleConfigCount,
  RRuleConfigUntil,
  Weekday,
} from './types';

const WEEKDAY_MAP: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

function parseKeyValuePairs(rule: string): Record<string, string> {
  const pairs = rule.split(';').filter(Boolean);
  const map: Record<string, string> = {};
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) map[key.toUpperCase()] = value;
  }
  return map;
}

function parseFrequency(kv: Record<string, string>): RRuleConfig['freq'] {
  const allowed: RRuleConfig['freq'][] = ['DAILY', 'WEEKLY'];
  const token = kv['FREQ'] as RRuleConfig['freq'];
  return allowed.includes(token) ? token : 'DAILY';
}

function parseIntervalValue(kv: Record<string, string>): number {
  const parsed = Number.parseInt(kv['INTERVAL'], 10);
  if (Number.isNaN(parsed)) return 1;
  const clamped = Math.max(1, Math.min(365, parsed));
  return clamped;
}

function parseByWeekdayValue(
  kv: Record<string, string>
): Weekday[] | undefined {
  if (!kv['BYDAY']) return undefined;
  const values = kv['BYDAY']
    .split(',')
    .map((token) => WEEKDAY_MAP[token.trim().toUpperCase()])
    .filter((n) => Number.isInteger(n));
  return values as Weekday[];
}

function parseUntilDate(kv: Record<string, string>): Date | undefined {
  if (!kv['UNTIL']) return undefined;
  const iso = kv['UNTIL'];
  let dt = DateTime.fromISO(iso, { zone: 'utc' });
  if (!dt.isValid) {
    const candidates = [
      "yyyyLLdd'T'HHmmss'Z'",
      "yyyyLLdd'T'HHmm'Z'",
      "yyyyLLdd'T'HH'Z'",
    ];
    for (const fmt of candidates) {
      const parsed = DateTime.fromFormat(iso, fmt, { zone: 'utc' });
      if (parsed.isValid) {
        dt = parsed;
        break;
      }
    }
  }
  return dt.isValid ? dt.toJSDate() : undefined;
}

function parseCountValue(kv: Record<string, string>): number | undefined {
  if (!kv['COUNT']) return undefined;
  const count = Number.parseInt(kv['COUNT'], 10);
  return Number.isFinite(count) ? count : undefined;
}

function parseDtstartDate(dtstartUtc?: string): Date {
  return dtstartUtc
    ? DateTime.fromISO(dtstartUtc, { zone: 'utc' }).toJSDate()
    : DateTime.utc().toJSDate();
}

export function parseRule(rule: string, dtstartUtc?: string): RRuleConfig {
  const kv = parseKeyValuePairs(rule);
  const freq = parseFrequency(kv);
  const interval = parseIntervalValue(kv);
  const byweekday = parseByWeekdayValue(kv);
  const until = parseUntilDate(kv);
  const count = parseCountValue(kv);
  const dtstart = parseDtstartDate(dtstartUtc);

  if (count !== undefined) {
    return {
      freq,
      interval,
      byweekday,
      dtstart,
      count,
    } satisfies RRuleConfigCount;
  }

  return {
    freq,
    interval,
    byweekday,
    dtstart,
    until: until!,
  } satisfies RRuleConfigUntil;
}
