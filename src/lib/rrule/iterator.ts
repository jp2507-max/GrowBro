import { DateTime } from 'luxon';

import type { OccurrenceOverride } from '@/types/calendar';

import type { RRuleConfig, RRuleParse } from './types';
import { validate } from './validate';

type Range = { start: Date; end: Date; timezone: string };

function isWithinRange(d: Date, range: Range): boolean {
  return d >= range.start && d <= range.end;
}

function addDaysLocal(date: Date, days: number, zone: string): Date {
  const dt = DateTime.fromJSDate(date, { zone });
  return dt.plus({ days }).toJSDate();
}

function nextDaily(current: Date, interval: number, zone: string): Date {
  return addDaysLocal(current, interval, zone);
}

function nextWeekly(current: Date, interval: number, zone: string): Date {
  return addDaysLocal(current, interval * 7, zone);
}

function enumerateWeeklyByDays(
  anchor: Date,
  byweekday: number[],
  zone: string
): Date[] {
  // Generate local dates for ISO weekdays (1=Mon..7=Sun) in the ISO week of `anchor`.
  const base = DateTime.fromJSDate(anchor, { zone });
  const startOfIsoWeek = base.minus({ days: base.weekday - 1 }).startOf('day');
  return byweekday
    .slice()
    .sort((a, b) => a - b)
    .map((isoDay) => startOfIsoWeek.plus({ days: isoDay - 1 }).toJSDate());
}

function* processDaily(
  config: RRuleConfig,
  overrides: OccurrenceOverride[],
  context: { range: Range; zone: string; dtstartLocal: any }
) {
  const { range, zone } = context;
  let produced = 0;
  let cursorLocal = context.dtstartLocal;

  while (!shouldStopIteration(config, { cursorLocal, range, produced })) {
    const local = cursorLocal.toJSDate();
    produced++;
    if (isWithinRange(local, range)) {
      const overridden = applyOverrides(local, overrides, zone);
      if (overridden) yield overridden;
    }
    cursorLocal = DateTime.fromJSDate(nextDaily(local, config.interval, zone), {
      zone,
    });
  }
}

function* processWeekly(
  config: RRuleConfig,
  overrides: OccurrenceOverride[],
  context: { range: Range; zone: string; dtstartLocal: any }
) {
  const { range, zone } = context;
  let produced = 0;
  let cursorLocal = context.dtstartLocal;

  // Main iteration loop for weekly recurrence
  // FIXED: Process entire week before checking stop conditions to avoid premature exit
  // when UNTIL falls midweek. Ensures all valid occurrences within the week are yielded.
  while (!shouldStopIteration(config, { cursorLocal, range, produced })) {
    // Generate all dates for the current week
    // If byweekday is specified, enumerate all matching weekdays in this week
    // Otherwise, use the cursor date itself (DTSTART weekday)
    const weekDates =
      config.byweekday && config.byweekday.length
        ? enumerateWeeklyByDays(cursorLocal.toJSDate(), config.byweekday, zone)
        : [cursorLocal.toJSDate()];

    // Process each date within the current week
    for (const local of weekDates) {
      // Apply the original DTSTART time-of-day to each generated date
      const localDT = DateTime.fromJSDate(local, { zone }).set({
        hour: context.dtstartLocal.hour,
        minute: context.dtstartLocal.minute,
        second: context.dtstartLocal.second,
        millisecond: context.dtstartLocal.millisecond,
      });
      const localJS = localDT.toJSDate();

      // Skip dates that exceed the UNTIL date
      // FIXED: Since we now check stop conditions after processing the entire week,
      // this valid date will be reached even if UNTIL falls midweek
      if (config.until && localDT.toUTC().toJSDate() > config.until) {
        produced++;
        continue;
      }

      // Increment counter for valid dates (including those past UNTIL that we skipped)
      produced++;

      // Stop if we've reached the COUNT limit
      if (config.count !== undefined && produced > config.count) break;

      // Yield the date if it's within the requested range
      if (isWithinRange(localJS, range)) {
        const overridden = applyOverrides(localJS, overrides, zone);
        if (overridden) yield overridden;
      }
    }

    // Check stop conditions AFTER processing the entire current week
    // This ensures we don't exit prematurely when UNTIL falls midweek
    // The check now happens after all valid dates in the week have been yielded
    // Note: Loop condition now handles the stop logic

    // Advance to the next week based on interval
    cursorLocal = DateTime.fromJSDate(
      nextWeekly(cursorLocal.toJSDate(), config.interval, zone),
      { zone }
    );
  }
}

/**
 * Determines whether the iteration should stop based on the RRule configuration and current context.
 * Checks for range end, count limit, and until date conditions.
 */
function shouldStopIteration(
  config: RRuleConfig,
  context: { cursorLocal: any; range: Range; produced: number }
): boolean {
  const { cursorLocal, range, produced } = context;

  // If no count or until specified, stop when cursor exceeds range end
  if (!config.count && !config.until) {
    if (cursorLocal.toJSDate() > range.end) return true;
  }

  // Stop if the produced count reaches or exceeds the specified count
  if (config.count !== undefined && produced >= config.count) return true;

  // Stop if the cursor has passed the until date
  if (config.until && cursorLocal.toUTC().toJSDate() > config.until)
    return true;

  return false;
}

export function* buildIterator(params: {
  config: RRuleParse;
  overrides: OccurrenceOverride[];
  range: Range;
}): Iterable<{ local: Date; utc: Date }> {
  const { config: parsed, overrides, range } = params;
  const validated = validate(parsed);
  if (!validated.ok) {
    // Mirror TaskManager behaviour: warn and skip invalid series instead of throwing
    // No series id is available in this context, so include validation errors only.
    console.warn(
      `[RRule] Skipping invalid RRULE config: ${validated.errors?.join(', ')}`
    );
    return;
  }
  const config = parsed as unknown as RRuleConfig;
  const zone = range.timezone;
  const dtstartLocal = DateTime.fromJSDate(config.dtstart, { zone });

  if (!dtstartLocal.isValid) return;

  if (config.freq === 'DAILY') {
    yield* processDaily(config, overrides, { range, zone, dtstartLocal });
  } else if (config.freq === 'WEEKLY') {
    yield* processWeekly(config, overrides, { range, zone, dtstartLocal });
  }
}

function applyOverrides(
  localDate: Date,
  overrides: OccurrenceOverride[],
  zone: string
): { local: Date; utc: Date } | null {
  const localDay = DateTime.fromJSDate(localDate, { zone }).toFormat(
    'yyyy-LL-dd'
  );
  const ov = overrides.find((o) => o.occurrenceLocalDate === localDay);
  if (ov?.status === 'skip' || ov?.status === 'completed') return null;

  if (ov?.status === 'reschedule' && ov.dueAtLocal && ov.dueAtUtc) {
    return {
      local: DateTime.fromISO(ov.dueAtLocal as string, { zone }).toJSDate(),
      utc: DateTime.fromISO(ov.dueAtUtc as string, { zone: 'utc' }).toJSDate(),
    };
  }

  // Default: use localDate time-of-day as provided; compute UTC via timezone
  const local = DateTime.fromJSDate(localDate, { zone });
  return { local: local.toJSDate(), utc: local.toUTC().toJSDate() };
}
