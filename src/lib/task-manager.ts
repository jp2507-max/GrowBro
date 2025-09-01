import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import * as rrule from '@/lib/rrule';
import { TaskNotificationService } from '@/lib/task-notifications';
import { database } from '@/lib/watermelon';
import type { OccurrenceOverrideModel } from '@/lib/watermelon-models/occurrence-override';
import type { SeriesModel } from '@/lib/watermelon-models/series';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type { OccurrenceOverride, Series, Task } from '@/types/calendar';

export type CreateTaskInput = {
  title: string;
  description?: string;
  timezone: string; // IANA, e.g. Europe/Berlin
  dueAtLocal?: string; // ISO with timezone
  dueAtUtc?: string; // ISO UTC
  reminderAtLocal?: string; // ISO with timezone
  reminderAtUtc?: string; // ISO UTC
  plantId?: string;
  seriesId?: string; // optional link to a series occurrence
};

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'seriesId'>> & {
  status?: Task['status'];
  completedAt?: string | null; // ISO timestamptz
};

export type DateRange = { start: Date; end: Date; timezone: string };

type TaskRepositories = {
  tasks: any;
  series: any;
  overrides: any;
};

function getRepos(): TaskRepositories {
  return {
    tasks: database.collections.get('tasks' as any),
    series: database.collections.get('series' as any),
    overrides: database.collections.get('occurrence_overrides' as any),
  } as TaskRepositories;
}

function toUtcIso(isoWithZone: string): string {
  const dt = DateTime.fromISO(isoWithZone);
  const iso = dt.toUTC().toISO();
  if (!iso) throw new Error(`Invalid ISO string: ${isoWithZone}`);
  return iso;
}

function ensureDualTimestamps(
  input: Pick<CreateTaskInput, 'dueAtLocal' | 'dueAtUtc' | 'timezone'>
): { dueAtLocal: string; dueAtUtc: string } {
  if (input.dueAtLocal) {
    return {
      dueAtLocal: input.dueAtLocal,
      dueAtUtc: toUtcIso(input.dueAtLocal),
    };
  }
  if (input.dueAtUtc) {
    const dt = DateTime.fromISO(input.dueAtUtc, { zone: 'utc' }).setZone(
      input.timezone
    );
    const dueAtLocal = dt.toISO();
    if (!dueAtLocal)
      throw new Error(`Invalid timezone conversion for: ${input.dueAtUtc}`);
    return { dueAtLocal, dueAtUtc: input.dueAtUtc };
  }
  throw new Error('Either dueAtLocal or dueAtUtc must be provided');
}

function maybeDualReminder(
  input: Pick<CreateTaskInput, 'reminderAtLocal' | 'reminderAtUtc' | 'timezone'>
): { reminderAtLocal?: string; reminderAtUtc?: string } {
  if (input.reminderAtLocal) {
    return {
      reminderAtLocal: input.reminderAtLocal,
      reminderAtUtc: toUtcIso(input.reminderAtLocal),
    };
  }
  if (input.reminderAtUtc) {
    const dt = DateTime.fromISO(input.reminderAtUtc, { zone: 'utc' }).setZone(
      input.timezone
    );
    const reminderAtLocal = dt.toISO();
    if (!reminderAtLocal)
      throw new Error(
        `Invalid timezone conversion for reminder: ${input.reminderAtUtc}`
      );
    return { reminderAtLocal, reminderAtUtc: input.reminderAtUtc };
  }
  return {};
}

function toOccurrenceLocalDate(d: Date, zone: string): string {
  return DateTime.fromJSDate(d, { zone }).toFormat('yyyy-LL-dd');
}

function sameLocalDay(aIsoWithZone: string, bIsoWithZone: string): boolean {
  const a = DateTime.fromISO(aIsoWithZone);
  const b = DateTime.fromISO(bIsoWithZone);
  return a.hasSame(b, 'day');
}

