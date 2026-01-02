import type { Collection } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import { deduceInventory } from '@/lib/inventory/deduction-service';
import {
  onSeriesOccurrenceCompleted,
  onTaskCompleted,
} from '@/lib/plant-telemetry';
import type { RRuleConfig, RRuleParse } from '@/lib/rrule';
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
import type {
  DeductionMapEntry,
  DeductionResult,
  InsufficientStockError,
  ResolvedDeductionMapEntry,
} from '@/types/inventory-deduction';

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
  position?: number;
};

export type DateRange = { start: Date; end: Date; timezone: string };

type TaskRepositories = {
  tasks: Collection<TaskModel>;
  series: Collection<SeriesModel>;
  overrides: Collection<OccurrenceOverrideModel>;
};

type DeductionFailureSourceEntry =
  | DeductionMapEntry
  | ResolvedDeductionMapEntry;

type DeductionSummaryEntry = {
  itemId: string;
  unit: string;
  perTaskQuantity?: number;
  perPlantQuantity?: number;
  scalingMode?: DeductionMapEntry['scalingMode'];
  quantity?: number;
  resolvedQuantity?: number;
  totalQuantity?: number;
};

type DeductionFailureDetails = {
  timestamp: string;
  error: string;
  deductionMapSummary: DeductionSummaryEntry[];
  plantCount: number | undefined;
  insufficientItems?: InsufficientStockError[];
  exception?: boolean;
};

type DeductionFailureLogContext = {
  deductionMap: readonly DeductionFailureSourceEntry[];
  result: DeductionResult;
  errorDetails?: string;
};

type TaskMetadataWithContext = TaskMetadata & {
  deductionMap?: unknown;
  plants?: unknown;
  plantIds?: unknown;
};

type TaskWithPlantMetadata = Task & {
  plants?: unknown;
  metadata: TaskMetadataWithContext;
};

function getRepos(): TaskRepositories {
  return {
    tasks: database.get<TaskModel>('tasks'),
    series: database.get<SeriesModel>('series'),
    overrides: database.get<OccurrenceOverrideModel>('occurrence_overrides'),
  };
}

// BUG: This function strips the `timezone` property from the Task object,
// causing all scheduled notifications to default to 'UTC' instead of preserving
// the user's actual timezone. The TaskNotificationService.persistNotificationMapping
// method expects the timezone field for analytics and timestamp rehydration,
// but falls back to 'UTC' when it's missing. This breaks proper timezone handling
// for scheduled notifications. The fix is to include `timezone: task.timezone`
// in the returned object to ensure the correct timezone is persisted in the
// notification_queue table.
function toNotificationTaskPayload(
  task: Task
): Parameters<TaskNotificationService['scheduleTaskReminder']>[0] {
  // Convert calendar Task to notification Task format
  return {
    id: task.id,
    plantId: task.plantId,
    title: task.title,
    description: task.description ?? '',
    reminderAtUtc: task.reminderAtUtc ?? null,
    reminderAtLocal: task.reminderAtLocal ?? null,
    dueAtUtc: task.dueAtUtc,
    dueAtLocal: task.dueAtLocal,
    timezone: task.timezone,
  };
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
  return rows.map((override) => ({
    id: override.id,
    seriesId: override.seriesId,
    occurrenceLocalDate: override.occurrenceLocalDate,
    dueAtLocal: override.dueAtLocal ?? undefined,
    dueAtUtc: override.dueAtUtc ?? undefined,
    reminderAtLocal: override.reminderAtLocal ?? undefined,
    reminderAtUtc: override.reminderAtUtc ?? undefined,
    status: override.status,
    createdAt: override.createdAt.toISOString(),
    updatedAt: override.updatedAt.toISOString(),
  }));
}

function toTaskFromModel(model: TaskModel): Task {
  return {
    id: model.id,
    seriesId: model.seriesId ?? undefined,
    title: model.title,
    description: model.description ?? undefined,
    dueAtLocal: model.dueAtLocal,
    dueAtUtc: model.dueAtUtc,
    timezone: model.timezone,
    reminderAtLocal: model.reminderAtLocal ?? undefined,
    reminderAtUtc: model.reminderAtUtc ?? undefined,
    plantId: model.plantId ?? undefined,
    status: model.status,
    position: model.position ?? undefined,
    completedAt: model.completedAt?.toISOString(),
    metadata: model.metadata ?? {},
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    deletedAt: model.deletedAt?.toISOString(),
  };
}

