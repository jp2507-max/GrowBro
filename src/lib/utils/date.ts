/**
 * Utility functions for date calculations and manipulations
 */

import { DateTime } from 'luxon';

/**
 * Branded type for UTC ISO strings to ensure type safety
 */
export type UtcIsoString = string & { readonly __utc: unique symbol };

/**
 * Parses an ISO-8601 UTC date string and returns a UTC DateTime
 * @param utcDateString - ISO-8601 UTC date string (e.g., '2025-08-31T00:00:00Z')
 * @returns Luxon DateTime in UTC timezone
 */
export function parseUtcDateString(utcDateString: UtcIsoString): DateTime {
  const dt = DateTime.fromISO(utcDateString, { setZone: true });
  if (!dt.isValid) {
    throw new Error('Invalid ISO-8601 date string');
  }
  if (dt.offset !== 0) {
    throw new Error('Date string must be UTC (Z/+00:00)');
  }
  return dt.toUTC();
}

/**
 * Checks if the current UTC time is after the specified UTC date
 * @param utcDateString - ISO-8601 UTC date string to compare against
 * @returns true if current time is after the specified date
 */
export function isUtcTimeAfter(utcDateString: UtcIsoString): boolean {
  const targetDate = parseUtcDateString(utcDateString);
  const now = DateTime.utc();
  return now.toMillis() > targetDate.toMillis();
}

/**
 * Checks if the current UTC time is before the specified UTC date
 * @param utcDateString - ISO-8601 UTC date string to compare against
 * @returns true if current time is before the specified date
 */
export function isUtcTimeBefore(utcDateString: UtcIsoString): boolean {
  const targetDate = parseUtcDateString(utcDateString);
  const now = DateTime.utc();
  return now.toMillis() < targetDate.toMillis();
}

export type DateCombinationResult = {
  localDateTime: DateTime;
  utcDate: Date;
  utcDateTime: DateTime;
};

/**
 * Combines a target date with time components from an original date in a timezone-safe manner.
 * This preserves the time of day (hours, minutes, seconds, milliseconds) in the specified timezone
 * while changing the date part to the target date, handling DST transitions correctly.
 *
 * @param targetDate - The date to use for the new date (interpreted as a local date in the target timezone)
 * @param originalDateTime - The original date/time to extract time components from
 * @param timezone - IANA timezone string (e.g., 'America/New_York', 'Europe/London')
 * @returns An object containing both the local DateTime in the target timezone and UTC-normalized versions
 */
export function combineTargetDateWithTime(
  targetDate: Date,
  originalDateTime: Date,
  timezone: string
): DateCombinationResult {
  // Convert original date to DateTime in the specified timezone
  const originalLocal = DateTime.fromJSDate(originalDateTime, {
    zone: timezone,
  });

  // Extract time components from the original date in local timezone
  const hour = originalLocal.hour;
  const minute = originalLocal.minute;
  const second = originalLocal.second;
  const millisecond = originalLocal.millisecond;

  // Create target date as DateTime in the specified timezone
  // Extract date components from targetDate and create a new DateTime in the target timezone
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth() + 1; // JS months are 0-based, Luxon months are 1-based
  const targetDay = targetDate.getDate();

  // Create the combined datetime in the target timezone
  const targetLocal = DateTime.fromObject(
    {
      year: targetYear,
      month: targetMonth,
      day: targetDay,
      hour,
      minute,
      second,
      millisecond,
    },
    { zone: timezone }
  );

  // Convert to UTC for storage/normalization
  const utcDateTime = targetLocal.toUTC();
  const utcDate = utcDateTime.toJSDate();

  return {
    localDateTime: targetLocal,
    utcDate,
    utcDateTime,
  };
}
