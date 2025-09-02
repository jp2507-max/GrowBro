/**
 * Utility functions for date calculations and manipulations
 */

/**
 * Combines a target date with time components from an original date.
 * This preserves the time of day (hours, minutes, seconds, milliseconds)
 * while changing the date part to the target date.
 *
 * @param targetDate - The date to use for the new date
 * @param originalDateTime - The original date/time to extract time components from
 * @returns A new Date object with targetDate's date and originalDateTime's time
 */
export function combineTargetDateWithTime(
  targetDate: Date,
  originalDateTime: Date
): Date {
  return new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    originalDateTime.getHours(),
    originalDateTime.getMinutes(),
    originalDateTime.getSeconds(),
    originalDateTime.getMilliseconds()
  );
}