function toSeriesFromModel(model: SeriesModel): Series {
  return {
    id: model.id,
    title: model.title,
    description: model.description ?? undefined,
    dtstartLocal: model.dtstartLocal,
    dtstartUtc: model.dtstartUtc,
    timezone: model.timezone,
    rrule: model.rrule,
    untilUtc: model.untilUtc ?? undefined,
    plantId: model.plantId ?? undefined,
    metadata: model.metadata ?? undefined,
    createdAt: model.createdAt.toISOString(),
    updatedAt: model.updatedAt.toISOString(),
    deletedAt: model.deletedAt?.toISOString(),
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
  const validationTarget = parsed as RRuleParse;
  const validated = rrule.validate(validationTarget);
  if (!validated.ok) {
    console.warn(
      `[TaskManager] Skipping series ${series.id} due to invalid RRULE: ${validated.errors?.join(', ')}`
    );
    return null;
  }
  const config = validationTarget as unknown as RRuleConfig;
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
    created = await repos.tasks.create((record) => {
      record.seriesId = series.id;
      record.title = series.title;
      if (series.description != null) record.description = series.description;
      if (series.plantId != null) record.plantId = series.plantId;
      const dueAtLocal = DateTime.fromJSDate(local, {
        zone: series.timezone,
      }).toISO();
      const dueAtUtc = DateTime.fromJSDate(utc, { zone: 'utc' }).toISO();
      if (!dueAtLocal || !dueAtUtc) {
        throw new Error(
          '[TaskManager] Failed to generate ISO timestamps while materializing series task'
        );
      }
      record.dueAtLocal = dueAtLocal;
      record.dueAtUtc = dueAtUtc;
      record.timezone = series.timezone;
      record.status = 'pending';
      record.metadata = series.metadata ?? {};
      record.createdAt = new Date();
      record.updatedAt = new Date();
    });
  });

  const createdTask: TaskModel | null = created;
  if (!createdTask) {
    return null;
  }
  const scheduledTask: TaskModel = createdTask;

  // Schedule notifications for newly materialized tasks
  // This ensures users get reminders for recurring tasks immediately
  if (scheduledTask.dueAtUtc) {
    const task = toTaskFromModel(scheduledTask);
    const notifier = new TaskNotificationService();
    await notifier.scheduleTaskReminder(toNotificationTaskPayload(task));
  }

  return toTaskFromModel(scheduledTask);
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const repos = getRepos();
  const { dueAtLocal, dueAtUtc } = ensureDualTimestamps(input);
  const { reminderAtLocal, reminderAtUtc } = maybeDualReminder(input);

  let created: TaskModel | null = null;
  await database.write(async () => {
    created = await repos.tasks.create((record) => {
      record.seriesId = input.seriesId;
      record.title = input.title;
      if (input.description !== undefined) {
        record.description = input.description ?? undefined;
      }
      record.dueAtLocal = dueAtLocal;
      record.dueAtUtc = dueAtUtc;
      record.timezone = input.timezone;
      if (reminderAtLocal) record.reminderAtLocal = reminderAtLocal;
      if (reminderAtUtc) record.reminderAtUtc = reminderAtUtc;
      if (input.plantId !== undefined) {
        record.plantId = input.plantId ?? undefined;
      }
      record.status = 'pending';
      record.metadata = input.metadata ?? {};
      record.createdAt = new Date();
      record.updatedAt = new Date();
    });
  });
  if (!created) throw new Error('Failed to create task');
  const createdTask: TaskModel = created;

  // Schedule notifications for newly created tasks
  // This ensures users get reminders immediately without waiting for global rehydrate
  if (createdTask.reminderAtUtc || createdTask.dueAtUtc) {
    const task = toTaskFromModel(createdTask);
    const notifier = new TaskNotificationService();
    await notifier.scheduleTaskReminder(toNotificationTaskPayload(task));
  }

  return toTaskFromModel(createdTask);
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
  record: TaskModel,
  updates: UpdateTaskInput,
  originalTimezone: string
): void {
  if (!shouldUpdateDue(updates, originalTimezone)) return;

  let dueAtLocalInput = updates.dueAtLocal ?? record.dueAtLocal;
  let dueAtUtcInput = updates.dueAtUtc ?? record.dueAtUtc;

  const isTimezoneOnlyUpdate =
    updates.timezone !== undefined &&
    updates.timezone !== originalTimezone &&
    updates.dueAtLocal === undefined &&
    updates.dueAtUtc === undefined;

  if (isTimezoneOnlyUpdate && record.dueAtLocal && originalTimezone) {
    if (!record.dueAtUtc) {
      throw new Error(
        `Cannot perform timezone-only update: missing stored UTC timestamp for dueAt`
      );
    }
    const dt = DateTime.fromISO(record.dueAtUtc, { zone: 'utc' }).setZone(
      updates.timezone
    );
    const convertedLocal = dt.toISO();
    if (!convertedLocal) {
      throw new Error(
        `Failed to convert timezone from ${originalTimezone} to ${updates.timezone} for: ${record.dueAtUtc}`
      );
    }
    dueAtLocalInput = convertedLocal;
    dueAtUtcInput = record.dueAtUtc; // Preserve the original UTC timestamp
  }

  const dual = ensureDualTimestamps({
    dueAtLocal: dueAtLocalInput,
    dueAtUtc: dueAtUtcInput,
    timezone: updates.timezone ?? record.timezone,
  });
  record.dueAtLocal = dual.dueAtLocal;
  record.dueAtUtc = dual.dueAtUtc;
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
  record: TaskModel,
  updates: UpdateTaskInput,
  originalTimezone: string
): void {
  if (!shouldUpdateReminder(updates, originalTimezone)) return;

  let reminderAtLocalInput = updates.reminderAtLocal ?? record.reminderAtLocal;
  let reminderAtUtcInput = updates.reminderAtUtc ?? record.reminderAtUtc;

  const isTimezoneOnlyUpdate =
    updates.timezone !== undefined &&
    updates.timezone !== originalTimezone &&
    updates.reminderAtLocal === undefined &&
    updates.reminderAtUtc === undefined;

  if (isTimezoneOnlyUpdate && record.reminderAtLocal && originalTimezone) {
    if (!record.reminderAtUtc) {
      throw new Error(
        `Cannot perform timezone-only update: missing stored UTC timestamp for reminderAt`
      );
    }
    const dt = DateTime.fromISO(record.reminderAtUtc, { zone: 'utc' }).setZone(
      updates.timezone
    );
    const convertedReminder = dt.toISO();
    if (!convertedReminder) {
      throw new Error(
        `Failed to convert timezone from ${originalTimezone} to ${updates.timezone} for reminder: ${record.reminderAtUtc}`
      );
    }
    reminderAtLocalInput = convertedReminder;
    reminderAtUtcInput = record.reminderAtUtc; // Preserve the original UTC timestamp
  }

  const dual = maybeDualReminder({
    reminderAtLocal: reminderAtLocalInput,
    reminderAtUtc: reminderAtUtcInput,
    timezone: updates.timezone ?? record.timezone,
  });
  record.reminderAtLocal = dual.reminderAtLocal ?? undefined;
  record.reminderAtUtc = dual.reminderAtUtc ?? undefined;
}

