import { DateTime } from 'luxon';

import type { RRuleConfig } from './types';

const WEEKDAY_MAP: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 7,
};

export function parseRule(rule: string, dtstartUtc?: string): RRuleConfig {
  // Expect format: FREQ=DAILY|WEEKLY;INTERVAL=...;BYDAY=...;UNTIL=...;COUNT=...
  const parts = rule.split(';').filter(Boolean);
  const kv: Record<string, string> = {};
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k && v) kv[k.toUpperCase()] = v;
  }

  const freq = (kv['FREQ'] as RRuleConfig['freq']) ?? 'DAILY';
  const interval = kv['INTERVAL'] ? Number.parseInt(kv['INTERVAL'], 10) : 1;

  let byweekday: number[] | undefined;
  if (kv['BYDAY']) {
    byweekday = kv['BYDAY']
      .split(',')
      .map((token) => WEEKDAY_MAP[token.trim().toUpperCase()])
      .filter((n) => Number.isInteger(n));
  }

  let until: Date | undefined;
  if (kv['UNTIL']) {
    // UNTIL must be UTC; accept ISO or basic format.
    const iso = kv['UNTIL'];
    const dt = DateTime.fromISO(iso, { zone: 'utc' });
    until = dt.isValid ? dt.toJSDate() : undefined;
  }

  let count: number | undefined;
  if (kv['COUNT']) {
    const c = Number.parseInt(kv['COUNT'], 10);
    if (Number.isFinite(c)) count = c;
  }

  // DTSTART: use provided UTC string when given, else now (UTC)
  const dtstart = dtstartUtc
    ? DateTime.fromISO(dtstartUtc, { zone: 'utc' }).toJSDate()
    : DateTime.utc().toJSDate();

  return { freq, interval, byweekday, until, count, dtstart } as RRuleConfig;
}
