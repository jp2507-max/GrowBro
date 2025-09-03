/**
 * Utility functions for date calculations and manipulations
 */

import { DateTime } from 'luxon';

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
