import { DateTime } from 'luxon';

import {
  applyBulkShiftWithUndo,
  applyTemplate,
  previewBulkShift,
  previewTemplateApplication,
  undoBulkShift,
} from '@/lib/template-manager';
/* eslint-disable max-lines-per-function */
import { database } from '@/lib/watermelon';

describe('TemplateManager', () => {
  test('previewTemplateApplication produces correct count and range', () => {
    const anchor = new Date('2025-03-24T00:00:00Z');
    const tz = 'Europe/Berlin';
    const preview = previewTemplateApplication({
      templateId: 'basic-watering-v1',
      anchorDate: anchor,
      timezone: tz,
      plantId: 'plant-1',
    });
    expect(preview.totalCount).toBeGreaterThan(0);

    const start = DateTime.fromJSDate(preview.dateRange.start);
    const end = DateTime.fromJSDate(preview.dateRange.end);
    expect(end >= start).toBe(true);
    expect(preview.tasks.every((t) => t.timezone === tz)).toBe(true);
  });

  test('applyTemplate creates tasks and is idempotent with same key', async () => {
    const anchor = new Date('2025-03-24T00:00:00Z');
    const tz = 'Europe/Berlin';

    const created = await applyTemplate({
      templateId: 'basic-watering-v1',
      plantId: 'plant-2',
      anchorDate: anchor,
      timezone: tz,
      idempotencyKey: 'session-1',
    });
    expect(created.length).toBeGreaterThan(0);

    const again = await applyTemplate({
      templateId: 'basic-watering-v1',
      plantId: 'plant-2',
      anchorDate: anchor,
      timezone: tz,
      idempotencyKey: 'session-1',
    });
    expect(again.length).toBe(0);
  });

  test('bulkShiftTasks shifts due and reminder timestamps', async () => {
    const anchor = new Date('2025-03-24T00:00:00Z');
    const tz = 'Europe/Berlin';
    await applyTemplate({
      templateId: 'basic-watering-v1',
      plantId: 'plant-3',
      anchorDate: anchor,
      timezone: tz,
      idempotencyKey: `k-${Math.random()}`,
    });

    const tasks = database.collections.get('tasks' as any) as any;
    const rows = (await tasks
      .query()
      .where('plantId', 'plant-3')
      .fetch()) as any[];
    const ids = rows.slice(0, 2).map((r) => r.id);
    const before = rows.slice(0, 2).map((r) => r.dueAtLocal);

    const preview = await previewBulkShift(ids, 2);
    expect(preview.length).toBe(ids.length);
    const { operationId } = await applyBulkShiftWithUndo(ids, 2, 2000);
    const afterRows = (await tasks
      .query()
      .where('plantId', 'plant-3')
      .fetch()) as any[];
    const after = afterRows
      .filter((r) => ids.includes(r.id))
      .map((r) => r.dueAtLocal);

    expect(after.length).toBe(before.length);
    for (let i = 0; i < before.length; i++) {
      const b = DateTime.fromISO(before[i], { zone: tz });
      const a = DateTime.fromISO(after[i], { zone: tz });
      expect(Math.round(a.diff(b, 'days').days)).toBe(2);
    }

    const restoredIds = await undoBulkShift(operationId);
    expect(restoredIds.sort()).toEqual(ids.sort());
  });
});