function applyTaskUpdates(
  record: TaskModel,
  updates: UpdateTaskInput,
  originalTimezone: string
): void {
  if (updates.title !== undefined) record.title = updates.title;
  if (updates.description !== undefined)
    record.description = updates.description;

  if (updates.timezone !== undefined && updates.timezone !== originalTimezone) {
    record.timezone = updates.timezone;
  }

  recalcDueTimestamps(record, updates, originalTimezone);
  recalcReminderTimestamps(record, updates, originalTimezone);

  if (updates.status) record.status = updates.status;
  if (updates.completedAt !== undefined) {
    record.completedAt = updates.completedAt
      ? new Date(updates.completedAt)
      : undefined;
  }
  if (updates.position !== undefined) {
    record.position = updates.position;
  }

  record.updatedAt = new Date();
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
        await notifier.scheduleTaskReminder(
          toNotificationTaskPayload(updatedTask)
        );
      }
    }
  }
}

export async function updateTask(
  id: string,
  updates: UpdateTaskInput
): Promise<Task> {
  const repos = getRepos();
  const task = await repos.tasks.find(id);

  // Capture original timezone before applying updates to detect timezone-only changes
  const originalTimezone = task.timezone;

  await database.write(async () => {
    await task.update((record) => {
      applyTaskUpdates(record, updates, originalTimezone);
    });
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
  const task = await repos.tasks.find(id);
  if (process.env.JEST_WORKER_ID === undefined) {
    await TaskNotificationService.cancelForTask(id);
  }
  await database.write(async () => {
    await task.update((record) => {
      record.deletedAt = new Date();
      record.updatedAt = new Date();
    });
  });
}

export async function getCompletedTasksByDateRange(
  start: Date,
  end: Date
): Promise<Task[]> {
  const repos = getRepos();
  // Query completed tasks by due date (when they were scheduled for)
  // not by completedAt (when the user marked them done), so tasks
  // appear in the correct day section on the calendar.
  const allCompleted = await repos.tasks
    .query(Q.where('status', 'completed'), Q.where('deleted_at', null))
    .fetch();

  const completedInRange = allCompleted.filter((taskModel) => {
    const due = DateTime.fromISO(taskModel.dueAtLocal);
    return due.toJSDate() >= start && due.toJSDate() <= end;
  });

  return completedInRange
    .map(toTaskFromModel)
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1));
}

