/**
 * Task Customization Service Tests
 */

import { type Database } from '@nozbe/watermelondb';

import type { PlaybookTaskMetadata } from '@/types/playbook';

import type { AnalyticsClient } from '../analytics';
import { type TaskModel } from '../watermelon-models/task';
import { TaskCustomizationService } from './task-customization';

// Mock database
const mockDatabase = {
  get: jest.fn(),
  write: jest.fn(),
} as unknown as Database;

// Mock analytics
const mockAnalytics: AnalyticsClient = {
  track: jest.fn(),
};

describe('TaskCustomizationService', () => {
  let service: TaskCustomizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TaskCustomizationService({
      database: mockDatabase,
      analytics: mockAnalytics,
    });
  });

  describe('updateTask', () => {
    it('should set manualEdited flag on first edit', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Original Title',
        description: 'Original Description',
        dueAtLocal: '2025-01-01T09:00:00',
        dueAtUtc: '2025-01-01T09:00:00Z',
        playbookId: 'playbook-1',
        originStepId: 'step-1',
        phaseIndex: 0,
        metadata: {
          flags: {
            manualEdited: false,
            excludeFromBulkShift: false,
          },
        } as PlaybookTaskMetadata,
        update: jest.fn((fn) => {
          fn(mockTask);
          return Promise.resolve(mockTask);
        }),
      } as unknown as TaskModel;

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockTask),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);
      (mockDatabase.write as jest.Mock).mockImplementation((fn) => fn());

      const result = await service.updateTask('task-1', {
        title: 'New Title',
      });

      expect(result.fieldsChanged).toContain('title');
      expect(mockTask.update).toHaveBeenCalled();
      expect(mockAnalytics.track).toHaveBeenCalledWith(
        'playbook_task_customized',
        expect.objectContaining({
          taskId: 'task-1',
          customizationType: 'modify',
        })
      );
    });

    it('should break inheritance for title changes', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Original Title',
        description: 'Description',
        dueAtLocal: '2025-01-01T09:00:00',
        dueAtUtc: '2025-01-01T09:00:00Z',
        playbookId: 'playbook-1',
        originStepId: 'step-1',
        metadata: {
          flags: {
            manualEdited: false,
            excludeFromBulkShift: false,
          },
        } as PlaybookTaskMetadata,
        update: jest.fn((fn) => {
          fn(mockTask);
          return Promise.resolve(mockTask);
        }),
      } as unknown as TaskModel;

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockTask),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);
      (mockDatabase.write as jest.Mock).mockImplementation((fn) => fn());

      const result = await service.updateTask('task-1', {
        title: 'New Title',
      });

      expect(result.fieldsChanged).toEqual(['title']);
      expect(mockAnalytics.track).toHaveBeenCalledWith(
        'playbook_task_customized',
        expect.objectContaining({
          customizationType: 'modify',
        })
      );
    });

    it('should not break inheritance for custom notes only', async () => {
      const mockTask = {
        id: 'task-1',
        title: 'Title',
        description: 'Description',
        dueAtLocal: '2025-01-01T09:00:00',
        dueAtUtc: '2025-01-01T09:00:00Z',
        playbookId: 'playbook-1',
        originStepId: 'step-1',
        metadata: {
          flags: {
            manualEdited: false,
            excludeFromBulkShift: false,
          },
        } as PlaybookTaskMetadata,
        update: jest.fn((fn) => {
          fn(mockTask);
          return Promise.resolve(mockTask);
        }),
      } as unknown as TaskModel;

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockTask),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);
      (mockDatabase.write as jest.Mock).mockImplementation((fn) => fn());

      const result = await service.updateTask('task-1', {
        customNotes: 'My custom note',
      });

      expect(result.fieldsChanged).toEqual(['customNotes']);
      expect(mockAnalytics.track).toHaveBeenCalledWith(
        'playbook_task_customized',
        expect.objectContaining({
          customizationType: 'modify',
        })
      );
    });
  });

  describe('addCustomNote', () => {
    it('should add custom note without breaking inheritance', async () => {
      const mockTask = {
        id: 'task-1',
        playbookId: 'playbook-1',
        originStepId: 'step-1',
        metadata: {
          flags: {
            manualEdited: false,
            excludeFromBulkShift: false,
          },
        } as PlaybookTaskMetadata,
        update: jest.fn((fn) => {
          fn(mockTask);
          return Promise.resolve(mockTask);
        }),
      } as unknown as TaskModel;

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockTask),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);
      (mockDatabase.write as jest.Mock).mockImplementation((fn) => fn());

      await service.addCustomNote('task-1', 'My note');

      expect(mockTask.update).toHaveBeenCalled();
      expect(mockAnalytics.track).toHaveBeenCalledWith(
        'playbook_task_customized',
        expect.objectContaining({
          customizationType: 'modify',
        })
      );
    });
  });

  describe('updateReminder', () => {
    it('should update reminder and break inheritance', async () => {
      const mockTask = {
        id: 'task-1',
        playbookId: 'playbook-1',
        originStepId: 'step-1',
        metadata: {
          flags: {
            manualEdited: false,
            excludeFromBulkShift: false,
          },
        } as PlaybookTaskMetadata,
        update: jest.fn((fn) => {
          fn(mockTask);
          return Promise.resolve(mockTask);
        }),
      } as unknown as TaskModel;

      const mockCollection = {
        find: jest.fn().mockResolvedValue(mockTask),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);
      (mockDatabase.write as jest.Mock).mockImplementation((fn) => fn());

      await service.updateReminder(
        'task-1',
        '2025-01-01T10:00:00',
        '2025-01-01T10:00:00Z'
      );

      expect(mockTask.update).toHaveBeenCalled();
      expect(mockAnalytics.track).toHaveBeenCalledWith(
        'playbook_task_customized',
        expect.objectContaining({
          customizationType: 'time',
        })
      );
    });
  });

  describe('getCustomizationStats', () => {
    it('should calculate customization percentage correctly', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          metadata: {
            flags: { manualEdited: true, excludeFromBulkShift: false },
          } as PlaybookTaskMetadata,
        },
        {
          id: 'task-2',
          metadata: {
            flags: { manualEdited: false, excludeFromBulkShift: false },
          } as PlaybookTaskMetadata,
        },
        {
          id: 'task-3',
          metadata: {
            flags: { manualEdited: true, excludeFromBulkShift: true },
          } as PlaybookTaskMetadata,
        },
        {
          id: 'task-4',
          metadata: {
            flags: { manualEdited: false, excludeFromBulkShift: false },
          } as PlaybookTaskMetadata,
        },
      ] as TaskModel[];

      const mockCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockTasks),
        }),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);

      const stats = await service.getCustomizationStats('plant-1');

      expect(stats.totalTasks).toBe(4);
      expect(stats.customizedTasks).toBe(2);
      expect(stats.customizationPercentage).toBe(50);
      expect(stats.excludedFromBulkShift).toBe(1);
    });
  });

  describe('shouldPromptTemplateSave', () => {
    it('should return true when customization exceeds threshold', async () => {
      const mockTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        metadata: {
          flags: {
            manualEdited: i < 3, // 30% customized
            excludeFromBulkShift: false,
          },
        } as PlaybookTaskMetadata,
      })) as TaskModel[];

      const mockCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockTasks),
        }),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);

      const shouldPrompt = await service.shouldPromptTemplateSave(
        'plant-1',
        20
      );

      expect(shouldPrompt).toBe(true);
    });

    it('should return false when customization below threshold', async () => {
      const mockTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        metadata: {
          flags: {
            manualEdited: i < 1, // 10% customized
            excludeFromBulkShift: false,
          },
        } as PlaybookTaskMetadata,
      })) as TaskModel[];

      const mockCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockTasks),
        }),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);

      const shouldPrompt = await service.shouldPromptTemplateSave(
        'plant-1',
        20
      );

      expect(shouldPrompt).toBe(false);
    });
  });
});
