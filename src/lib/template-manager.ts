/* eslint linebreak-style: 0 */
import { DateTime } from 'luxon';

import { createTask } from '@/lib/task-manager';
import { getTemplate } from '@/lib/template-registry';
import { database } from '@/lib/watermelon';
import type { TemplatePreview, TemplatePreviewTask } from '@/types/templates';

type ApplyTemplateInput = {
  templateId: string;
  plantId: string;
  anchorDate: Date; // local date in target timezone
  timezone: string; // IANA timezone for generated tasks
  idempotencyKey?: string;
};

type CreatedTaskRef = { id: string };

type BuildLocalIsoParams = {
  anchorDate: Date;
  offsetDays: number;
  timeOfDay: string;
  timezone: string;
};

function buildLocalIso(params: BuildLocalIsoParams): string {
  const [hour, minute] = params.timeOfDay
    .split(':')
    .map((v) => Number.parseInt(v, 10));
  const base = DateTime.fromJSDate(params.anchorDate, {
    zone: params.timezone,
  }).startOf('day');
  const local = base
    .plus({ days: params.offsetDays })
    .set({ hour, minute, second: 0, millisecond: 0 });
  const iso = local.toISO();
  if (!iso) throw new Error('Failed to generate local ISO');
  return iso;
}

function toUtcIso(localIso: string): string {
  const utc = DateTime.fromISO(localIso).toUTC().toISO();
  if (!utc) throw new Error('Failed to convert to UTC ISO');
  return utc;
}

function maybeReminderLocalIso(
  localIso: string,
  minutesBefore?: number
): string | undefined {
  if (!minutesBefore || minutesBefore <= 0) return undefined;
  const dt = DateTime.fromISO(localIso).minus({ minutes: minutesBefore });
  return dt.toISO() ?? undefined;
}

function buildPreviewTasks(params: ApplyTemplateInput): TemplatePreviewTask[] {
  const def = getTemplate(params.templateId);
  if (!def) throw new Error(`Template not found: ${params.templateId}`);

  return def.steps.map((s) => {
    const dueAtLocal = buildLocalIso({
      anchorDate: params.anchorDate,
      offsetDays: s.offsetDays,
      timeOfDay: s.timeOfDay,
      timezone: params.timezone,
    });
    const dueAtUtc = toUtcIso(dueAtLocal);
    const reminderAtLocal = maybeReminderLocalIso(
      dueAtLocal,
      s.reminderMinutesBefore
    );
    const reminderAtUtc = reminderAtLocal
      ? toUtcIso(reminderAtLocal)
      : undefined;
    return {
      title: s.title,
      description: s.description,
      dueAtLocal,
      dueAtUtc,
      timezone: params.timezone,
      reminderAtLocal,
      reminderAtUtc,
      plantId: params.plantId,
      metadata: {
        templateId: params.templateId,
        templateStepId: s.id,
        idempotencyKey: params.idempotencyKey,
        anchorLocalDate: DateTime.fromJSDate(params.anchorDate, {
          zone: params.timezone,
        }).toISODate(),
      },
    } satisfies TemplatePreviewTask;
  });
}

type PreviewParams = {
  templateId: string;
  anchorDate: Date;
  timezone: string;
  plantId: string;
};

export function previewTemplateApplication(
  params: PreviewParams
): TemplatePreview {
  const steps = buildPreviewTasks({
    templateId: params.templateId,
    anchorDate: params.anchorDate,
    timezone: params.timezone,
    plantId: params.plantId,
  });
  const dates = steps.map((t) => DateTime.fromISO(t.dueAtLocal));
  const start = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  const end = dates.reduce((max, d) => (d > max ? d : max), dates[0]);
  return {
    tasks: steps,
    totalCount: steps.length,
    dateRange: { start: start.toJSDate(), end: end.toJSDate() },
  };
}

async function isAlreadyApplied(
  plantId: string,
  templateId: string,
  idempotencyKey?: string
): Promise<boolean> {
  const tasks = database.collections.get('tasks' as any) as any;
  const rows = (await tasks.query().fetch()) as any[];
  return rows.some((r) => {
    const meta = (r as any).metadata ?? {};
    return (
      (r as any).plantId === plantId &&
      meta.templateId === templateId &&
      (idempotencyKey ? meta.idempotencyKey === idempotencyKey : true)
    );
  });
}

export async function applyTemplate(
  params: ApplyTemplateInput
): Promise<CreatedTaskRef[]> {
  const preview = buildPreviewTasks(params);

  if (
    await isAlreadyApplied(
      params.plantId,
      params.templateId,
      params.idempotencyKey
    )
  ) {
    return [];
  }

  const created: CreatedTaskRef[] = [];
  const createdIds: string[] = [];

  try {
    for (const p of preview) {
      const task = await createTask({
        title: p.title,
        description: p.description,
        timezone: p.timezone,
        dueAtLocal: p.dueAtLocal,
        reminderAtLocal: p.reminderAtLocal,
        plantId: params.plantId,
        metadata: p.metadata,
      });
      created.push({ id: task.id });
      createdIds.push(task.id);
    }
    return created;
  } catch (error) {
    // rollback on partial failure
    const tasks = database.collections.get('tasks' as any) as any;
    await database.write(async () => {
      for (const id of createdIds) {
        try {
          const t = await tasks.find(id);
          await (t as any).markAsDeleted();
        } catch {
          // ignore
        }
      }
    });
    throw error;
  }
}

