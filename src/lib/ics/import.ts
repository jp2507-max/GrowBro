import { DateTime } from 'luxon';

import type { CreateSeriesInput, CreateTaskInput } from '@/lib/task-manager';
import type { Series, Task } from '@/types/calendar';

export type IcsImportResult = {
  series: (Omit<CreateSeriesInput, 'dtstartUtc'> & { dtstartUtc: string })[];
  tasks: CreateTaskInput[];
  duplicates: { uid: string; title?: string }[];
};

type ParsedEvent = {
  uid?: string;
  summary?: string;
  description?: string;
  dtstart?: { tz?: string; value: string; isUtc: boolean };
  rrule?: string;
  valarm?: { triggerUtc?: string };
};

function parseIcsDate(
  value: string,
  tz?: string
): { localIso?: string; utcIso?: string } {
  if (value.endsWith('Z')) {
    const dt = DateTime.fromFormat(value, "yyyyLLdd'T'HHmmss'Z'", {
      zone: 'utc',
    });
    const utcIso = dt.toISO();
    if (!utcIso) return {};
    if (tz) {
      const localIso = dt.setZone(tz).toISO();
      return { localIso: localIso ?? undefined, utcIso };
    }
    return { utcIso };
  }
  // Floating or TZID local time
  const dt = DateTime.fromFormat(value, "yyyyLLdd'T'HHmmss", {
    zone: tz ?? 'utc',
  });
  const localIso = dt.toISO();
  const utcIso = dt.toUTC().toISO();
  return { localIso: localIso ?? undefined, utcIso: utcIso ?? undefined };
}

function parseVevent(block: string): ParsedEvent | null {
  const lines = block.split(/\r?\n/);
  const ev: ParsedEvent = {};
  let inAlarm = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line === 'BEGIN:VALARM') {
      inAlarm = true;
      continue;
    }
    if (line === 'END:VALARM') {
      inAlarm = false;
      continue;
    }
    if (line.startsWith('UID:')) ev.uid = line.slice(4);
    else if (line.startsWith('SUMMARY:')) ev.summary = line.slice(8);
    else if (line.startsWith('DESCRIPTION:')) ev.description = line.slice(12);
    else if (line.startsWith('DTSTART')) {
      const m = line.match(/^DTSTART(?:;TZID=([^:;]+))?:(.+)$/);
      if (m) {
        const tz = m[1];
        const value = m[2];
        const isUtc = value.endsWith('Z');
        ev.dtstart = { tz, value, isUtc };
      }
    } else if (line.startsWith('RRULE:')) {
      ev.rrule = line.slice(6);
    } else if (inAlarm && line.startsWith('TRIGGER')) {
      const m = line.match(/:(.+)$/);
      if (m) {
        const v = m[1];
        if (v.endsWith('Z'))
          ev.valarm = {
            triggerUtc:
              DateTime.fromFormat(v, "yyyyLLdd'T'HHmmss'Z'", {
                zone: 'utc',
              }).toISO() ?? undefined,
          };
      }
    }
  }
  if (!ev.summary || !ev.dtstart) return null;
  return ev;
}

function isDuplicateForDay(
  title: string,
  localIso: string,
  opts: {
    existingTasks?: Pick<Task, 'id' | 'dueAtLocal' | 'title'>[];
    existingSeries?: Pick<Series, 'id' | 'dtstartLocal' | 'title'>[];
  }
): { task: boolean; series: boolean; dayKey: string } {
  const dayKey = DateTime.fromISO(localIso).toISODate() ?? '';
  const task = Boolean(
    opts.existingTasks?.some(
      (t) =>
        t.title === title &&
        DateTime.fromISO(t.dueAtLocal).toISODate() === dayKey
    )
  );
  const series = Boolean(
    opts.existingSeries?.some(
      (s) =>
        s.title === title &&
        DateTime.fromISO(s.dtstartLocal).toISODate() === dayKey
    )
  );
  return { task, series, dayKey };
}

function pushRecurring(
  acc: (Omit<CreateSeriesInput, 'dtstartUtc'> & { dtstartUtc: string })[],
  ev: ParsedEvent,
  meta: {
    title: string;
    description?: string;
    tz: string;
    localIso: string;
    utcIso: string;
  }
): void {
  acc.push({
    title: meta.title,
    description: meta.description,
    dtstartLocal: meta.localIso,
    dtstartUtc: meta.utcIso,
    timezone: meta.tz,
    rrule: ev.rrule!,
  });
}

function pushSingle(
  acc: CreateTaskInput[],
  ev: ParsedEvent,
  meta: {
    title: string;
    description?: string;
    tz: string;
    localIso: string;
    utcIso: string;
  }
): void {
  acc.push({
    title: meta.title,
    description: meta.description,
    timezone: meta.tz,
    dueAtLocal: meta.localIso,
    dueAtUtc: meta.utcIso,
    reminderAtUtc: ev.valarm?.triggerUtc,
  });
}

export function importIcs(
  icsText: string,
  opts: {
    timezoneFallback: string;
    existingTasks?: Pick<Task, 'id' | 'dueAtLocal' | 'title'>[];
    existingSeries?: Pick<Series, 'id' | 'dtstartLocal' | 'title'>[];
  }
): IcsImportResult {
  const vevents = icsText
    .split('BEGIN:VEVENT')
    .slice(1)
    .map((chunk) => `BEGIN:VEVENT${chunk.split('END:VEVENT')[0]}END:VEVENT`);

  const tasks: CreateTaskInput[] = [];
  const series: (Omit<CreateSeriesInput, 'dtstartUtc'> & {
    dtstartUtc: string;
  })[] = [];
  const duplicates: { uid: string; title?: string }[] = [];

  for (const v of vevents) {
    const ev = parseVevent(v);
    if (!ev || !ev.dtstart || !ev.summary) continue;

    const tz = ev.dtstart.tz ?? opts.timezoneFallback;
    const { localIso, utcIso } = parseIcsDate(ev.dtstart.value, tz);
    if (!localIso || !utcIso) continue;

    const title = ev.summary;
    const description = ev.description;
    const dup = isDuplicateForDay(title, localIso, opts);
    const uid = ev.uid ?? `${title}:${dup.dayKey}`;

    if (ev.rrule) {
      if (dup.series) {
        duplicates.push({ uid, title });
        continue;
      }
      pushRecurring(series, ev, { title, description, tz, localIso, utcIso });
    } else {
      if (dup.task) {
        duplicates.push({ uid, title });
        continue;
      }
      pushSingle(tasks, ev, { title, description, tz, localIso, utcIso });
    }
  }

  return { series, tasks, duplicates };
}
