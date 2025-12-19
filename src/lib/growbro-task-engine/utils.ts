import { DateTime } from 'luxon';

import type { GrowMedium } from './types';

/**
 * Parse pot size string to liters (e.g., "10L", "10 L", "10", "3 gal")
 */
export function parsePotSizeLiters(potSize: string | undefined): number {
  if (!potSize) return 10; // Default to 10L

  const normalized = potSize.trim().toLowerCase();

  // Check for gallon notation
  const galMatch = normalized.match(/^([\d.]+)\s*(?:gal|gallon|gallons?)$/i);
  if (galMatch) {
    const gallons = parseFloat(galMatch[1]);
    return Math.round(gallons * 3.785); // Convert gallons to liters
  }

  // Check for liter notation or bare number
  const literMatch = normalized.match(/^([\d.]+)\s*(?:l|liter|liters?)?$/i);
  if (literMatch) {
    return parseFloat(literMatch[1]);
  }

  return 10; // Default fallback
}

/**
 * Calculate days since a given start date
 */
export function daysSince(startDate: Date, now: Date = new Date()): number {
  const start = DateTime.fromJSDate(startDate).startOf('day');
  const current = DateTime.fromJSDate(now).startOf('day');
  return Math.floor(current.diff(start, 'days').days);
}

/**
 * Build ISO local and UTC timestamps for a given date in a timezone
 */
export function buildDtstartTimestamps(
  date: Date,
  timezone: string
): { dtstartLocal: string; dtstartUtc: string } {
  const dt = DateTime.fromJSDate(date, { zone: timezone });
  const dtstartLocal = dt.toISO();
  const dtstartUtc = dt.toUTC().toISO();

  if (!dtstartLocal || !dtstartUtc) {
    throw new Error(
      `Failed to generate timestamps for date ${date} in timezone ${timezone}`
    );
  }

  return { dtstartLocal, dtstartUtc };
}

/**
 * Build an UNTIL timestamp in UTC (RFC-5545 format for RRULE)
 */
export function buildUntilUtc(date: Date): string {
  return DateTime.fromJSDate(date).toUTC().toISO()!;
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  return DateTime.fromJSDate(date).plus({ days }).toJSDate();
}

/**
 * Determine watering interval based on medium and pot size
 */
export function getWateringInterval(
  medium: GrowMedium,
  potSizeLiters: number
): number {
  switch (medium) {
    case 'coco':
      return 1; // Daily
    case 'hydro':
      return 0; // No watering tasks for hydro
    case 'soil':
    case 'living_soil':
    case 'other':
    default:
      // Soil watering interval based on pot size
      if (potSizeLiters < 10) return 2;
      if (potSizeLiters > 25) return 4;
      return 3; // Default for 10-25L
  }
}
