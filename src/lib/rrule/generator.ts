import { DateTime } from 'luxon';
import type { Weekday } from 'rrule';
import { RRule, rrulestr } from 'rrule';

// Error codes for RRULE validation
export enum RRULEErrorCode {
  INVALID_FORMAT = 'RRULE_INVALID_FORMAT',
  MISSING_FREQ = 'RRULE_MISSING_FREQ',
  INVALID_WEEKDAY = 'RRULE_INVALID_WEEKDAY',
  INVALID_INTERVAL = 'RRULE_INVALID_INTERVAL',
  COUNT_AND_UNTIL = 'RRULE_COUNT_AND_UNTIL',
}

// Type for RRule options extracted from parsed rules
type RRuleOptions = {
  freq?: number;
  interval?: number;
  count?: number;
  until?: Date;
  byweekday?: Weekday[];
  bymonthday?: number[];
  dtstart?: Date;
};

export class RRULEError extends Error {
  constructor(
    public code: RRULEErrorCode,
    message: string,
    public rrule?: string
  ) {
    super(message);
    this.name = 'RRULEError';
  }
}

export type WeekDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'
  | 'sun'
  | 'MO'
  | 'TU'
  | 'WE'
  | 'TH'
  | 'FR'
  | 'SA'
  | 'SU';

export type TaskTemplate = {
  recurrencePattern?: 'daily' | 'weekly' | 'custom';
  interval?: number;
  weekdays?: WeekDay[];
  customRRule?: string;
};

/**
 * RRULEGenerator - RFC 5545 compliant RRULE generation and validation
 * Uses the rrule.js library for parsing and validation with timezone awareness via luxon
 */
export class RRULEGenerator {
  // Explicit mapping from WeekDay string values to rrule.js weekday objects
  private static readonly WEEKDAY_MAP: Record<string, Weekday> = {
    monday: RRule.MO,
    tuesday: RRule.TU,
    wednesday: RRule.WE,
    thursday: RRule.TH,
    friday: RRule.FR,
    saturday: RRule.SA,
    sunday: RRule.SU,
    mon: RRule.MO,
    tue: RRule.TU,
    wed: RRule.WE,
    thu: RRule.TH,
    fri: RRule.FR,
    sat: RRule.SA,
    sun: RRule.SU,
    MO: RRule.MO,
    TU: RRule.TU,
    WE: RRule.WE,
    TH: RRule.TH,
    FR: RRule.FR,
    SA: RRule.SA,
    SU: RRule.SU,
  };

  /**
   * Generate a daily RRULE string
   */
  generateDailyRRULE(interval: number = 1): string {
    const rule = new RRule({ freq: RRule.DAILY, interval });
    return rule.toString();
  }

  /**
   * Generate a weekly RRULE string with specific days
   */
  generateWeeklyRRULE(days: WeekDay[], interval: number = 1): string {
    const byweekday = days.map((d) => {
      const key = String(d || '');
      const normalized = key.toLowerCase();
      const short = normalized.slice(0, 3);
      const candidate =
        RRULEGenerator.WEEKDAY_MAP[key] ||
        RRULEGenerator.WEEKDAY_MAP[normalized] ||
        RRULEGenerator.WEEKDAY_MAP[short] ||
        RRULEGenerator.WEEKDAY_MAP[key.toUpperCase()];

      if (!candidate) {
        throw new RRULEError(
          RRULEErrorCode.INVALID_WEEKDAY,
          `Invalid weekday value provided to generateWeeklyRRULE: ${key}`
        );
      }
      return candidate;
    });

    const rule = new RRule({ freq: RRule.WEEKLY, interval, byweekday });
    return rule.toString();
  }

  /**
   * Build RRULE string from template
   */
  private buildRRULE(template: TaskTemplate): string {
    if (template.customRRule) {
      return template.customRRule;
    }

    if (template.recurrencePattern === 'daily') {
      return this.generateDailyRRULE(template.interval || 1);
    }

    if (template.recurrencePattern === 'weekly' && template.weekdays) {
      return this.generateWeeklyRRULE(
        template.weekdays,
        template.interval || 1
      );
    }

    // Default to daily
    return this.generateDailyRRULE(1);
  }

