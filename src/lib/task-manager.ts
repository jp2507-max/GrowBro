import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import {
  onSeriesOccurrenceCompleted,
  onTaskCompleted,
} from '@/lib/plant-telemetry';
import type { RRuleConfig } from '@/lib/rrule';
import * as rrule from '@/lib/rrule';
import { TaskNotificationService } from '@/lib/task-notifications';
import { database } from '@/lib/watermelon';
import type { OccurrenceOverrideModel } from '@/lib/watermelon-models/occurrence-override';
import type { SeriesModel } from '@/lib/watermelon-models/series';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type {
  OccurrenceOverride,
  Series,
  Task,
  TaskMetadata,
} from '@/types/calendar';

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
  metadata?: TaskMetadata;
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

  const parsed = rrule.parseRule(series.rrule, series.dtstartUtc);
  const validated = rrule.validate(parsed as any);
  if (!validated.ok) {
    console.warn(
      `[TaskManager] Skipping series ${series.id} due to invalid RRULE: ${validated.errors?.join(', ')}`
    );
    return null;
  }
  const config = parsed as unknown as RRuleConfig;
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
      r.plantId = series.plantId;
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

  // Schedule notifications for newly materialized tasks
  // This ensures users get reminders for recurring tasks immediately
  if (created && (created as any).dueAtUtc) {
    const task = toTaskFromModel(created);
    const notifier = new TaskNotificationService();
    await notifier.scheduleTaskReminder(task as any);
  }

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
      // Ensure plantId is set either from input or inherited via series on UI side
      r.dueAtLocal = dueAtLocal;
      r.dueAtUtc = dueAtUtc;
      r.timezone = input.timezone;
      r.reminderAtLocal = reminderAtLocal as any;
      r.reminderAtUtc = reminderAtUtc as any;
      r.plantId = input.plantId;
      r.status = 'pending' as Task['status'];
      r.metadata = input.metadata ?? {};
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });
  });
  if (!created) throw new Error('Failed to create task');

  // Schedule notifications for newly created tasks
  // This ensures users get reminders immediately without waiting for global rehydrate
  if ((created as any).reminderAtUtc || (created as any).dueAtUtc) {
    const task = toTaskFromModel(created);
    const notifier = new TaskNotificationService();
    await notifier.scheduleTaskReminder(task as any);
  }

  return toTaskFromModel(created);
}

function shouldUpdateDue(
  updates: UpdateTaskInput,
  originalTimezone: string
): boolean {
  return (
    (updates.timezone !== undefined && updates.timezone !== originalTimezone) ||
    updates.dueAtLocal !== undefined ||
    updates.dueAtUtc !== undefined
  );
}

function recalcDueTimestamps(
  r: any,
  updates: UpdateTaskInput,
  originalTimezone: string
): void {
  if (!shouldUpdateDue(updates, originalTimezone)) return;

  let dueAtLocalInput = updates.dueAtLocal ?? r.dueAtLocal;
  let dueAtUtcInput = updates.dueAtUtc ?? r.dueAtUtc;

  const isTimezoneOnlyUpdate =
    updates.timezone !== undefined &&
    updates.timezone !== originalTimezone &&
    updates.dueAtLocal === undefined &&
    updates.dueAtUtc === undefined;

  if (isTimezoneOnlyUpdate && r.dueAtLocal && originalTimezone) {
    if (!r.dueAtUtc) {
      throw new Error(
        `Cannot perform timezone-only update: missing stored UTC timestamp for dueAt`
      );
    }
    const dt = DateTime.fromISO(r.dueAtUtc, { zone: 'utc' }).setZone(
      updates.timezone
    );
    dueAtLocalInput = dt.toISO();
    if (!dueAtLocalInput) {
      throw new Error(
        `Failed to convert timezone from ${originalTimezone} to ${updates.timezone} for: ${r.dueAtUtc}`
      );
    }
    dueAtUtcInput = r.dueAtUtc; // Preserve the original UTC timestamp
  }

  const dual = ensureDualTimestamps({
    dueAtLocal: dueAtLocalInput,
    dueAtUtc: dueAtUtcInput,
    timezone: updates.timezone ?? r.timezone,
  });
  r.dueAtLocal = dual.dueAtLocal;
  r.dueAtUtc = dual.dueAtUtc;
}

