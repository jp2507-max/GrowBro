import { DateTime } from 'luxon';

import type { Series, Task } from '@/types/calendar';

import { IcsFormat } from './format';

function header(prodId: string = '-//GrowBro//Calendar 2.0//EN'): string[] {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
  ];
}

function footer(): string[] {
  return ['END:VCALENDAR'];
}

function linesForTask(task: Task): string[] {
  const dtstamp = DateTime.utc().toISO();
  const uid = `${task.id}@growbro`;
  const lines: string[] = ['BEGIN:VEVENT'];

  const title = IcsFormat.escapeText(task.title) ?? '';
  if (task.description) {
    lines.push(`DESCRIPTION:${IcsFormat.escapeText(task.description)}`);
  }
  lines.push(`SUMMARY:${title}`);
  lines.push(`UID:${uid}`);
  if (dtstamp) lines.push(`DTSTAMP:${IcsFormat.toIcsDateTimeUtc(dtstamp)}`);

  if (task.dueAtLocal) {
    lines.push(
      `DTSTART;TZID=${task.timezone}:${IcsFormat.toIcsDateTimeLocal(
        task.dueAtLocal,
        task.timezone
      )}`
    );
  } else if (task.dueAtUtc) {
    lines.push(`DTSTART:${IcsFormat.toIcsDateTimeUtc(task.dueAtUtc)}`);
  }

  // Optional VALARM for reminder
  if (task.reminderAtUtc) {
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(`DESCRIPTION:${title}`);
    lines.push(
      `TRIGGER;VALUE=DATE-TIME:${IcsFormat.toIcsDateTimeUtc(task.reminderAtUtc)}`
    );
    lines.push('END:VALARM');
  }

  lines.push('END:VEVENT');
  return lines;
}

function rruleForSeries(series: Series): string | null {
  // Persist original RRULE as-is if available.
  return series.rrule ? `RRULE:${series.rrule}` : null;
}

function linesForSeries(series: Series): string[] {
  const dtstamp = DateTime.utc().toISO();
  const uid = `${series.id}@growbro`;
  const lines: string[] = ['BEGIN:VEVENT'];

  const title = IcsFormat.escapeText(series.title) ?? '';
  if (series.description) {
    lines.push(`DESCRIPTION:${IcsFormat.escapeText(series.description)}`);
  }
  lines.push(`SUMMARY:${title}`);
  lines.push(`UID:${uid}`);
  if (dtstamp) lines.push(`DTSTAMP:${IcsFormat.toIcsDateTimeUtc(dtstamp)}`);

  if (series.dtstartLocal) {
    lines.push(
      `DTSTART;TZID=${series.timezone}:${IcsFormat.toIcsDateTimeLocal(
        series.dtstartLocal,
        series.timezone
      )}`
    );
  } else if (series.dtstartUtc) {
    lines.push(`DTSTART:${IcsFormat.toIcsDateTimeUtc(series.dtstartUtc)}`);
  }

  const rule = rruleForSeries(series);
  if (rule) lines.push(rule);

  lines.push('END:VEVENT');
  return lines;
}

export function exportIcs(
  params:
    | { type: 'tasks'; prodId?: string; items: Task[] }
    | { type: 'series'; prodId?: string; items: Series[] }
): string {
  const begin = header(params.prodId);
  const body: string[] = [];
  if (params.type === 'tasks') {
    for (const t of params.items) body.push(...linesForTask(t));
  } else {
    for (const s of params.items) body.push(...linesForSeries(s));
  }
  const end = footer();
  return IcsFormat.build([...begin, ...body, ...end]);
}
