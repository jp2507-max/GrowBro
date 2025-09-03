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

  // Validate FREQ against allowed values, default to 'DAILY' if invalid
  const allowedFreqs: RRuleConfig['freq'][] = ['DAILY', 'WEEKLY'];
  const freq = allowedFreqs.includes(kv['FREQ'] as RRuleConfig['freq'])
    ? (kv['FREQ'] as RRuleConfig['freq'])
    : 'DAILY';

  // Parse INTERVAL with validation: ensure integer between 1-365, fallback to 1
  const parsedInterval = Number.parseInt(kv['INTERVAL'], 10);
  const interval = Number.isNaN(parsedInterval)
    ? 1
    : Math.max(1, Math.min(365, parsedInterval));

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
    let dt = DateTime.fromISO(iso, { zone: 'utc' });
    if (!dt.isValid) {
      // Fallback for basic format like 20250101T000000Z
      // RFC5545 basic format uses compact date-time with literal 'T' and 'Z'
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
