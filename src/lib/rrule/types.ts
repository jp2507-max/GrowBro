// RRULE v1.1 scope types
// - FREQ: DAILY | WEEKLY
// - INTERVAL: 1-365
// - BYDAY: only for WEEKLY (MO..SU)
// - UNTIL (UTC) or COUNT (mutually exclusive)

export type RRuleFrequency = 'DAILY' | 'WEEKLY';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7; // ISO weekday numbers: 1=Mon .. 7=Sun

export type RRuleConfigBase = {
  freq: RRuleFrequency;
  interval: number; // 1..365
  byweekday?: Weekday[]; // ISO weekday numbers: 1=Mon .. 7=Sun
  dtstart: Date; // UTC reference instant
};

export type RRuleConfigUntil = RRuleConfigBase & {
  until: Date; // UTC, inclusive
  count?: never;
};

export type RRuleConfigCount = RRuleConfigBase & {
  count: number;
  until?: never;
};

export type RRuleConfig = RRuleConfigUntil | RRuleConfigCount;

export type ValidationResult = {
  ok: boolean;
  errors?: string[];
};
