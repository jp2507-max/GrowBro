/* eslint-disable max-lines-per-function */
import { InvalidTaskTimestampError } from './notification-errors';
import { TaskNotificationService } from './task-notifications';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest
    .fn()
    .mockResolvedValue('mock-notification-id'),
}));

describe('TaskNotificationService', () => {
  let service: TaskNotificationService;

  beforeEach(() => {
    service = new TaskNotificationService();
  });

  describe('scheduleTaskReminder', () => {
    it('should use reminderAtUtc when expectsUtc is true and reminderAtUtc is available', async () => {
      const task = {
        id: 'task-1',
        title: 'Water plants',
        description: 'Water the cannabis plants',
        reminderAtUtc: new Date('2024-01-15T10:00:00Z'),
        reminderAtLocal: new Date('2024-01-15T12:00:00+02:00'),
        dueAtUtc: new Date('2024-01-15T18:00:00Z'),
        dueAtLocal: new Date('2024-01-15T20:00:00+02:00'),
      };

      const notificationId = await service.scheduleTaskReminder(task);
      expect(notificationId).toBe('mock-notification-id');
    });

    it('should fall back to dueAtUtc when reminderAtUtc is missing', async () => {
      const task = {
        id: 'task-2',
        title: 'Check pH levels',
        description: 'Check and adjust pH levels',
        reminderAtUtc: null,
        reminderAtLocal: null,
        dueAtUtc: new Date('2024-01-15T18:00:00Z'),
        dueAtLocal: new Date('2024-01-15T20:00:00+02:00'),
      };

      const notificationId = await service.scheduleTaskReminder(task);
      expect(notificationId).toBe('mock-notification-id');
    });

    it('should throw InvalidTaskTimestampError when both reminder and due timestamps are missing', async () => {
      const task = {
        id: 'task-3',
        title: 'Harvest',
        description: 'Harvest the plants',
        reminderAtUtc: null,
        reminderAtLocal: null,
        dueAtUtc: null,
        dueAtLocal: null,
      };

      await expect(service.scheduleTaskReminder(task)).rejects.toThrow(
        InvalidTaskTimestampError
      );
      await expect(service.scheduleTaskReminder(task)).rejects.toThrow(
        'Invalid timestamp for task task-3: Both reminder timestamp (reminderAtUtc) and fallback due timestamp (dueAtUtc) are missing or null'
      );
    });

    it('should throw InvalidTaskTimestampError when timestamp is invalid date string', async () => {
      const task = {
        id: 'task-4',
        title: 'Feed nutrients',
        description: 'Feed nutrients to plants',
        reminderAtUtc: 'invalid-date-string',
        reminderAtLocal: null,
        dueAtUtc: null,
        dueAtLocal: null,
      };

      await expect(service.scheduleTaskReminder(task)).rejects.toThrow(
        InvalidTaskTimestampError
      );
      await expect(service.scheduleTaskReminder(task)).rejects.toThrow(
        'Invalid timestamp for task task-4: Invalid date format: invalid-date-string'
      );
    });

    it('should handle string timestamps correctly', async () => {
      const task = {
        id: 'task-5',
        title: 'Trim leaves',
        description: 'Trim dead leaves',
        reminderAtUtc: '2024-01-15T10:00:00Z',
        reminderAtLocal: null,
        dueAtUtc: null,
        dueAtLocal: null,
      };

      const notificationId = await service.scheduleTaskReminder(task);
      expect(notificationId).toBe('mock-notification-id');
    });
  });

  describe('computeNotificationDiff', () => {
    it('schedules when missing; cancels when outdated; no-ops when unchanged', () => {
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
          scheduledForUtc: '2024-02-01T09:00:00Z', // outdated
          status: 'pending',
        },
        {
          taskId: 'c',
          notificationId: 'n3',
          scheduledForUtc: '2024-03-01T10:00:00Z', // but task completed
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

      // a unchanged; b needs cancel+reschedule; c needs cancel; d no schedule
      expect(diff.toCancel).toEqual(
        expect.arrayContaining([
          { notificationId: 'n2', taskId: 'b' },
          { notificationId: 'n3', taskId: 'c' },
        ])
      );
      expect(diff.toSchedule).toEqual(
        expect.arrayContaining([{ taskId: 'b' }])
      );
      // Ensure we did not suggest rescheduling for 'a' (already matching)
      expect(diff.toSchedule.find((x) => x.taskId === 'a')).toBeUndefined();
    });
  });
});
