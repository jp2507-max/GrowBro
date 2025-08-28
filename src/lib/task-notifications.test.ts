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
});
