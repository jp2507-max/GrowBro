import {
  completeRecurringInstance,
  completeTask,
  createSeries,
  createTask,
  deleteSeries,
  deleteTask,
  getTasksByDateRange,
  skipRecurringInstance,
  updateTask,
} from './task-manager';
import { TaskNotificationService } from './task-notifications';

// These are lightweight integration-style tests that exercise core flows
// without asserting on Watermelon internals. They verify shapes and basic
// invariants per Task 3 requirements.

const createDailySeries = () =>
  createSeries({
    title: 'Daily misting',
    timezone: 'Europe/Berlin',
    description: 'Misting at 08:00',
    dtstartLocal: '2025-03-24T08:00:00+01:00',
    dtstartUtc: '2025-03-24T07:00:00Z',
    rrule: 'FREQ=DAILY;INTERVAL=1',
  });

const createWeeklySeries = () =>
  createSeries({
    title: 'Weekly pruning',
    timezone: 'Europe/Berlin',
    description: 'Prune on Mondays',
    dtstartLocal: '2025-03-24T09:00:00+01:00',
    dtstartUtc: '2025-03-24T08:00:00Z',
    rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
  });

const createWeeklyCheckSeries = () =>
  createSeries({
    title: 'Weekly check',
    timezone: 'Europe/Berlin',
    description: 'Check on Mondays',
    dtstartLocal: '2025-03-24T09:00:00+01:00',
    dtstartUtc: '2025-03-24T08:00:00Z',
    rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
  });

describe('TaskManager basic flows', () => {
  test('create/update/delete one-off task', async () => {
    const task = await createTask({
      title: 'Water plants',
      description: 'Daily watering',
      timezone: 'Europe/Berlin',
      dueAtLocal: '2025-03-25T08:00:00+01:00',
    });

    expect(task.id).toBeTruthy();
    expect(task.status).toBe('pending');
    expect(task.dueAtUtc).toMatch(/Z$/);

    const updated = await updateTask(task.id, { title: 'Water + check pH' });
    expect(updated.title).toBe('Water + check pH');

    await deleteTask(task.id);
  });

  test('series create and visible window materialization (lazy)', async () => {
    const series = await createSeries({
      title: 'Weekly feeding',
      description: 'Feed every week on Monday',
      timezone: 'Europe/Berlin',
      dtstartLocal: '2025-03-24T08:00:00+01:00',
      dtstartUtc: '2025-03-24T07:00:00Z',
      rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO',
    });

    const now = new Date('2025-03-23T00:00:00Z');
    const end = new Date('2025-04-07T00:00:00Z');
    const tasks = await getTasksByDateRange(now, end);

    // Should include visible occurrences from series (ephemeral if not stored)
    expect(tasks.some((t) => t.seriesId === series.id)).toBe(true);

    await deleteSeries(series.id);
  });

  test('complete task and materialize next for recurring', async () => {
    const series = await createDailySeries();

    // Completing an ephemeral occurrence requires creating a stored task first.
    // Simulate by creating a concrete task for the first date, then complete it.
    const concrete = await createTask({
      title: series.title,
      description: series.description,
      timezone: series.timezone,
      dueAtLocal: '2025-03-24T08:00:00+01:00',
      seriesId: series.id,
    });

    const done = await completeTask(concrete.id);
    expect(done.status).toBe('completed');

    const rangeStart = new Date('2025-03-24T00:00:00Z');
    const after = await getTasksByDateRange(
      rangeStart,
      new Date('2025-03-28T00:00:00Z')
    );
    // Expect a next occurrence visible
    expect(
      after.some((t) => t.seriesId === series.id && t.id !== concrete.id)
    ).toBe(true);

    await deleteSeries(series.id);
  });

  test('skip recurring instance via override', async () => {
    const series = await createWeeklySeries();

    await skipRecurringInstance(series.id, new Date('2025-03-31T00:00:00Z'));

    const tasks = await getTasksByDateRange(
      new Date('2025-03-24T00:00:00Z'),
      new Date('2025-04-07T00:00:00Z')
    );

    // Occurrence on 2025-03-31 should be skipped
    const hasSkipped = tasks.find(
      (t) => t.seriesId === series.id && t.dueAtLocal.startsWith('2025-03-31')
    );
    expect(hasSkipped).toBeFalsy();

    await deleteSeries(series.id);
  });

  test('complete recurring instance via override and materialize next', async () => {
    const series = await createWeeklyCheckSeries();

    await completeRecurringInstance(
      series.id,
      new Date('2025-03-24T00:00:00Z')
    );

    const tasks = await getTasksByDateRange(
      new Date('2025-03-24T00:00:00Z'),
      new Date('2025-04-14T00:00:00Z')
    );

    expect(tasks.some((t) => t.seriesId === series.id)).toBe(true);

    await deleteSeries(series.id);
  });

  test('reschedule recurring instance override persists and affects visibility', async () => {
    const series = await createWeeklySeries();
    // pick Monday 2025-03-31, move time to 10:30 local
    // Using concrete task to simulate reschedule flow; no separate originalDate needed
    // Use the menu flow equivalent via task-manager API directly
    // Create an ephemeral-like override by creating a concrete task then moving it
    const concrete = await createTask({
      title: series.title,
      description: series.description,
      timezone: series.timezone,
      dueAtLocal: '2025-03-31T09:00:00+02:00',
      seriesId: series.id,
    });

    // Move to 10:30 same day using updateTask (UI does this) and expect override integration to handle future materialization
    const updated = await updateTask(concrete.id, {
      dueAtLocal: '2025-03-31T10:30:00+02:00',
      timezone: series.timezone,
    });
    expect(updated.dueAtLocal.startsWith('2025-03-31T10:30')).toBe(true);

    const tasks = await getTasksByDateRange(
      new Date('2025-03-24T00:00:00Z'),
      new Date('2025-04-07T00:00:00Z')
    );
    const moved = tasks.find(
      (t) => t.seriesId === series.id && t.dueAtLocal.startsWith('2025-03-31')
    );
    expect(moved).toBeTruthy();

    await deleteSeries(series.id);
  });
});

describe('TaskManager notification scheduling', () => {
  test('createTask respects scheduleNotifications=false', async () => {
    const scheduleSpy = jest
      .spyOn(TaskNotificationService.prototype, 'scheduleTaskReminder')
      .mockResolvedValue('notification-id');

    const task = await createTask({
      title: 'Water plants',
      description: 'Daily watering',
      timezone: 'Europe/Berlin',
      dueAtLocal: '2025-03-26T08:00:00+01:00',
      scheduleNotifications: false,
    });

    expect(scheduleSpy).not.toHaveBeenCalled();
    await deleteTask(task.id);
    scheduleSpy.mockRestore();
  });

  test('createTask schedules reminders by default', async () => {
    const scheduleSpy = jest
      .spyOn(TaskNotificationService.prototype, 'scheduleTaskReminder')
      .mockResolvedValue('notification-id');

    const task = await createTask({
      title: 'Check humidity',
      description: 'Daily check',
      timezone: 'Europe/Berlin',
      dueAtLocal: '2025-03-27T08:00:00+01:00',
    });

    expect(scheduleSpy).toHaveBeenCalled();
    await deleteTask(task.id);
    scheduleSpy.mockRestore();
  });
});