  /**
   * Generate custom RRULE from template with validation
   */
  generateCustomRRULE(
    template: TaskTemplate,
    _timezone: string,
    _startDate?: string
  ): string {
    const rruleString = this.buildRRULE(template);

    // Validate via library + semantic checks
    const validation = this.validateRRULEPattern(rruleString);
    if (!validation.valid) {
      throw new RRULEError(
        RRULEErrorCode.INVALID_FORMAT,
        validation.reason,
        rruleString
      );
    }

    return rruleString;
  }

  /**
   * Validate RRULE pattern using rrule.js parser and semantic checks
   */
  validateRRULEPattern(
    rruleString: string
  ): { valid: true } | { valid: false; reason: string } {
    try {
      // Primary syntax validation: delegate to rrule parser
      const parsed = rrulestr(rruleString, { forceset: false });

      // Access options for semantic checks
      const opts: RRuleOptions =
        (
          parsed as unknown as {
            origOptions?: RRuleOptions;
            options?: RRuleOptions;
          }
        ).origOptions ||
        (
          parsed as unknown as {
            origOptions?: RRuleOptions;
            options?: RRuleOptions;
          }
        ).options ||
        {};

      // Semantic rule: COUNT and UNTIL are mutually exclusive (RFC 5545)
      if (opts.count && opts.until) {
        return {
          valid: false,
          reason: 'RRULE must not contain both COUNT and UNTIL',
        };
      }

      // Semantic rule: BYDAY and BYMONTHDAY exclusivity for our domain
      if (opts.byweekday && opts.bymonthday) {
        return {
          valid: false,
          reason: 'BYDAY and BYMONTHDAY must not be used together',
        };
      }

      // Ensure FREQ exists
      if (!opts.freq && opts.freq !== 0) {
        return { valid: false, reason: 'RRULE missing FREQ' };
      }

      // Validate interval is positive
      if (opts.interval !== undefined && opts.interval <= 0) {
        return { valid: false, reason: 'INTERVAL must be a positive integer' };
      }

      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        reason: (err as Error).message || 'Invalid RRULE syntax',
      };
    }
  }

  /**
   * Compute next occurrence after a given date with timezone awareness
   */
  nextOccurrence(
    rruleString: string,
    options: {
      after: Date;
      timezone: string;
      dtstartIso?: string;
    }
  ): Date | null {
    try {
      const { after, timezone, dtstartIso } = options;

      // Determine the dtstart to use
      let dtstart: Date;
      if (dtstartIso) {
        // Parse the ISO string in the specified timezone and convert to UTC
        dtstart = DateTime.fromISO(dtstartIso, { zone: timezone })
          .toUTC()
          .toJSDate();
      } else {
        // Use a default dtstart (current time in UTC)
        dtstart = DateTime.utc().toJSDate();
      }

      // Parse the RRULE string and extract options
      const parsed = rrulestr(rruleString, { forceset: false });

      // Get the options from the parsed rule
      const opts: RRuleOptions =
        (
          parsed as unknown as {
            origOptions?: RRuleOptions;
            options?: RRuleOptions;
          }
        ).origOptions ||
        (
          parsed as unknown as {
            origOptions?: RRuleOptions;
            options?: RRuleOptions;
          }
        ).options ||
        {};

      // Create a new RRule with the explicit dtstart
      const rule = new RRule({ ...opts, dtstart });

      // Convert the reference "after" to UTC for consistent comparisons
      const afterUtc = DateTime.fromJSDate(after).toUTC().toJSDate();

      // Get the next occurrence after the specified date
      const next = rule.after(afterUtc, false);
      return next ? new Date(next) : null;
    } catch (err) {
      throw new RRULEError(
        RRULEErrorCode.INVALID_FORMAT,
        (err as Error).message,
        rruleString
      );
    }
  }

  /**
   * Get anchor date from plant or phase start date
   */
  getAnchorDate(
    plant: { startDate?: Date },
    phase?: { startDate?: Date }
  ): Date {
    if (phase?.startDate) {
      return phase.startDate;
    }
    if (plant.startDate) {
      return plant.startDate;
    }
    // Default to current date if no anchor available
    return new Date();
  }
}

// Export singleton instance
export const rruleGenerator = new RRULEGenerator();