function shouldUpdateReminder(
  updates: UpdateTaskInput,
  originalTimezone: string
): boolean {
  return (
    (updates.timezone !== undefined && updates.timezone !== originalTimezone) ||
    updates.reminderAtLocal !== undefined ||
    updates.reminderAtUtc !== undefined
  );
}

function recalcReminderTimestamps(
  r: any,
  updates: UpdateTaskInput,
  originalTimezone: string
): void {
  if (!shouldUpdateReminder(updates, originalTimezone)) return;

  let reminderAtLocalInput = updates.reminderAtLocal ?? r.reminderAtLocal;
  let reminderAtUtcInput = updates.reminderAtUtc ?? r.reminderAtUtc;

  const isTimezoneOnlyUpdate =
    updates.timezone !== undefined &&
    updates.timezone !== originalTimezone &&
    updates.reminderAtLocal === undefined &&
    updates.reminderAtUtc === undefined;

  if (isTimezoneOnlyUpdate && r.reminderAtLocal && originalTimezone) {
    if (!r.reminderAtUtc) {
      throw new Error(
        `Cannot perform timezone-only update: missing stored UTC timestamp for reminderAt`
      );
    }
    const dt = DateTime.fromISO(r.reminderAtUtc, { zone: 'utc' }).setZone(
      updates.timezone
    );
    reminderAtLocalInput = dt.toISO();
    if (!reminderAtLocalInput) {
      throw new Error(
        `Failed to convert timezone from ${originalTimezone} to ${updates.timezone} for reminder: ${r.reminderAtUtc}`
      );
    }
    reminderAtUtcInput = r.reminderAtUtc; // Preserve the original UTC timestamp
  }

  const dual = maybeDualReminder({
    reminderAtLocal: reminderAtLocalInput,
    reminderAtUtc: reminderAtUtcInput,
    timezone: updates.timezone ?? r.timezone,
  });
  r.reminderAtLocal = dual.reminderAtLocal as any;
  r.reminderAtUtc = dual.reminderAtUtc as any;
}

function applyTaskUpdates(
  task: TaskModel,
  updates: UpdateTaskInput,
  originalTimezone: string
): void {
  const r = task as any;
  if (updates.title !== undefined) r.title = updates.title;
  if (updates.description !== undefined) r.description = updates.description;

  if (updates.timezone !== undefined && updates.timezone !== originalTimezone) {
    r.timezone = updates.timezone;
  }

  recalcDueTimestamps(r, updates, originalTimezone);
  recalcReminderTimestamps(r, updates, originalTimezone);

  if (updates.status) r.status = updates.status as Task['status'];
  if (updates.completedAt !== undefined) {
    r.completedAt = updates.completedAt
      ? new Date(updates.completedAt)
      : undefined;
  }

  r.updatedAt = new Date();
}

