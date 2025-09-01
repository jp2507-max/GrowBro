// RRULE v1.1 scope types
// - FREQ: DAILY | WEEKLY
// - INTERVAL: 1-365
// - BYDAY: only for WEEKLY (MO..SU)
// - UNTIL (UTC) or COUNT (mutually exclusive)

export type RRuleFrequency = 'DAILY' | 'WEEKLY';

export type RRuleConfig = {
  freq: RRuleFrequency;
  interval: number; // 1..365
  byweekday?: number[]; // ISO weekday numbers: 1=Mon .. 7=Sun
  until?: Date; // UTC, inclusive
  count?: number; // mutually exclusive with until
  dtstart: Date; // UTC reference instant
};

export type ValidationResult = {
  ok: boolean;
  errors?: string[];
};