export async function bulkShiftTasks(
  taskIds: string[],
  dayOffset: number
): Promise<string[]> {
  if (dayOffset === 0 || taskIds.length === 0) return [];
  const tasks = database.collections.get('tasks' as any) as any;
  const shifted: string[] = [];
  await database.write(async () => {
    for (const id of taskIds) {
      const model = await tasks.find(id);
      await (model as any).update((rec: any) => {
        const tz = (rec as any).timezone as string;
        const local = DateTime.fromISO((rec as any).dueAtLocal, {
          zone: tz,
        }).plus({ days: dayOffset });
        (rec as any).dueAtLocal = local.toISO();
        (rec as any).dueAtUtc = local.toUTC().toISO();
        if ((rec as any).reminderAtLocal) {
          const rLocal = DateTime.fromISO((rec as any).reminderAtLocal, {
            zone: tz,
          }).plus({ days: dayOffset });
          (rec as any).reminderAtLocal = rLocal.toISO();
          (rec as any).reminderAtUtc = rLocal.toUTC().toISO();
        }
        (rec as any).updatedAt = new Date();
      });
      shifted.push(id);
    }
  });
  return shifted;
}

// In-memory undo store for bulk shift operations
type BulkShiftSnapshot = {
  expiresAt: number;
  before: Map<
    string,
    {
      dueAtLocal: string;
      dueAtUtc: string;
      reminderAtLocal?: string | null;
      reminderAtUtc?: string | null;
    }
  >;
};

const bulkShiftUndoStore = new Map<string, BulkShiftSnapshot>();

export async function previewBulkShift(
  taskIds: string[],
  dayOffset: number
): Promise<
  {
    id: string;
    before: {
      dueAtLocal: string;
      dueAtUtc: string;
      reminderAtLocal?: string | null;
      reminderAtUtc?: string | null;
    };
    after: {
      dueAtLocal: string;
      dueAtUtc: string;
      reminderAtLocal?: string | null;
      reminderAtUtc?: string | null;
    };
  }[]
> {
  if (dayOffset === 0 || taskIds.length === 0) return [];
  const tasks = database.collections.get('tasks' as any) as any;
  const rows = (await tasks.query().fetch()) as any[];
  const byId = new Map(rows.map((r: any) => [r.id, r]));
  const out: any[] = [];
  for (const id of taskIds) {
    const rec: any = byId.get(id);
    if (!rec) continue;
    const tz = rec.timezone as string;
    const dueLocal = DateTime.fromISO(rec.dueAtLocal, { zone: tz });
    const afterDueLocal = dueLocal.plus({ days: dayOffset });
    const before = {
      dueAtLocal: rec.dueAtLocal,
      dueAtUtc: rec.dueAtUtc,
      reminderAtLocal: rec.reminderAtLocal ?? null,
      reminderAtUtc: rec.reminderAtUtc ?? null,
    };
    const after = {
      dueAtLocal: afterDueLocal.toISO(),
      dueAtUtc: afterDueLocal.toUTC().toISO(),
      reminderAtLocal: rec.reminderAtLocal
        ? DateTime.fromISO(rec.reminderAtLocal, { zone: tz })
            .plus({ days: dayOffset })
            .toISO()
        : null,
      reminderAtUtc: rec.reminderAtUtc
        ? DateTime.fromISO(rec.reminderAtUtc).plus({ days: dayOffset }).toISO()
        : null,
    };
    out.push({ id, before, after });
  }
  return out;
}

export async function applyBulkShiftWithUndo(
  taskIds: string[],
  dayOffset: number,
  ttlMs: number = 5000
): Promise<{ operationId: string; shiftedIds: string[] }> {
  const preview = await previewBulkShift(taskIds, dayOffset);
  const opId = `bulkshift:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const before = new Map<string, any>();
  for (const p of preview) before.set(p.id, p.before);
  const snapshot: BulkShiftSnapshot = {
    expiresAt: Date.now() + ttlMs,
    before,
  };
  bulkShiftUndoStore.set(opId, snapshot);
  setTimeout(() => {
    const s = bulkShiftUndoStore.get(opId);
    if (s && s.expiresAt <= Date.now()) bulkShiftUndoStore.delete(opId);
  }, ttlMs + 50);

  const shiftedIds = await bulkShiftTasks(taskIds, dayOffset);
  return { operationId: opId, shiftedIds };
}

export async function undoBulkShift(operationId: string): Promise<string[]> {
  const snapshot = bulkShiftUndoStore.get(operationId);
  if (!snapshot || snapshot.expiresAt < Date.now()) {
    bulkShiftUndoStore.delete(operationId);
    return [];
  }
  const tasks = database.collections.get('tasks' as any) as any;
  const restored: string[] = [];
  await database.write(async () => {
    for (const [id, before] of snapshot.before.entries()) {
      try {
        const model = await tasks.find(id);
        await (model as any).update((rec: any) => {
          (rec as any).dueAtLocal = before.dueAtLocal;
          (rec as any).dueAtUtc = before.dueAtUtc;
          (rec as any).reminderAtLocal = before.reminderAtLocal;
          (rec as any).reminderAtUtc = before.reminderAtUtc;
          (rec as any).updatedAt = new Date();
        });
        restored.push(id);
      } catch {
        // ignore missing
      }
    }
  });
  bulkShiftUndoStore.delete(operationId);
  return restored;
}