// P1: FIXED - Notifications now properly rescheduled on timezone changes only
//
// Issue: When updateTask is called with only a timezone change, the due/reminder
// timestamps are correctly recomputed inside applyTaskUpdates, but handleNotificationUpdates
// never ran because timezoneChanged was hardcoded to false. This left previously
// scheduled notifications at the original timezone, causing reminders to fire at wrong local times.
//
// Root cause: timezoneChanged should be computed by comparing updates.timezone with
// the originalTimezone captured in updateTask(), but was hardcoded to false.
//
// Impact: Timezone-only updates broke notification scheduling, causing user confusion
// when reminders fired at incorrect times after timezone changes.
//
// Fix applied: Added originalTimezone parameter to handleNotificationUpdates() and
// compute timezoneChanged = updates.timezone !== undefined && updates.timezone !== originalTimezone
async function handleNotificationUpdates(params: {
  taskId: string;
  task: TaskModel;
  updates: UpdateTaskInput;
  originalTimezone: string;
}): Promise<void> {
  const { taskId, task, updates, originalTimezone } = params;
  const timezoneChanged =
    updates.timezone !== undefined && updates.timezone !== originalTimezone;

  if (
    updates.reminderAtLocal !== undefined ||
    updates.reminderAtUtc !== undefined ||
    updates.dueAtLocal !== undefined ||
    updates.dueAtUtc !== undefined ||
    timezoneChanged ||
    updates.status === 'completed'
  ) {
    if (process.env.JEST_WORKER_ID === undefined) {
      await TaskNotificationService.cancelForTask(taskId);
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
}

export async function updateTask(
  id: string,
  updates: UpdateTaskInput
): Promise<Task> {
  const repos = getRepos();
  const task = (await (repos.tasks as any).find(id)) as TaskModel;

  // Capture original timezone before applying updates to detect timezone-only changes
  const originalTimezone = (task as any).timezone;

  await database.write(async () => {
    await (task as any).update(
      applyTaskUpdates.bind(null, task, updates, originalTimezone)
    );
  });

  await handleNotificationUpdates({
    taskId: id,
    task,
    updates,
    originalTimezone,
  });
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
  const allTasks = await (repos.tasks as any)
    .query(Q.where('status', 'pending'), Q.where('deleted_at', null))
    .fetch();
  const pendingInRange = allTasks
    .filter((t: any) => {
      const due = DateTime.fromISO((t as any).dueAtLocal);
      return due.toJSDate() >= start && due.toJSDate() <= end;
    })
    .map(toTaskFromModel);

  const allSeries = await (repos.series as any)
    .query(Q.where('deleted_at', null))
    .fetch();
  const visible: Task[] = [...pendingInRange];

  // P1: Filter pending tasks per-series before deduping ephemerals
  //
  // `pendingInRange` contains materialized (stored) tasks across all
  // series. Passing the global array into `buildVisibleForSeries` causes
  // a materialized task from one series to suppress an ephemeral
  // occurrence from a different series when they fall on the same local
  // date. To fix, only forward the materialized tasks that belong to the
  // current series so deduplication happens per-series.
  for (const s of allSeries as SeriesModel[]) {
    const seriesId = (s as any).id as string;
    const materializedForThisSeries = pendingInRange.filter(
      (t: Task) => t.seriesId === seriesId
    );
    const items = await buildVisibleForSeries({
      s: s as any,
      materializedForSeries: materializedForThisSeries,
      start,
      end,
    });
    visible.push(...items);
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

  // Non-blocking plant telemetry update (watering/feeding)
  try {
    await onTaskCompleted(toTaskFromModel((updated as any) ?? task));
  } catch (error) {
    console.warn('[TaskManager] plant telemetry failed on completeTask', error);
  }

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

async function findAndSoftDeleteTaskForOccurrence(
  repos: any,
  seriesId: string,
  day: string
): Promise<TaskModel | null> {
  const existingTasks = await repos.tasks
    .query(Q.where('series_id', seriesId), Q.where('deleted_at', null))
    .fetch();

  // Find task that matches the occurrence local date
  for (const task of existingTasks) {
    // Use the task's own timezone when computing the start-of-day ISO
    const taskZone = (task as any).timezone as string;
    const dayStartIso = DateTime.fromISO(`${day}T00:00:00`, {
      zone: taskZone,
    }).toISO()!;
    if (sameLocalDay((task as any).dueAtLocal, dayStartIso)) {
      // Soft-delete the task and clear nullable reminder fields
      await task.update((rec: TaskModel) => {
        const r = rec as any;
        r.deletedAt = new Date();
        r.reminderAtLocal = null as any;
        r.reminderAtUtc = null as any;
        r.updatedAt = new Date();
      });
      return task;
    }
  }

  return null;
}

export async function skipRecurringInstance(
  seriesId: string,
  occurrenceDate: Date
): Promise<void> {
  const repos = getRepos();
  const series = (await (repos.series as any).find(seriesId)) as SeriesModel;
  const zone = (series as any).timezone as string;
  const day = toOccurrenceLocalDate(occurrenceDate, zone);
  let taskToDelete: TaskModel | null = null;

  await database.write(async () => {
    // Upsert: ensure single override per (seriesId, day)
    const existing = await (repos.overrides as any)
      .query(
        Q.where('series_id', seriesId),
        Q.where('occurrence_local_date', day)
      )
      .fetch();
    if (existing.length > 0) {
      await (existing[0] as any).update((rec: OccurrenceOverrideModel) => {
        const r = rec as any;
        r.status = 'skip' as any;
        r.dueAtLocal = null as any;
        r.dueAtUtc = null as any;
        r.reminderAtLocal = null as any;
        r.reminderAtUtc = null as any;
        r.updatedAt = new Date();
      });
    } else {
      await (repos.overrides as any).create((rec: OccurrenceOverrideModel) => {
        const r = rec as any;
        r.seriesId = seriesId;
        r.occurrenceLocalDate = day;
        r.status = 'skip' as any;
        r.createdAt = new Date();
        r.updatedAt = new Date();
      });
    }

    // Soft-delete any already-materialized task for this series/day
    taskToDelete = await findAndSoftDeleteTaskForOccurrence(
      repos,
      seriesId,
      day
    );
  });

  // Cancel notifications for the task we just soft-deleted
  if (taskToDelete) {
    try {
      await TaskNotificationService.cancelForTask((taskToDelete as any).id);
    } catch (error) {
      console.warn(
        '[TaskManager] Failed to cancel notifications for skipped task',
        error
      );
    }
  }
}

function calculateOccurrenceTimestamps(
  series: Series,
  occurrenceDate: Date
): { occurrenceLocal: DateTime; occurrenceUtc: DateTime; day: string } {
  const zone = series.timezone;
  const day = toOccurrenceLocalDate(occurrenceDate, zone);

  // Compute occurrence due timestamps using the series DTSTART time-of-day
  const dtstartLocal = DateTime.fromISO(series.dtstartLocal);
  const occurrenceLocal = DateTime.fromISO(
    `${day}T${dtstartLocal.toFormat('HH:mm:ss')}`,
    { zone }
  );
  const occurrenceUtc = occurrenceLocal.toUTC();

  return { occurrenceLocal, occurrenceUtc, day };
}

async function findExistingTaskForOccurrence(
  repos: any,
  seriesId: string,
  occurrenceLocalIso: string
): Promise<TaskModel | null> {
  const existingTasks = await repos.tasks
    .query(
      Q.where('series_id', seriesId),
      Q.where('status', 'pending'),
      Q.where('deleted_at', null)
    )
    .fetch();

  // Find task that matches the occurrence local date
  for (const task of existingTasks) {
    if (sameLocalDay(task.dueAtLocal, occurrenceLocalIso)) {
      return task;
    }
  }

  return null;
}

async function updateOrCreateCompletedTask(params: {
  repos: any;
  series: Series;
  existingTask: TaskModel | null;
  timestamps: { localIso: string; utcIso: string; zone: string };
}): Promise<string[]> {
  if (params.existingTask) {
    // Check if the existing task was pending before updating
    const wasPending = params.existingTask.status === 'pending';
    const taskId = params.existingTask.id;

    // Update existing pending task to completed
    await params.existingTask.update((rec: TaskModel) => {
      const r = rec as any;
      r.status = 'completed' as Task['status'];
      r.completedAt = new Date();
      r.updatedAt = new Date();
    });

    // Return the task ID if it was previously pending (needs notification cancellation)
    return wasPending ? [taskId] : [];
  } else {
    // Create new completed materialized task
    await params.repos.tasks.create((rec: TaskModel) => {
      const r = rec as any;
      r.seriesId = params.series.id;
      r.title = params.series.title;
      r.description = params.series.description;
      r.dueAtLocal = params.timestamps.localIso;
      r.dueAtUtc = params.timestamps.utcIso;
      r.timezone = params.timestamps.zone;
      r.status = 'completed' as Task['status'];
      r.completedAt = new Date();
      r.metadata = {};
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });

    // Return empty array for new completed tasks (no notifications to cancel)
    return [];
  }
}

// NOTE: createSkipOverride was unused; removed to satisfy linter

function buildRescheduleOldLocalIso(
  series: SeriesModel,
  day: string,
  zone: string
): string {
  const dtstartLocal = DateTime.fromISO((series as any).dtstartLocal);
  return DateTime.fromISO(`${day}T${dtstartLocal.toFormat('HH:mm:ss')}`, {
    zone,
  }).toISO() as string;
}

// Small helper to build visible ephemeral tasks for a series within a range.
export async function buildVisibleForSeries(params: {
  s: SeriesModel;
  materializedForSeries: Task[];
  start: Date;
  end: Date;
}): Promise<Task[]> {
  const { s, materializedForSeries, start, end } = params;
  const series = toSeriesFromModel(s as any);
  const overrides = await getSeriesOverrides(series.id);
  const parsed = rrule.parseRule(series.rrule, series.dtstartUtc);
  const validated = rrule.validate(parsed as any);
  if (!validated.ok) {
    console.warn(
      `[TaskManager] Skipping series ${series.id} due to invalid RRULE: ${validated.errors?.join(', ')}`
    );
    return [];
  }
  const config = parsed as unknown as RRuleConfig;
  const range = { start, end, timezone: series.timezone };

  const out: Task[] = [];
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
    out.push({
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

  return out;
}

async function upsertRescheduleOverride(params: {
  repos: any;
  seriesId: string;
  day: string;
  newLocalIso: string;
  newUtcIso: string;
}): Promise<void> {
  const { repos, seriesId, day, newLocalIso, newUtcIso } = params;
  const existing = await (repos.overrides as any)
    .query(
      Q.where('series_id', seriesId),
      Q.where('occurrence_local_date', day)
    )
    .fetch();
  if (existing.length > 0) {
    await (existing[0] as any).update((rec: OccurrenceOverrideModel) => {
      const r = rec as any;
      r.status = 'reschedule' as any;
      r.dueAtLocal = newLocalIso;
      r.dueAtUtc = newUtcIso;
      r.updatedAt = new Date();
    });
  } else {
    await (repos.overrides as any).create((rec: OccurrenceOverrideModel) => {
      const r = rec as any;
      r.seriesId = seriesId;
      r.occurrenceLocalDate = day;
      r.status = 'reschedule' as any;
      r.dueAtLocal = newLocalIso;
      r.dueAtUtc = newUtcIso;
      r.createdAt = new Date();
      r.updatedAt = new Date();
    });
  }
}

async function moveExistingMaterializedTask(params: {
  repos: any;
  seriesId: string;
  oldLocalIso: string;
  newLocalIso: string;
  newUtcIso: string;
}): Promise<void> {
  const { repos, seriesId, oldLocalIso, newLocalIso, newUtcIso } = params;
  const existingTask = await findExistingTaskForOccurrence(
    repos,
    seriesId,
    oldLocalIso
  );
  if (!existingTask) return;

  if (process.env.JEST_WORKER_ID === undefined) {
    await TaskNotificationService.cancelForTask((existingTask as any).id);
  }
  await database.write(async () => {
    await (existingTask as any).update((rec: TaskModel) => {
      const r = rec as any;
      r.dueAtLocal = newLocalIso;
      r.dueAtUtc = newUtcIso;
      r.updatedAt = new Date();
    });
  });
  if (process.env.JEST_WORKER_ID === undefined) {
    const updated = toTaskFromModel(existingTask);
    const notifier = new TaskNotificationService();
    await notifier.scheduleTaskReminder(updated as any);
  }
}

export async function rescheduleRecurringInstance(
  seriesId: string,
  occurrenceDate: Date,
  newLocalIso: string
): Promise<void> {
  const repos = getRepos();
  const series = (await (repos.series as any).find(seriesId)) as SeriesModel;
  const zone = (series as any).timezone as string;
  const day = toOccurrenceLocalDate(occurrenceDate, zone);
  const newUtcIso = toUtcIso(newLocalIso);

  await database.write(() =>
    upsertRescheduleOverride({
      repos,
      seriesId,
      day,
      newLocalIso,
      newUtcIso,
    })
  );

  const oldLocalIso = buildRescheduleOldLocalIso(series, day, zone);
  await moveExistingMaterializedTask({
    repos,
    seriesId,
    oldLocalIso,
    newLocalIso,
    newUtcIso,
  });
}

export async function completeRecurringInstance(
  seriesId: string,
  occurrenceDate: Date
): Promise<void> {
  const repos = getRepos();
  const seriesModel = (await repos.series.find(seriesId)) as SeriesModel;
  const series = toSeriesFromModel(seriesModel as any);

  const { occurrenceLocal, occurrenceUtc, day } = calculateOccurrenceTimestamps(
    series,
    occurrenceDate
  );
  const zone = series.timezone;
  const occurrenceLocalIso = occurrenceLocal.toISO()!;
  const occurrenceUtcIso = occurrenceUtc.toISO()!;

  let taskIdsToCancel: string[] = [];
  await database.write(async () => {
    const existingTask = await findExistingTaskForOccurrence(
      repos,
      seriesId,
      occurrenceLocalIso
    );

    taskIdsToCancel = await updateOrCreateCompletedTask({
      repos,
      series,
      existingTask,
      timestamps: {
        localIso: occurrenceLocalIso,
        utcIso: occurrenceUtcIso,
        zone,
      },
    });

    // Record override as completed to suppress this occurrence
    const existing = await repos.overrides
      .query(
        Q.where('series_id', seriesId),
        Q.where('occurrence_local_date', day)
      )
      .fetch();
    if (existing.length > 0) {
      await (existing[0] as any).update((rec: OccurrenceOverrideModel) => {
        const r = rec as any;
        r.status = 'completed' as any;
        r.updatedAt = new Date();
      });
    } else {
      await repos.overrides.create((rec: OccurrenceOverrideModel) => {
        const r = rec as any;
        r.seriesId = seriesId;
        r.occurrenceLocalDate = day;
        r.status = 'completed' as any;
        r.createdAt = new Date();
        r.updatedAt = new Date();
      });
    }
  });

  // Cancel pending notifications for the task(s) we just completed
  if (taskIdsToCancel.length > 0) {
    try {
      for (const taskId of taskIdsToCancel) {
        await TaskNotificationService.cancelForTask(taskId);
      }
    } catch (error) {
      console.warn(
        '[TaskManager] Failed to cancel notifications for completed tasks',
        error
      );
    }
  }

  // Then materialize next occurrence
  if (!occurrenceLocalIso) {
    throw new Error('Failed to generate ISO for next occurrence');
  }
  await materializeNextOccurrence(series, occurrenceLocalIso);

  // Non-blocking plant telemetry based on series metadata/title
  try {
    await onSeriesOccurrenceCompleted(series);
  } catch (error) {
    console.warn(
      '[TaskManager] plant telemetry failed on completeRecurringInstance',
      error
    );
  }
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
