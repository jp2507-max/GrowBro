import { Platform } from 'react-native';

import { InvalidTaskTimestampError } from '@/lib/notification-errors';
import { TaskNotificationService } from '@/lib/task-notifications';

type MockTask = {
  id: string;
  title: string;
  description: string;
  reminderAtUtc: Date | string | null;
  reminderAtLocal: Date | string | null;
  dueAtUtc: Date | string | null;
  dueAtLocal: Date | string | null;
};

const baseTask: MockTask = {
  id: 'task-base',
  title: 'Task',
  description: 'Task description',
  reminderAtUtc: null,
  reminderAtLocal: null,
  dueAtUtc: null,
  dueAtLocal: null,
};

function createTask(overrides: Partial<MockTask>): MockTask {
  return { ...baseTask, ...overrides };
}

async function expectScheduleError(
  service: TaskNotificationService,
  overrides: Partial<MockTask>,
  expectedMessage: string
): Promise<void> {
  await service
    .scheduleTaskReminder(createTask(overrides) as any)
    .then(() => {
      throw new Error('Expected scheduleTaskReminder to reject');
    })
    .catch((error: unknown) => {
      expect(error).toBeInstanceOf(InvalidTaskTimestampError);
      if (error instanceof Error) {
        expect(error.message).toBe(expectedMessage);
      }
    });
}

describe('TaskNotificationService scheduleTaskReminder success', () => {
  let service: TaskNotificationService;

  beforeEach(() => {
    service = new TaskNotificationService();
  });

  test('uses reminderAtUtc when provided', async () => {
    const task = createTask({
      id: 'task-1',
      reminderAtUtc: new Date('2024-01-15T10:00:00Z'),
      reminderAtLocal: new Date('2024-01-15T12:00:00+02:00'),
      dueAtUtc: new Date('2024-01-15T18:00:00Z'),
      dueAtLocal: new Date('2024-01-15T20:00:00+02:00'),
    });

    await expect(service.scheduleTaskReminder(task as any)).resolves.toBe(
      'mock-notification-id'
    );
  });

  test('falls back to dueAtUtc when reminderAtUtc is missing', async () => {
    const task = createTask({
      id: 'task-2',
      reminderAtUtc: null,
      dueAtUtc: new Date('2024-01-15T18:00:00Z'),
      dueAtLocal: new Date('2024-01-15T20:00:00+02:00'),
    });

    await expect(service.scheduleTaskReminder(task as any)).resolves.toBe(
      'mock-notification-id'
    );
  });

  test('handles string timestamps', async () => {
    const task = createTask({
      id: 'task-5',
      reminderAtUtc: '2024-01-15T10:00:00Z',
    });

    await expect(service.scheduleTaskReminder(task as any)).resolves.toBe(
      'mock-notification-id'
    );
  });
});

describe('TaskNotificationService scheduleTaskReminder errors', () => {
  let service: TaskNotificationService;

  beforeEach(() => {
    service = new TaskNotificationService();
  });

  test('throws when both reminder and due timestamps are missing', async () => {
    await expectScheduleError(
      service,
      {
        id: 'task-3',
        reminderAtUtc: null,
        dueAtUtc: null,
      },
      'Invalid timestamp for task task-3: Both reminder timestamp (reminderAtUtc) and fallback due timestamp (dueAtUtc) are missing or null'
    );
  });

  test('throws for invalid timestamp strings', async () => {
    await expectScheduleError(
      service,
      {
        id: 'task-4',
        reminderAtUtc: 'invalid-date-string',
      },
      'Invalid timestamp for task task-4: Invalid date format: invalid-date-string'
    );
  });
});

describe('TaskNotificationService scheduleTaskReminder doze handling', () => {
  test('returns empty string when Android doze defers execution', async () => {
    const originalOS = Platform.OS;
    const originalVersion = Platform.Version;

    try {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      Object.defineProperty(Platform, 'Version', {
        value: 23,
        configurable: true,
      });

      const service = new TaskNotificationService();
      (service as any).isDozeRestricted = true;

      const task = createTask({
        id: 'task-doze',
        reminderAtUtc: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });

      await expect(service.scheduleTaskReminder(task as any)).resolves.toBe('');
    } finally {
      Object.defineProperty(Platform, 'OS', {
        value: originalOS,
        configurable: true,
      });
      Object.defineProperty(Platform, 'Version', {
        value: originalVersion,
        configurable: true,
      });
    }
  });
});

describe('TaskNotificationService computeNotificationDiff', () => {
  test('schedules, cancels, and skips tasks appropriately', () => {
    const tasks = [
      { id: 'a', status: 'pending', reminderAtUtc: '2024-01-01T10:00:00Z' },
      { id: 'b', status: 'pending', reminderAtUtc: '2024-02-01T10:00:00Z' },
      { id: 'c', status: 'completed', reminderAtUtc: '2024-03-01T10:00:00Z' },
      { id: 'd', status: 'pending', reminderAtUtc: null },
    ];
    const existing = [
      {
        taskId: 'a',
        notificationId: 'n1',
        scheduledForUtc: '2024-01-01T10:00:00Z',
        status: 'pending',
      },
      {
        taskId: 'b',
        notificationId: 'n2',
        scheduledForUtc: '2024-02-01T09:00:00Z',
        status: 'pending',
      },
      {
        taskId: 'c',
        notificationId: 'n3',
        scheduledForUtc: '2024-03-01T10:00:00Z',
        status: 'pending',
      },
      {
        taskId: 'x',
        notificationId: 'nX',
        scheduledForUtc: '2024-04-01T10:00:00Z',
        status: 'pending',
      },
    ];

    const diff = TaskNotificationService.computeNotificationDiff(
      tasks as any,
      existing as any
    );

    expect(diff.toCancel).toEqual(
      expect.arrayContaining([
        { notificationId: 'n2', taskId: 'b' },
        { notificationId: 'n3', taskId: 'c' },
      ])
    );
    expect(diff.toSchedule).toEqual(expect.arrayContaining([{ taskId: 'b' }]));
    expect(diff.toSchedule.find((item) => item.taskId === 'a')).toBeUndefined();
  });
});
