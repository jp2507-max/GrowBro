import type { RRuleConfig, ValidationResult } from './types';

export function validate(config: RRuleConfig): ValidationResult {
  const errors: string[] = [];

  // Validate dtstart is a valid Date
  if (!(config.dtstart instanceof Date) || isNaN(config.dtstart.getTime())) {
    errors.push('dtstart must be a valid Date');
  }

  if (config.freq !== 'DAILY' && config.freq !== 'WEEKLY') {
    errors.push('freq must be DAILY or WEEKLY');
  }

  if (
    !Number.isInteger(config.interval) ||
    config.interval < 1 ||
    config.interval > 365
  ) {
    errors.push('interval must be an integer between 1 and 365');
  }

  // Validate count if provided
  if (config.count !== undefined) {
    if (!Number.isInteger(config.count) || config.count <= 0) {
      errors.push('count must be an integer > 0');
    }
  }

  // Validate until if provided
  if (config.until !== undefined) {
    if (!(config.until instanceof Date) || isNaN(config.until.getTime())) {
      errors.push('until must be a valid Date');
    }
  }

  // Check mutual exclusion and date comparison only if we have valid dates
  if (config.count !== undefined && config.until !== undefined) {
    errors.push('COUNT and UNTIL are mutually exclusive');
  } else if (
    config.dtstart instanceof Date &&
    !isNaN(config.dtstart.getTime()) &&
    config.until instanceof Date &&
    !isNaN(config.until.getTime()) &&
    config.until.getTime() <= config.dtstart.getTime()
  ) {
    errors.push('until must be after dtstart');
  }

  if (
    config.freq === 'WEEKLY' &&
    config.byweekday &&
    config.byweekday.some((d) => d < 1 || d > 7)
  ) {
    errors.push('byweekday must contain ISO weekdays 1..7');
  }

  // BYDAY is only applicable to WEEKLY; not required. If provided for DAILY, reject.
  if (config.freq === 'DAILY' && config.byweekday && config.byweekday.length) {
    errors.push('byweekday is only allowed with WEEKLY');
  }

  return {
    ok: errors.length === 0,
    errors: errors.length ? errors : undefined,
  };
}
