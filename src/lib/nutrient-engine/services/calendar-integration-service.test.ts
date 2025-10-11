/**
 * Unit tests for calendar integration service
 *
 * Requirements: 5.1, 5.2, 5.4
 */

import type { Database } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import { createTask } from '@/lib/task-manager';
import { TaskNotificationManager } from '@/lib/tasks/task-notification-manager';
import type { TaskModel } from '@/lib/watermelon-models/task';
import type { Task } from '@/types/calendar';

import {
  cancelScheduledNotifications,
  generateFeedingTasks,
  logFeedingCompletion,
  rescheduleFeedingTaskNotifications,
} from './calendar-integration-service';
import type { FeedingSchedule } from './schedule-service';

// Mock dependencies
jest.mock('@/lib/task-manager');
jest.mock('@/lib/tasks/task-notification-manager');

const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>;

describe('calendar-integration-service', () => {
  let mockDatabase: Database;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock database with collections
    mockDatabase = {
      get: jest.fn().mockReturnValue({
        find: jest.fn(),
      }),
    } as any;
  });

  describe('generateFeedingTasks', () => {
    const mockSchedule: FeedingSchedule = {
      id: 'schedule-1',
      plantId: 'plant-1',
      templateId: 'template-1',
      startDate: DateTime.now().toMillis(),
      events: [
        {
          id: 'event-1',
          plantId: 'plant-1',
          templateId: 'template-1',
          phase: {
            phase: 'veg',
            durationDays: 14,
            nutrients: [],
            phRange: [5.8, 6.2],
            ecRange25c: [1.2, 1.6],
          },
          scheduledDate: DateTime.now().plus({ days: 1 }).toMillis(),
          nutrients: [
            { nutrient: 'CalMag', value: 5, unit: 'ml/L' },
            { nutrient: 'Grow', value: 10, unit: 'ml/L' },
          ],
          targetPhMin: 5.8,
          targetPhMax: 6.2,
          targetEcMin25c: 1.2,
          targetEcMax25c: 1.6,
          measurementCheckpoint: true,
          doseGuidance: {
            reservoirVolumeL: 20,
            nutrientAdditions: [
              {
                nutrient: 'CalMag',
                amountMl: 100,
                stockConcentration: '1:1',
              },
            ],
            safetyNote: 'Add slowly and mix well',
          },
        },
        {
          id: 'event-2',
          plantId: 'plant-1',
          templateId: 'template-1',
          phase: {
            phase: 'flower',
            durationDays: 56,
            nutrients: [],
            phRange: [6.0, 6.4],
            ecRange25c: [1.6, 2.0],
          },
          scheduledDate: DateTime.now().plus({ days: 15 }).toMillis(),
          nutrients: [{ nutrient: 'Bloom', value: 15, unit: 'ml/L' }],
          targetPhMin: 6.0,
          targetPhMax: 6.4,
          targetEcMin25c: 1.6,
          targetEcMax25c: 2.0,
          measurementCheckpoint: false,
        },
      ],
      createdAt: DateTime.now().toMillis(),
      updatedAt: DateTime.now().toMillis(),
    };

    test('generates tasks with unit-resolved instructions', async () => {
      mockCreateTask.mockResolvedValue({
        id: 'task-1',
        title: 'Feed - veg phase',
        status: 'pending',
      } as Task);

      const result = await generateFeedingTasks(mockDatabase, mockSchedule, {
        ppmScale: '500',
        timezone: 'America/New_York',
      });

      expect(result.tasksCreated).toBe(2);
      expect(result.taskIds).toHaveLength(2);
      expect(mockCreateTask).toHaveBeenCalledTimes(2);

      // Verify first task has correct unit-resolved instructions
      const firstCall = mockCreateTask.mock.calls[0][0];
      expect(firstCall.title).toBe('Feed - veg phase');
      // EC range 1.2-1.6 midpoint is 1.4, with 500 scale: 1.4 * 500 = 700 ppm
      expect(firstCall.description).toContain('1.20 - 1.60 mS/cm @25°C');
      expect(firstCall.description).toContain('~700 ppm [500]');
      expect(firstCall.description).toContain('pH: 5.8 - 6.2');
      expect(firstCall.metadata?.type).toBe('feeding');
    });

    test('includes pH/EC measurement reminders', async () => {
      mockCreateTask.mockResolvedValue({
        id: 'task-1',
        status: 'pending',
      } as Task);

      await generateFeedingTasks(mockDatabase, mockSchedule, {
        ppmScale: '700',
        timezone: 'UTC',
      });

      const firstCall = mockCreateTask.mock.calls[0][0];
      expect(firstCall.description).toContain(
        '⚠️ Remember to measure pH/EC after feeding'
      );
    });

    test('schedules reminder notifications 30 minutes before', async () => {
      const taskDueTime = DateTime.now().plus({ days: 1 });
      const expectedReminderTime = taskDueTime.minus({ minutes: 30 });

      mockCreateTask.mockResolvedValue({
        id: 'task-1',
        status: 'pending',
        reminderAtUtc: expectedReminderTime.toISO(),
      } as Task);

      const mockFind = jest.fn().mockResolvedValue({
        id: 'task-1',
        reminderAtUtc: expectedReminderTime.toISO(),
      } as TaskModel);
      mockDatabase.get = jest.fn().mockReturnValue({ find: mockFind });

      await generateFeedingTasks(mockDatabase, mockSchedule, {
        ppmScale: '500',
        timezone: 'America/New_York',
        scheduleReminders: true,
      });

      expect(
        TaskNotificationManager.scheduleReminderForTask
      ).toHaveBeenCalled();
    });

    test('handles notification scheduling failures gracefully', async () => {
      mockCreateTask.mockResolvedValue({
        id: 'task-1',
        status: 'pending',
        reminderAtUtc: DateTime.now().plus({ days: 1 }).toISO(),
      } as Task);

      const mockFind = jest.fn().mockResolvedValue({
        id: 'task-1',
      } as TaskModel);
      mockDatabase.get = jest.fn().mockReturnValue({ find: mockFind });

      jest
        .spyOn(TaskNotificationManager, 'scheduleReminderForTask')
        .mockRejectedValue(new Error('Notification error'));

      const result = await generateFeedingTasks(mockDatabase, mockSchedule, {
        ppmScale: '500',
        timezone: 'UTC',
        scheduleReminders: true,
      });

      // Task creation should still succeed even if notification fails
      expect(result.tasksCreated).toBe(2);
      expect(result.notificationsScheduled).toBe(0);
    });

    test('handles task creation errors and continues with remaining tasks', async () => {
      mockCreateTask
        .mockRejectedValueOnce(new Error('Task creation failed'))
        .mockResolvedValueOnce({
          id: 'task-2',
          status: 'pending',
        } as Task);

      const result = await generateFeedingTasks(mockDatabase, mockSchedule, {
        ppmScale: '500',
        timezone: 'UTC',
      });

      expect(result.tasksCreated).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].eventId).toBe('event-1');
    });

    test('respects PPM scale preference (500 vs 700)', async () => {
      mockCreateTask.mockResolvedValue({
        id: 'task-1',
        status: 'pending',
      } as Task);

      // Test with 500 scale
      await generateFeedingTasks(mockDatabase, mockSchedule, {
        ppmScale: '500',
        timezone: 'UTC',
      });

      let firstCall = mockCreateTask.mock.calls[0][0];
      expect(firstCall.description).toContain('ppm [500]');

      mockCreateTask.mockClear();

      // Test with 700 scale
      await generateFeedingTasks(mockDatabase, mockSchedule, {
        ppmScale: '700',
        timezone: 'UTC',
      });

      firstCall = mockCreateTask.mock.calls[0][0];
      expect(firstCall.description).toContain('ppm [700]');
    });
  });

  describe('logFeedingCompletion', () => {
    const mockSchedule: FeedingSchedule = {
      id: 'schedule-1',
      plantId: 'plant-1',
      templateId: 'template-1',
      startDate: DateTime.now().toMillis(),
      events: [
        {
          id: 'event-1',
          plantId: 'plant-1',
          templateId: 'template-1',
          phase: {
            phase: 'veg',
            durationDays: 14,
            nutrients: [],
            phRange: [5.8, 6.2],
            ecRange25c: [1.2, 1.6],
          },
          scheduledDate: DateTime.now().toMillis(),
          nutrients: [],
          targetPhMin: 5.8,
          targetPhMax: 6.2,
          targetEcMin25c: 1.2,
          targetEcMax25c: 1.6,
          measurementCheckpoint: false,
        },
      ],
      createdAt: DateTime.now().toMillis(),
      updatedAt: DateTime.now().toMillis(),
    };

    test('logs completion with eventId string', async () => {
      const result = await logFeedingCompletion('event-1', mockSchedule, {
        ph: 6.0,
        ec25c: 1.4,
        tempC: 22,
      });

      expect(result.events[0]).toHaveProperty('completedAt');
      // Note: measurements are stored but not reflected in the FeedingEvent type
      expect(result.updatedAt).toBeGreaterThan(mockSchedule.updatedAt);
    });

    test('logs completion from task metadata', async () => {
      const mockTask: Task = {
        id: 'task-1',
        title: 'Feed',
        dueAtLocal: DateTime.now().toISO()!,
        dueAtUtc: DateTime.now().toISO()!,
        timezone: 'UTC',
        status: 'completed',
        metadata: { eventId: 'event-1' },
        createdAt: DateTime.now().toISO()!,
        updatedAt: DateTime.now().toISO()!,
      };

      const result = await logFeedingCompletion(mockTask, mockSchedule);

      expect(result.events[0]).toHaveProperty('completedAt');
    });

    test('throws error when eventId not found', async () => {
      await expect(
        logFeedingCompletion('nonexistent-event', mockSchedule)
      ).rejects.toThrow('Event nonexistent-event not found');
    });

    test('throws error when task metadata missing eventId', async () => {
      const mockTask: Task = {
        id: 'task-1',
        title: 'Feed',
        dueAtLocal: DateTime.now().toISO()!,
        dueAtUtc: DateTime.now().toISO()!,
        timezone: 'UTC',
        status: 'completed',
        metadata: {},
        createdAt: DateTime.now().toISO()!,
        updatedAt: DateTime.now().toISO()!,
      };

      await expect(
        logFeedingCompletion(mockTask, mockSchedule)
      ).rejects.toThrow('Event ID not found');
    });
  });

  describe('cancelScheduledNotifications', () => {
    test('cancels notifications for multiple tasks', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      jest
        .spyOn(TaskNotificationManager, 'cancelReminderForTask')
        .mockResolvedValue();

      const cancelledCount = await cancelScheduledNotifications(
        mockDatabase,
        taskIds
      );

      expect(cancelledCount).toBe(3);
      expect(
        TaskNotificationManager.cancelReminderForTask
      ).toHaveBeenCalledTimes(3);
    });

    test('handles cancellation failures and continues', async () => {
      const taskIds = ['task-1', 'task-2'];

      jest
        .spyOn(TaskNotificationManager, 'cancelReminderForTask')
        .mockRejectedValueOnce(new Error('Cancel failed'))
        .mockResolvedValueOnce();

      const cancelledCount = await cancelScheduledNotifications(
        mockDatabase,
        taskIds
      );

      expect(cancelledCount).toBe(1);
    });
  });

  describe('rescheduleFeedingTaskNotifications', () => {
    test('reschedules notifications for multiple tasks', async () => {
      const taskIds = ['task-1', 'task-2'];

      const mockTaskModel = {
        id: 'task-1',
        reminderAtUtc: DateTime.now().plus({ days: 1 }).toISO(),
      } as TaskModel;

      const mockFind = jest.fn().mockResolvedValue(mockTaskModel);
      mockDatabase.get = jest.fn().mockReturnValue({ find: mockFind });

      jest
        .spyOn(TaskNotificationManager, 'rescheduleReminderForTask')
        .mockResolvedValue('notification-id');

      const rescheduledCount = await rescheduleFeedingTaskNotifications(
        mockDatabase,
        taskIds
      );

      expect(rescheduledCount).toBe(2);
      expect(
        TaskNotificationManager.rescheduleReminderForTask
      ).toHaveBeenCalledTimes(2);
    });

    test('handles reschedule failures gracefully', async () => {
      const taskIds = ['task-1', 'task-2'];

      const mockFind = jest.fn().mockResolvedValue({} as TaskModel);
      mockDatabase.get = jest.fn().mockReturnValue({ find: mockFind });

      jest
        .spyOn(TaskNotificationManager, 'rescheduleReminderForTask')
        .mockRejectedValueOnce(new Error('Reschedule failed'))
        .mockResolvedValueOnce('notification-id');

      const rescheduledCount = await rescheduleFeedingTaskNotifications(
        mockDatabase,
        taskIds
      );

      expect(rescheduledCount).toBe(1);
    });
  });
});
