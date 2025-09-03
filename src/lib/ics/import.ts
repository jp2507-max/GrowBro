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

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parseIcsDate(
  value: string,
  tz?: string
): ParseResult<{ localIso?: string; utcIso?: string }> {
  if (value.endsWith('Z')) {
    const dt = DateTime.fromFormat(value, "yyyyLLdd'T'HHmmss'Z'", {
      zone: 'utc',
    });
    if (!dt.isValid) {
      return { ok: false, error: `Invalid UTC datetime format: "${value}"` };
    }
    const utcIso = dt.toISO();
    if (!utcIso) {
      return {
        ok: false,
        error: `Failed to convert UTC datetime to ISO: "${value}"`,
      };
    }
    if (tz) {
      const localDt = dt.setZone(tz);
      if (!localDt.isValid) {
        return {
          ok: false,
          error: `Invalid timezone "${tz}" for UTC datetime: "${value}"`,
        };
      }
      const localIso = localDt.toISO();
      return { ok: true, value: { localIso: localIso ?? undefined, utcIso } };
    }
    return { ok: true, value: { utcIso } };
  }
  // Floating or TZID local time
  const dt = DateTime.fromFormat(value, "yyyyLLdd'T'HHmmss", {
    zone: tz ?? 'utc',
  });
  if (!dt.isValid) {
    return {
      ok: false,
      error: `Invalid datetime format: "${value}" with timezone "${tz ?? 'utc'}"`,
    };
  }
  const localIso = dt.toISO();
  const utcDt = dt.toUTC();
  if (!utcDt.isValid) {
    return {
      ok: false,
      error: `Failed to convert to UTC: "${value}" with timezone "${tz ?? 'utc'}"`,
    };
  }
  const utcIso = utcDt.toISO();
  return {
    ok: true,
    value: { localIso: localIso ?? undefined, utcIso: utcIso ?? undefined },
  };
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

// Unfold folded lines in ICS format (lines that continue with space/tab after CRLF/LF)
function unfoldIcsLines(icsText: string): string {
  return icsText.replace(/\r?\n[ \t]/g, '');
}

// Extract VEVENT blocks using robust regex that handles multiline content
function extractVeventBlocks(icsText: string): string[] {
  const unfolded = unfoldIcsLines(icsText);
  const veventRegex = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g;
  const matches = unfolded.match(veventRegex);
  return matches || [];
}

export function importIcs(
  icsText: string,
  opts: {
    timezoneFallback: string;
    existingTasks?: Pick<Task, 'id' | 'dueAtLocal' | 'title'>[];
    existingSeries?: Pick<Series, 'id' | 'dtstartLocal' | 'title'>[];
  }
): IcsImportResult {
  const vevents = extractVeventBlocks(icsText);

  const tasks: CreateTaskInput[] = [];
  const series: (Omit<CreateSeriesInput, 'dtstartUtc'> & {
    dtstartUtc: string;
  })[] = [];
  const duplicates: { uid: string; title?: string }[] = [];

  for (const v of vevents) {
    const ev = parseVevent(v);
    if (!ev || !ev.dtstart || !ev.summary) continue;

    const tz = ev.dtstart.tz ?? opts.timezoneFallback;
    const parseResult = parseIcsDate(ev.dtstart.value, tz);
    if (!parseResult.ok) {
      console.error(
        `Failed to parse ICS date "${ev.dtstart.value}" with timezone "${tz}": ${(parseResult as { ok: false; error: string }).error}`
      );
      continue;
    }
    const { localIso, utcIso } = parseResult.value;
    if (!localIso || !utcIso) {
      console.error(
        `Parsed ICS date resulted in empty values for "${ev.dtstart.value}" with timezone "${tz}"`
      );
      continue;
    }

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