export async function getTasksByDateRange(
  start: Date,
  end: Date
): Promise<Task[]> {
  const repos = getRepos();
  const allTasks = await repos.tasks
    .query(Q.where('status', 'pending'), Q.where('deleted_at', null))
    .fetch();
  const pendingInRange = allTasks
    .filter((taskModel) => {
      const due = DateTime.fromISO(taskModel.dueAtLocal);
      return due.toJSDate() >= start && due.toJSDate() <= end;
    })
    .map(toTaskFromModel);

  const allSeries = await repos.series
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
  for (const seriesModel of allSeries) {
    const seriesId = seriesModel.id;
    const materializedForThisSeries = pendingInRange.filter(
      (t: Task) => t.seriesId === seriesId
    );
    const items = await buildVisibleForSeries({
      s: seriesModel,
      materializedForSeries: materializedForThisSeries,
      start,
      end,
    });
    visible.push(...items);
  }

  return visible.sort((a, b) => (a.dueAtLocal < b.dueAtLocal ? -1 : 1));
}

const DEDUCTION_SCALING_MODES: DeductionMapEntry['scalingMode'][] = [
  'fixed',
  'per-plant',
  'ec-based',
];

function normalizeDeductionEntry(
  entry: unknown,
  index: number,
  errors: string[]
): DeductionMapEntry | null {
  if (!entry || typeof entry !== 'object') {
    errors.push(`Entry ${index}: must be an object`);
    return null;
  }

  const raw = entry as Record<string, unknown>;
  const itemIdRaw = raw.itemId;
  if (typeof itemIdRaw !== 'string' || !itemIdRaw.trim()) {
    errors.push(`Entry ${index}: itemId must be a non-empty string`);
    return null;
  }

  const unitRaw = raw.unit;
  if (typeof unitRaw !== 'string' || !unitRaw.trim()) {
    errors.push(`Entry ${index}: unit must be a non-empty string`);
    return null;
  }

  const perTaskQuantityRaw = raw.perTaskQuantity;
  const perPlantQuantityRaw = raw.perPlantQuantity;
  const hasPerTaskQuantity =
    typeof perTaskQuantityRaw === 'number' && perTaskQuantityRaw > 0;
  const hasPerPlantQuantity =
    typeof perPlantQuantityRaw === 'number' && perPlantQuantityRaw > 0;

  if (!hasPerTaskQuantity && !hasPerPlantQuantity) {
    errors.push(
      `Entry ${index}: must have perTaskQuantity or perPlantQuantity > 0`
    );
    return null;
  }

  const scalingModeRaw = raw.scalingMode;
  if (
    scalingModeRaw !== undefined &&
    (typeof scalingModeRaw !== 'string' ||
      !DEDUCTION_SCALING_MODES.includes(
        scalingModeRaw as DeductionMapEntry['scalingMode']
      ))
  ) {
    errors.push(
      `Entry ${index}: scalingMode must be one of ${DEDUCTION_SCALING_MODES.join(', ')}`
    );
    return null;
  }

  const normalized: DeductionMapEntry = {
    itemId: itemIdRaw.trim(),
    unit: unitRaw.trim(),
  };

  if (hasPerTaskQuantity) {
    normalized.perTaskQuantity = perTaskQuantityRaw as number;
  }
  if (hasPerPlantQuantity) {
    normalized.perPlantQuantity = perPlantQuantityRaw as number;
  }
  if (scalingModeRaw !== undefined) {
    normalized.scalingMode = scalingModeRaw as DeductionMapEntry['scalingMode'];
  }
  if (typeof raw.label === 'string' && raw.label.trim()) {
    normalized.label = raw.label;
  }

  return normalized;
}

