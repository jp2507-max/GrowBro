// RRULE v1.2 scope types
// - FREQ: DAILY | WEEKLY | MONTHLY
// - INTERVAL: 1-365
// - BYDAY: only for WEEKLY (MO..SU)
// - UNTIL (UTC) or COUNT (mutually exclusive)

export type RRuleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

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

// Explicit open recurrence (neither COUNT nor UNTIL).
export type RRuleConfigOpen = RRuleConfigBase & {
  count?: never;
  until?: never;
};

// Parser return can be one of:
// - a validated concrete config (RRuleConfigUntil | RRuleConfigCount)
// - an open config (RRuleConfigOpen)
// - or a permissive parse shape (may temporarily contain both COUNT and UNTIL)
export type RRuleParseResult = RRuleConfig | RRuleConfigOpen | RRuleParse;

export type ValidationResult = {
  ok: boolean;
  errors?: string[];
};

// Parser result type: during parsing we may encounter RRULE strings that
// temporarily contain both COUNT and UNTIL; the parser returns this wider
// shape and callers should run `validate()` to obtain a properly-formed
// RRuleConfig (mutually exclusive COUNT/UNTIL).
export type RRuleParse = RRuleConfigBase & {
  count?: number;
  until?: Date;
};