async function getSeriesOverrides(
  seriesId: string
): Promise<OccurrenceOverride[]> {
  const repos = getRepos();
  const rows = await repos.overrides
    .query(Q.where('series_id', seriesId))
    .fetch();
  return rows.map((r: any) => ({
    id: r.id,
    seriesId: r.seriesId,
    occurrenceLocalDate: r.occurrenceLocalDate,
    dueAtLocal: r.dueAtLocal,
    dueAtUtc: r.dueAtUtc,
    reminderAtLocal: r.reminderAtLocal,
    reminderAtUtc: r.reminderAtUtc,
    status: r.status as OccurrenceOverride['status'],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

function toTaskFromModel(model: TaskModel): Task {
  const m = model as any;
  return {
    id: m.id,
    seriesId: m.seriesId,
    title: m.title,
    description: m.description,
    dueAtLocal: m.dueAtLocal,
    dueAtUtc: m.dueAtUtc,
    timezone: m.timezone,
    reminderAtLocal: m.reminderAtLocal,
    reminderAtUtc: m.reminderAtUtc,
    plantId: m.plantId,
    status: m.status as Task['status'],
    completedAt: m.completedAt?.toISOString(),
    metadata: m.metadata,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    deletedAt: m.deletedAt?.toISOString(),
  };
}

function toSeriesFromModel(model: SeriesModel): Series {
  const m = model as any;
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    dtstartLocal: m.dtstartLocal,
    dtstartUtc: m.dtstartUtc,
    timezone: m.timezone,
    rrule: m.rrule,
    untilUtc: m.untilUtc,
    count: m.count,
    plantId: m.plantId,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    deletedAt: m.deletedAt?.toISOString(),
  };
}

async function materializeNextOccurrence(
  series: Series,
  afterLocalIso: string
): Promise<Task | null> {
  const overrides = await getSeriesOverrides(series.id);
  const start = DateTime.fromISO(afterLocalIso).plus({ second: 1 }).toJSDate();
  const end = DateTime.fromJSDate(start).plus({ years: 1 }).toJSDate();

  const config = rrule.parseRule(series.rrule, series.dtstartUtc);
  const iter = rrule
    .buildIterator({
      config,
      overrides,
      range: { start, end, timezone: series.timezone },
    })
    [Symbol.iterator]();
  const first = iter.next();
  if (first.done) return null;
  const { local, utc } = first.value;

  const repos = getRepos();
  let created: TaskModel | null = null;
  await database.write(async () => {
    created = await (repos.tasks as any).create((rec: TaskModel) => {
      const r = rec as any;
      r.seriesId = series.id;
      r.title = series.title;
      r.description = series.description;
      r.dueAtLocal = DateTime.fromJSDate(local, {
        zone: series.timezone,
      }).toISO();
      r.dueAtUtc = DateTime.fromJSDate(utc, { zone: 'utc' }).toISO();
      r.timezone = series.timezone;
      r.status = 'pending' as Task['status'];
      r.metadata = {};
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });
  });
  return created ? toTaskFromModel(created) : null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const repos = getRepos();
  const { dueAtLocal, dueAtUtc } = ensureDualTimestamps(input);
  const { reminderAtLocal, reminderAtUtc } = maybeDualReminder(input);

  let created: TaskModel | null = null;
  await database.write(async () => {
    created = await (repos.tasks as any).create((rec: TaskModel) => {
      const r = rec as any;
      r.seriesId = input.seriesId;
      r.title = input.title;
      r.description = input.description;
      r.dueAtLocal = dueAtLocal;
      r.dueAtUtc = dueAtUtc;
      r.timezone = input.timezone;
      r.reminderAtLocal = reminderAtLocal as any;
      r.reminderAtUtc = reminderAtUtc as any;
      r.plantId = input.plantId;
      r.status = 'pending' as Task['status'];
      r.metadata = {};
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });
  });
  if (!created) throw new Error('Failed to create task');
  return toTaskFromModel(created);
}

export async function updateTask(
  id: string,
  updates: UpdateTaskInput
): Promise<Task> {
  const repos = getRepos();
  const task = (await (repos.tasks as any).find(id)) as TaskModel;
  await database.write(async () => {
    await (task as any).update((rec: TaskModel) => {
      const r = rec as any;
      if (updates.title !== undefined) r.title = updates.title;
      if (updates.description !== undefined)
        r.description = updates.description;
      if (updates.timezone) r.timezone = updates.timezone;

      if (updates.dueAtLocal || updates.dueAtUtc) {
        const dual = ensureDualTimestamps({
          dueAtLocal: updates.dueAtLocal,
          dueAtUtc: updates.dueAtUtc,
          timezone: updates.timezone ?? (task as any).timezone,
        });
        r.dueAtLocal = dual.dueAtLocal;
        r.dueAtUtc = dual.dueAtUtc;
      }
      if (updates.reminderAtLocal || updates.reminderAtUtc) {
        const dual = maybeDualReminder({
          reminderAtLocal: updates.reminderAtLocal,
          reminderAtUtc: updates.reminderAtUtc,
          timezone: updates.timezone ?? (task as any).timezone,
        });
        r.reminderAtLocal = dual.reminderAtLocal as any;
        r.reminderAtUtc = dual.reminderAtUtc as any;
      }

      if (updates.status) r.status = updates.status as Task['status'];
      if (updates.completedAt !== undefined) {
        r.completedAt = updates.completedAt
          ? new Date(updates.completedAt)
          : undefined;
      }

      r.updatedAt = new Date();
    });
  });
  // If task reminder/due fields changed or status changed to completed, replan notifications
  if (
    updates.reminderAtLocal !== undefined ||
    updates.reminderAtUtc !== undefined ||
    updates.dueAtLocal !== undefined ||
    updates.dueAtUtc !== undefined ||
    updates.status === 'completed'
  ) {
    if (process.env.JEST_WORKER_ID === undefined) {
      await TaskNotificationService.cancelForTask(id);
      const updatedTask = toTaskFromModel(task);
      if (
        updatedTask.status === 'pending' &&
        (updatedTask.reminderAtUtc || updatedTask.dueAtUtc)
      ) {
        const notifier = new TaskNotificationService();
        await notifier.scheduleTaskReminder(updatedTask as any);
      }
    }
  }
  return toTaskFromModel(task);
}

export async function deleteTask(id: string): Promise<void> {
  const repos = getRepos();
  const task = (await (repos.tasks as any).find(id)) as TaskModel;
  if (process.env.JEST_WORKER_ID === undefined) {
    await TaskNotificationService.cancelForTask(id);
  }
  await database.write(async () => {
    await (task as any).update((rec: TaskModel) => {
      const r = rec as any;
      r.deletedAt = new Date();
      r.updatedAt = new Date();
    });
  });
}

export async function getTasksByDateRange(
  start: Date,
  end: Date
): Promise<Task[]> {
  const repos = getRepos();
  const allTasks = await (repos.tasks as any).query().fetch();
  const pendingInRange = allTasks
    .filter((t: any) => t.status === ('pending' as any))
    .filter((t: any) => {
      const due = DateTime.fromISO((t as any).dueAtLocal);
      return due.toJSDate() >= start && due.toJSDate() <= end;
    })
    .map(toTaskFromModel);

  const allSeries = await (repos.series as any).query().fetch();
  const visible: Task[] = [...pendingInRange];

  for (const s of allSeries as SeriesModel[]) {
    const series = toSeriesFromModel(s as any);
    const overrides = await getSeriesOverrides(series.id);
    const config = rrule.parseRule(series.rrule, series.dtstartUtc);
    const range = { start, end, timezone: series.timezone };

    // Avoid duplicate materialized occurrences already stored in tasks
    const materializedForSeries = pendingInRange.filter(
      (t: Task) => t.seriesId === series.id
    );

    for (const { local, utc } of rrule.buildIterator({
      config,
      overrides,
      range,
    })) {
      const localIso = DateTime.fromJSDate(local, {
        zone: series.timezone,
      }).toISO();
      const already = materializedForSeries.find((t: Task) =>
        sameLocalDay(t.dueAtLocal!, localIso!)
      );
      if (already) continue;

      const ephemeralId = `series:${series.id}:${toOccurrenceLocalDate(
        local,
        series.timezone
      )}`;
      visible.push({
        id: ephemeralId,
        seriesId: series.id,
        title: series.title,
        description: series.description,
        dueAtLocal: localIso,
        dueAtUtc: DateTime.fromJSDate(utc, { zone: 'utc' }).toISO(),
        timezone: series.timezone,
        status: 'pending',
        metadata: { ephemeral: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as unknown as Task);
    }
  }

  return visible.sort((a, b) => (a.dueAtLocal < b.dueAtLocal ? -1 : 1));
}

export async function completeTask(id: string): Promise<Task> {
  const repos = getRepos();
  const task = (await (repos.tasks as any).find(id)) as TaskModel;
  const seriesId = (task as any).seriesId as string | undefined;
  let updated: TaskModel | null = null;
  await database.write(async () => {
    updated = await (task as any).update((rec: TaskModel) => {
      const r = rec as any;
      r.status = 'completed' as Task['status'];
      r.completedAt = new Date();
      r.updatedAt = new Date();
    });
  });

  // Cancel associated notifications on completion
  await TaskNotificationService.cancelForTask(id);

  // Materialize the next occurrence for recurring tasks
  if (seriesId) {
    const seriesModel = (await (repos.series as any).find(
      seriesId
    )) as SeriesModel;
    await materializeNextOccurrence(
      toSeriesFromModel(seriesModel as any),
      (task as any).dueAtLocal
    );
  }

  return toTaskFromModel((updated as any) ?? task);
}

export async function skipRecurringInstance(
  seriesId: string,
  occurrenceDate: Date
): Promise<void> {
  const repos = getRepos();
  const series = (await (repos.series as any).find(seriesId)) as SeriesModel;
  const zone = (series as any).timezone as string;
  const day = toOccurrenceLocalDate(occurrenceDate, zone);
  await database.write(async () => {
    await (repos.overrides as any).create((rec: OccurrenceOverrideModel) => {
      const r = rec as any;
      r.seriesId = seriesId;
      r.occurrenceLocalDate = day;
      r.status = 'skip' as any;
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });
  });
}

export async function completeRecurringInstance(
  seriesId: string,
  occurrenceDate: Date
): Promise<void> {
  const repos = getRepos();
  const seriesModel = (await (repos.series as any).find(
    seriesId
  )) as SeriesModel;
  const series = toSeriesFromModel(seriesModel as any);
  const zone = series.timezone;
  const day = toOccurrenceLocalDate(occurrenceDate, zone);

  // Compute occurrence due timestamps using the series DTSTART time-of-day
  const dtstartLocal = DateTime.fromISO(series.dtstartLocal);
  const occurrenceLocal = DateTime.fromISO(
    `${day}T${dtstartLocal.toFormat('HH:mm:ss')}`,
    { zone }
  );
  const occurrenceUtc = occurrenceLocal.toUTC();

  // 1) Create a completed materialized task to preserve precise completion timestamp
  // 2) Create a skip override to suppress this occurrence in iterator output
  await database.write(async () => {
    await (repos.tasks as any).create((rec: TaskModel) => {
      const r = rec as any;
      r.seriesId = series.id;
      r.title = series.title;
      r.description = series.description;
      r.dueAtLocal = occurrenceLocal.toISO();
      r.dueAtUtc = occurrenceUtc.toISO();
      r.timezone = zone;
      r.status = 'completed' as Task['status'];
      r.completedAt = new Date();
      r.metadata = {};
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });

    await (repos.overrides as any).create((rec: OccurrenceOverrideModel) => {
      const r = rec as any;
      r.seriesId = seriesId;
      r.occurrenceLocalDate = day;
      r.status = 'skip' as any;
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });
  });

  // Then materialize next occurrence
  const nextOccurrenceIso = occurrenceLocal.toISO();
  if (!nextOccurrenceIso)
    throw new Error('Failed to generate ISO for next occurrence');
  await materializeNextOccurrence(series, nextOccurrenceIso);
}

// Series CRUD
export type CreateSeriesInput = {
  title: string;
  description?: string;
  dtstartLocal: string; // ISO with timezone
  dtstartUtc: string; // ISO UTC
  timezone: string;
  rrule: string;
  untilUtc?: string;
  count?: number;
  plantId?: string;
};

export async function createSeries(input: CreateSeriesInput): Promise<Series> {
  const repos = getRepos();
  let created: SeriesModel | null = null;
  await database.write(async () => {
    created = await (repos.series as any).create((rec: SeriesModel) => {
      const r = rec as any;
      r.title = input.title;
      r.description = input.description;
      r.dtstartLocal = input.dtstartLocal;
      r.dtstartUtc = input.dtstartUtc;
      r.timezone = input.timezone;
      r.rrule = input.rrule;
      r.count = input.count as any;
      r.untilUtc = input.untilUtc as any;
      r.plantId = input.plantId as any;
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });
  });
  if (!created) throw new Error('Failed to create series');
  return toSeriesFromModel(created);
}

export async function updateSeries(
  id: string,
  updates: Partial<CreateSeriesInput>
): Promise<Series> {
  const repos = getRepos();
  const series = (await (repos.series as any).find(id)) as SeriesModel;
  await database.write(async () => {
    await (series as any).update((rec: SeriesModel) => {
      const r = rec as any;
      if (updates.title !== undefined) r.title = updates.title;
      if (updates.description !== undefined)
        r.description = updates.description;
      if (updates.dtstartLocal !== undefined)
        r.dtstartLocal = updates.dtstartLocal;
      if (updates.dtstartUtc !== undefined) r.dtstartUtc = updates.dtstartUtc;
      if (updates.timezone !== undefined) r.timezone = updates.timezone;
      if (updates.rrule !== undefined) r.rrule = updates.rrule;
      if (updates.untilUtc !== undefined) r.untilUtc = updates.untilUtc as any;
      if (updates.count !== undefined) r.count = updates.count as any;
      if (updates.plantId !== undefined) r.plantId = updates.plantId as any;
      r.updatedAt = new Date();
    });
  });
  return toSeriesFromModel(series);
}

export async function deleteSeries(id: string): Promise<void> {
  const repos = getRepos();
  const series = (await (repos.series as any).find(id)) as SeriesModel;
  await database.write(async () => {
    await (series as any).update((rec: SeriesModel) => {
      const r = rec as any;
      r.deletedAt = new Date();
      r.updatedAt = new Date();
    });
  });
}