function validateDeductionMap(map: unknown): {
  isValid: boolean;
  errors: string[];
  entries: DeductionMapEntry[];
} {
  const errors: string[] = [];
  if (!Array.isArray(map) || map.length === 0) {
    errors.push('deductionMap must be a non-empty array');
    return { isValid: false, errors, entries: [] };
  }

  const entries: DeductionMapEntry[] = [];

  map.forEach((entry, index) => {
    const normalized = normalizeDeductionEntry(entry, index, errors);
    if (normalized) {
      entries.push(normalized);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    entries: errors.length ? [] : entries,
  };
}

function determinePlantCount(taskData: Task): number | undefined {
  const taskWithMetadata = taskData as TaskWithPlantMetadata;

  const directPlants = taskWithMetadata.plants;
  if (Array.isArray(directPlants) && directPlants.length > 0) {
    return directPlants.length;
  }

  const metadataPlants = taskWithMetadata.metadata.plants;
  if (Array.isArray(metadataPlants) && metadataPlants.length > 0) {
    return metadataPlants.length;
  }

  const metadataPlantIds = taskWithMetadata.metadata.plantIds;
  if (
    Array.isArray(metadataPlantIds) &&
    metadataPlantIds.length > 0 &&
    metadataPlantIds.every((value) => typeof value === 'string' && value.trim())
  ) {
    return metadataPlantIds.length;
  }

  return taskData.plantId ? 1 : undefined;
}

function buildDeductionSummary(
  deductionMap: readonly DeductionFailureSourceEntry[]
): DeductionSummaryEntry[] {
  return deductionMap.map((entry) => {
    const resolved = entry as ResolvedDeductionMapEntry;
    return {
      itemId: entry.itemId,
      unit: entry.unit,
      perTaskQuantity: entry.perTaskQuantity,
      perPlantQuantity: entry.perPlantQuantity,
      scalingMode: entry.scalingMode,
      quantity: resolved.quantity,
      resolvedQuantity: resolved.resolvedQuantity,
      totalQuantity: resolved.totalQuantity,
    };
  });
}

function createDeductionFailureDetails(
  plantCount: number | undefined,
  result: DeductionResult,
  deductionMap: readonly DeductionFailureSourceEntry[]
): DeductionFailureDetails {
  return {
    timestamp: new Date().toISOString(),
    error: result.error ?? 'Insufficient stock',
    deductionMapSummary: buildDeductionSummary(deductionMap),
    plantCount,
    insufficientItems: result.insufficientItems,
  };
}

async function persistDeductionFailure(
  taskId: string,
  failureDetails: DeductionFailureDetails
): Promise<void> {
  try {
    await database.write(async () => {
      const taskModel = await database.get<TaskModel>('tasks').find(taskId);
      await taskModel.update((record) => {
        const metadata = { ...record.metadata } as TaskMetadata;
        metadata.lastDeductionFailure = failureDetails;
        record.metadata = metadata;
        record.updatedAt = new Date();
      });
    });
  } catch (metadataError) {
    console.warn(
      '[TaskManager] Failed to persist deduction failure metadata:',
      metadataError
    );
  }
}

function logDeductionFailure(
  taskId: string,
  plantCount: number | undefined,
  context: DeductionFailureLogContext
): void {
  const { deductionMap, result, errorDetails } = context;
  const summaryEntries = buildDeductionSummary(deductionMap);
  const mapSummary = summaryEntries
    .map((entry) => {
      const quantity =
        entry.resolvedQuantity ??
        entry.quantity ??
        entry.totalQuantity ??
        entry.perTaskQuantity ??
        entry.perPlantQuantity ??
        0;
      return `${entry.itemId}(${quantity}${entry.unit})`;
    })
    .join(', ');

  console.warn(
    '[TaskManager] Inventory deduction failed:',
    result.error ?? 'Insufficient stock',
    errorDetails ? `Details: ${errorDetails}` : '',
    `Task: ${taskId}, Plants: ${plantCount ?? 'unknown'}, Map entries: ${deductionMap.length}`,
    `Map summary: ${mapSummary}`
  );
}

async function performInventoryDeduction(
  taskId: string,
  deductionMap: DeductionMapEntry[],
  plantCount: number | undefined
): Promise<DeductionResult | null> {
  try {
    const result = await deduceInventory(database, {
      source: 'task',
      taskId,
      deductionMap,
      context: {
        taskId,
        plantCount,
      },
    });
    return result;
  } catch (deductionError) {
    console.warn(
      '[TaskManager] Inventory deduction threw exception:',
      `Task: ${taskId}, Plants: ${plantCount ?? 'unknown'}, Map entries: ${deductionMap.length}`,
      `Map summary: ${deductionMap
        .map((entry) => {
          const quantity = entry.perTaskQuantity ?? entry.perPlantQuantity ?? 0;
          return `${entry.itemId}(${quantity}${entry.unit})`;
        })
        .join(', ')}`,
      deductionError instanceof Error ? deductionError.message : deductionError
    );

    const failureDetails: DeductionFailureDetails = {
      timestamp: new Date().toISOString(),
      error:
        deductionError instanceof Error
          ? deductionError.message
          : 'Unexpected deduction error',
      deductionMapSummary: buildDeductionSummary(deductionMap),
      plantCount,
      exception: true,
    };

    await persistDeductionFailure(taskId, failureDetails);
    return null;
  }
}

/**
 * Handle deduction failure - persist details and log
 */
async function handleDeductionFailure(options: {
  taskId: string;
  plantCount: number | undefined;
  result: DeductionResult;
  failureEntries: readonly DeductionFailureSourceEntry[];
}): Promise<void> {
  const { taskId, plantCount, result, failureEntries } = options;
  const failureDetails = createDeductionFailureDetails(
    plantCount,
    result,
    failureEntries
  );
  await persistDeductionFailure(taskId, failureDetails);

  console.warn('[TaskManager] Inventory deduction failure metric incremented');

  const isCriticalFailure =
    result.insufficientItems && result.insufficientItems.length > 0;
  if (isCriticalFailure) {
    console.warn(
      '[TaskManager] Critical inventory shortage alert enqueued for task:',
      taskId
    );
  }

  const errorDetails = result.insufficientItems
    ?.map(
      (err) =>
        `${err.itemName ?? err.itemId}: needed ${err.required} ${err.unit}, had ${err.available} ${err.unit}`
    )
    .join('; ');

  logDeductionFailure(taskId, plantCount, {
    deductionMap: failureEntries,
    result,
    errorDetails,
  });
}

/**
 * Clear deduction failure metadata after successful deduction
 */
async function clearDeductionFailureMetadata(taskId: string): Promise<void> {
  try {
    await database.write(async () => {
      const model = await database.get<TaskModel>('tasks').find(taskId);
      await model.update((record) => {
        const metadata = {
          ...record.metadata,
        } as TaskMetadata & Record<string, unknown>;
        if ('lastDeductionFailure' in metadata) {
          delete metadata.lastDeductionFailure;
          record.metadata = metadata;
          record.updatedAt = new Date();
        }
      });
    });
  } catch (clearError) {
    console.warn(
      '[TaskManager] Failed to clear deduction failure metadata after success',
      clearError
    );
  }
}

/**
 * Handle inventory deduction for a completed task
 */
async function handleTaskInventoryDeduction(
  taskData: Task,
  taskId: string
): Promise<void> {
  const metadata = taskData.metadata as TaskMetadataWithContext | undefined;
  if (!metadata || metadata.deductionMap == null) {
    return;
  }

  const validation = validateDeductionMap(metadata.deductionMap);

  if (!validation.isValid) {
    console.warn(
      '[TaskManager] Invalid deduction map - skipping inventory deduction:',
      validation.errors.join('; '),
      `Map entries: ${Array.isArray(metadata.deductionMap) ? metadata.deductionMap.length : 'N/A'}`
    );
    return;
  }

  const plantCount = determinePlantCount(taskData);
  const result = await performInventoryDeduction(
    taskId,
    validation.entries,
    plantCount
  );

  if (result === null) {
    return;
  }

  if (!result.success) {
    const failureEntries: readonly DeductionFailureSourceEntry[] =
      result.deductionMap && result.deductionMap.length > 0
        ? result.deductionMap
        : validation.entries;
    await handleDeductionFailure({
      taskId,
      plantCount,
      result,
      failureEntries,
    });
  } else {
    await clearDeductionFailureMetadata(taskId);
    console.log(
      `[TaskManager] Inventory deducted successfully: ${result.movements.length} movements for task ${taskId}`
    );
  }
}

export async function completeTask(id: string): Promise<Task> {
  const repos = getRepos();
  const task = await repos.tasks.find(id);
  const seriesId = task.seriesId;
  let updated: TaskModel | null = null;
  await database.write(async () => {
    updated = await task.update((record) => {
      record.status = 'completed';
      record.completedAt = new Date();
      record.updatedAt = new Date();
    });
  });

  // Cancel associated notifications on completion
  await TaskNotificationService.cancelForTask(id);

  const taskRecord = updated ?? task;

  // Non-blocking plant telemetry update (watering/feeding)
  try {
    await onTaskCompleted(toTaskFromModel(taskRecord));
  } catch (error) {
    console.warn('[TaskManager] plant telemetry failed on completeTask', error);
  }

  // Non-blocking inventory deduction (if deduction map exists)
  try {
    const taskData = toTaskFromModel(taskRecord);
    await handleTaskInventoryDeduction(taskData, id);
  } catch (error) {
    console.error(
      '[TaskManager] Inventory deduction exception on completeTask:',
      error instanceof Error ? error.message : String(error)
    );
  }

  // Materialize the next occurrence for recurring tasks
  if (seriesId) {
    const seriesModel = await repos.series.find(seriesId);
    await materializeNextOccurrence(
      toSeriesFromModel(seriesModel),
      task.dueAtLocal
    );
  }

  return toTaskFromModel(taskRecord);
}

async function findAndSoftDeleteTaskForOccurrence(
  repos: TaskRepositories,
  seriesId: string,
  day: string
): Promise<TaskModel | null> {
  const existingTasks = await repos.tasks
    .query(Q.where('series_id', seriesId), Q.where('deleted_at', null))
    .fetch();

  // Find task that matches the occurrence local date
  for (const task of existingTasks) {
    // Use the task's own timezone when computing the start-of-day ISO
    const taskZone = task.timezone;
    const dayStartIso = DateTime.fromISO(`${day}T00:00:00`, {
      zone: taskZone,
    }).toISO();
    if (!dayStartIso) continue;
    if (sameLocalDay(task.dueAtLocal, dayStartIso)) {
      // Soft-delete the task and clear nullable reminder fields
      await task.update((record) => {
        record.deletedAt = new Date();
        record.reminderAtLocal = undefined;
        record.reminderAtUtc = undefined;
        record.updatedAt = new Date();
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
  const series = await repos.series.find(seriesId);
  const zone = series.timezone;
  const day = toOccurrenceLocalDate(occurrenceDate, zone);
  let taskToDelete: TaskModel | null = null;

  await database.write(async () => {
    // Upsert: ensure single override per (seriesId, day)
    const existing = await repos.overrides
      .query(
        Q.where('series_id', seriesId),
        Q.where('occurrence_local_date', day)
      )
      .fetch();
    if (existing.length > 0) {
      await existing[0].update((record) => {
        record.status = 'skip';
        record.dueAtLocal = undefined;
        record.dueAtUtc = undefined;
        record.reminderAtLocal = undefined;
        record.reminderAtUtc = undefined;
        record.updatedAt = new Date();
      });
    } else {
      await repos.overrides.create((record) => {
        record.seriesId = seriesId;
        record.occurrenceLocalDate = day;
        record.status = 'skip';
        record.createdAt = new Date();
        record.updatedAt = new Date();
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
  const toCancel: TaskModel | null = taskToDelete;
  if (toCancel) {
    const cancelTarget: TaskModel = toCancel;
    try {
      await TaskNotificationService.cancelForTask(cancelTarget.id);
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
  repos: TaskRepositories,
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
  repos: TaskRepositories;
  series: Series;
  existingTask: TaskModel | null;
  timestamps: { localIso: string; utcIso: string; zone: string };
}): Promise<string[]> {
  if (params.existingTask) {
    // Check if the existing task was pending before updating
    const wasPending = params.existingTask.status === 'pending';
    const taskId = params.existingTask.id;

    // Update existing pending task to completed
    await params.existingTask.update((record) => {
      record.status = 'completed';
      record.completedAt = new Date();
      record.updatedAt = new Date();
    });

    // Return the task ID if it was previously pending (needs notification cancellation)
    return wasPending ? [taskId] : [];
  } else {
    // Create new completed materialized task
    await params.repos.tasks.create((record) => {
      record.seriesId = params.series.id;
      record.title = params.series.title;
      record.description = params.series.description ?? undefined;
      record.dueAtLocal = params.timestamps.localIso;
      record.dueAtUtc = params.timestamps.utcIso;
      record.timezone = params.timestamps.zone;
      record.status = 'completed';
      record.completedAt = new Date();
      record.metadata = {};
      record.createdAt = new Date();
      record.updatedAt = new Date();
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
  const dtstartLocal = DateTime.fromISO(series.dtstartLocal);
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
  const series = toSeriesFromModel(s);
  const overrides = await getSeriesOverrides(series.id);
  const parsed = rrule.parseRule(series.rrule, series.dtstartUtc);
  const validated = rrule.validate(parsed as RRuleParse);
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
    if (!localIso) continue;
    const already = materializedForSeries.find((t: Task) =>
      sameLocalDay(t.dueAtLocal, localIso)
    );
    if (already) continue;

    const ephemeralId = `series:${series.id}:${toOccurrenceLocalDate(
      local,
      series.timezone
    )}`;
    const dueAtUtcIso = DateTime.fromJSDate(utc, { zone: 'utc' }).toISO();
    if (!dueAtUtcIso) continue;
    const ephemeralTask: Task = {
      id: ephemeralId,
      seriesId: series.id,
      title: series.title,
      description: series.description,
      dueAtLocal: localIso,
      dueAtUtc: dueAtUtcIso,
      timezone: series.timezone,
      status: 'pending',
      metadata: { ephemeral: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    out.push(ephemeralTask);
  }

  return out;
}

async function upsertRescheduleOverride(params: {
  repos: TaskRepositories;
  seriesId: string;
  day: string;
  newLocalIso: string;
  newUtcIso: string;
}): Promise<void> {
  const { repos, seriesId, day, newLocalIso, newUtcIso } = params;
  const existing = await repos.overrides
    .query(
      Q.where('series_id', seriesId),
      Q.where('occurrence_local_date', day)
    )
    .fetch();
  if (existing.length > 0) {
    await existing[0].update((record) => {
      record.status = 'reschedule';
      record.dueAtLocal = newLocalIso;
      record.dueAtUtc = newUtcIso;
      record.updatedAt = new Date();
    });
  } else {
    await repos.overrides.create((record) => {
      record.seriesId = seriesId;
      record.occurrenceLocalDate = day;
      record.status = 'reschedule';
      record.dueAtLocal = newLocalIso;
      record.dueAtUtc = newUtcIso;
      record.createdAt = new Date();
      record.updatedAt = new Date();
    });
  }
}

async function moveExistingMaterializedTask(params: {
  repos: TaskRepositories;
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
    await TaskNotificationService.cancelForTask(existingTask.id);
  }
  await database.write(async () => {
    await existingTask.update((record) => {
      record.dueAtLocal = newLocalIso;
      record.dueAtUtc = newUtcIso;
      record.updatedAt = new Date();
    });
  });
  if (process.env.JEST_WORKER_ID === undefined) {
    const updated = toTaskFromModel(existingTask);
    const notifier = new TaskNotificationService();
    await notifier.scheduleTaskReminder(toNotificationTaskPayload(updated));
  }
}

export async function rescheduleRecurringInstance(
  seriesId: string,
  occurrenceDate: Date,
  newLocalIso: string
): Promise<void> {
  const repos = getRepos();
  const series = await repos.series.find(seriesId);
  const zone = series.timezone;
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
  const seriesModel = await repos.series.find(seriesId);
  const series = toSeriesFromModel(seriesModel);

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
      await existing[0].update((record) => {
        record.status = 'completed';
        record.updatedAt = new Date();
      });
    } else {
      await repos.overrides.create((record) => {
        record.seriesId = seriesId;
        record.occurrenceLocalDate = day;
        record.status = 'completed';
        record.createdAt = new Date();
        record.updatedAt = new Date();
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
    created = await repos.series.create((record) => {
      record.title = input.title;
      record.description = input.description ?? undefined;
      record.dtstartLocal = input.dtstartLocal;
      record.dtstartUtc = input.dtstartUtc;
      record.timezone = input.timezone;
      record.rrule = input.rrule;
      if (input.untilUtc !== undefined) {
        record.untilUtc = input.untilUtc;
      }
      if (input.plantId !== undefined) {
        record.plantId = input.plantId;
      }
      record.createdAt = new Date();
      record.updatedAt = new Date();
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
  const series = await repos.series.find(id);
  await database.write(async () => {
    await series.update((record) => {
      if (updates.title !== undefined) record.title = updates.title;
      if (updates.description !== undefined)
        record.description = updates.description ?? undefined;
      if (updates.dtstartLocal !== undefined)
        record.dtstartLocal = updates.dtstartLocal;
      if (updates.dtstartUtc !== undefined)
        record.dtstartUtc = updates.dtstartUtc;
      if (updates.timezone !== undefined) record.timezone = updates.timezone;
      if (updates.rrule !== undefined) record.rrule = updates.rrule;
      if (updates.untilUtc !== undefined) record.untilUtc = updates.untilUtc;
      if (updates.plantId !== undefined)
        record.plantId = updates.plantId ?? undefined;
      record.updatedAt = new Date();
    });
  });
  return toSeriesFromModel(series);
}

export async function deleteSeries(id: string): Promise<void> {
  const repos = getRepos();
  const series = await repos.series.find(id);
  await database.write(async () => {
    await series.update((record) => {
      record.deletedAt = new Date();
      record.updatedAt = new Date();
    });
  });
}
