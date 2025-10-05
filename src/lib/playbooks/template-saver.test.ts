/**
 * Template Saver Service Tests
 */

import { type Database } from '@nozbe/watermelondb';

import type { Playbook, PlaybookTaskMetadata } from '@/types/playbook';

import type { AnalyticsClient } from '../analytics';
import { type PlaybookModel } from '../watermelon-models/playbook';
import { type TaskModel } from '../watermelon-models/task';
import { TemplateSaverService } from './template-saver';

// Mock database
const mockDatabase = {
  get: jest.fn(),
  write: jest.fn(),
} as unknown as Database;

// Mock analytics
const mockAnalytics: AnalyticsClient = {
  track: jest.fn(),
};

describe('TemplateSaverService', () => {
  let service: TemplateSaverService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TemplateSaverService({
      database: mockDatabase,
      analytics: mockAnalytics,
    });
  });

  describe('analyzeCustomizations', () => {
    it('should calculate customization percentage correctly', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          playbookId: 'playbook-1',
          metadata: {
            flags: { manualEdited: true },
          } as PlaybookTaskMetadata,
        },
        {
          id: 'task-2',
          playbookId: 'playbook-1',
          metadata: {
            flags: { manualEdited: false },
          } as PlaybookTaskMetadata,
        },
        {
          id: 'task-3',
          playbookId: 'playbook-1',
          metadata: {
            flags: { manualEdited: true },
          } as PlaybookTaskMetadata,
        },
      ] as TaskModel[];

      const mockCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockTasks),
        }),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await service.analyzeCustomizations('plant-1');

      expect(result.totalTasks).toBe(3);
      expect(result.customizedTasks).toBe(2);
      expect(result.customizationPercentage).toBeCloseTo(66.67, 1);
      expect(result.shouldPromptSave).toBe(true);
      expect(result.customizedTaskIds).toEqual(['task-1', 'task-3']);
    });

    it('should not prompt save when below threshold', async () => {
      const mockTasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        playbookId: 'playbook-1',
        metadata: {
          flags: { manualEdited: i === 0 }, // 10% customized
        } as PlaybookTaskMetadata,
      })) as TaskModel[];

      const mockCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockTasks),
        }),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockCollection);

      const result = await service.analyzeCustomizations('plant-1');

      expect(result.customizationPercentage).toBe(10);
      expect(result.shouldPromptSave).toBe(false);
    });
  });

  describe('validateTemplate', () => {
    it('should validate a correct template', () => {
      const validPlaybook: Playbook = {
        id: 'playbook-1',
        name: 'Test Playbook',
        setup: 'auto_indoor',
        locale: 'en',
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            title: 'Water seedling',
            descriptionIcu: 'Water the seedling',
            relativeDay: 0,
            defaultReminderLocal: '08:00',
            taskType: 'water',
            dependencies: [],
          },
        ],
        metadata: {},
        isTemplate: true,
        isCommunity: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const result = service.validateTemplate(validPlaybook);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidPlaybook = {
        id: 'playbook-1',
        name: '',
        setup: null,
        locale: '',
        phaseOrder: [],
        steps: [],
        metadata: {},
        isTemplate: true,
        isCommunity: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      } as unknown as Playbook;

      const result = service.validateTemplate(invalidPlaybook);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template name is required');
      expect(result.errors).toContain('Setup type is required');
      expect(result.errors).toContain('Locale is required');
      expect(result.errors).toContain('Phase order is required');
      expect(result.errors).toContain('At least one step is required');
    });

    it('should detect invalid steps', () => {
      const invalidPlaybook: Playbook = {
        id: 'playbook-1',
        name: 'Test',
        setup: 'auto_indoor',
        locale: 'en',
        phaseOrder: ['seedling'],
        steps: [
          {
            id: '',
            phase: 'seedling' as any,
            title: '',
            descriptionIcu: '',
            relativeDay: -1,
            defaultReminderLocal: '08:00',
            taskType: '' as any,
            dependencies: [],
          },
        ],
        metadata: {},
        isTemplate: true,
        isCommunity: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const result = service.validateTemplate(invalidPlaybook);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should warn about potential PII in name', () => {
      const playbookWithPII: Playbook = {
        id: 'playbook-1',
        name: 'John Doe 555-123-4567',
        setup: 'auto_indoor',
        locale: 'en',
        phaseOrder: ['seedling'],
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            title: 'Water',
            descriptionIcu: 'Water',
            relativeDay: 0,
            defaultReminderLocal: '08:00',
            taskType: 'water',
            dependencies: [],
          },
        ],
        metadata: {},
        isTemplate: true,
        isCommunity: false,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const result = service.validateTemplate(playbookWithPII);

      expect(result.warnings).toContain(
        'Template name may contain phone number'
      );
    });
  });

  describe('saveAsTemplate', () => {
    it('should create a new playbook from tasks', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Water seedling',
          description: 'Water the seedling',
          dueAtUtc: '2025-01-01T08:00:00Z',
          dueAtLocal: '2025-01-01T08:00:00',
          reminderAtLocal: '2025-01-01T08:00:00',
          playbookId: 'original-playbook',
          originStepId: 'step-1',
          metadata: {
            phaseIndex: 0,
            flags: { manualEdited: true },
          } as PlaybookTaskMetadata,
        },
        {
          id: 'task-2',
          title: 'Feed nutrients',
          description: 'Feed the plant',
          dueAtUtc: '2025-01-03T08:00:00Z',
          dueAtLocal: '2025-01-03T08:00:00',
          reminderAtLocal: '2025-01-03T08:00:00',
          playbookId: 'original-playbook',
          originStepId: 'step-2',
          metadata: {
            phaseIndex: 1,
            flags: { manualEdited: true },
          } as PlaybookTaskMetadata,
        },
      ] as TaskModel[];

      const mockOriginalPlaybook = {
        id: 'original-playbook',
        setup: 'auto_indoor',
        locale: 'en',
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            title: 'Water seedling',
            descriptionIcu: 'Water the seedling',
            relativeDay: 0,
            defaultReminderLocal: '08:00',
            taskType: 'water',
            dependencies: ['step-prereq'],
            rrule: 'FREQ=WEEKLY;BYDAY=MO',
            durationDays: 1,
          },
          {
            id: 'step-2',
            phase: 'veg',
            title: 'Feed nutrients',
            descriptionIcu: 'Feed the plant',
            relativeDay: 2,
            defaultReminderLocal: '09:00',
            taskType: 'feed',
            dependencies: [],
          },
        ],
        metadata: {
          difficulty: 'beginner',
          strainTypes: ['indica'],
        },
      } as PlaybookModel;

      const mockTasksCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue(mockTasks),
        }),
      };

      const mockPlaybooksCollection = {
        find: jest.fn().mockResolvedValue(mockOriginalPlaybook),
        create: jest.fn((fn) => {
          const record = {
            id: 'generated-id',
            createdAt: new Date('2025-01-01T00:00:00Z'),
            updatedAt: new Date('2025-01-01T00:00:00Z'),
            _raw: {},
          } as any;
          fn(record);
          return Promise.resolve(record);
        }),
      };

      (mockDatabase.get as jest.Mock).mockImplementation((table: string) => {
        if (table === 'tasks') return mockTasksCollection;
        if (table === 'playbooks') return mockPlaybooksCollection;
        return null;
      });

      (mockDatabase.write as jest.Mock).mockImplementation((fn) => fn());

      const result = await service.saveAsTemplate('plant-1', {
        name: 'My Custom Playbook',
        authorHandle: 'testuser',
        tags: ['custom', 'indoor'],
        license: 'CC-BY-SA',
        isCommunity: true,
      });

      expect(result.name).toBe('My Custom Playbook');
      expect(result.steps).toHaveLength(2);
      expect(result.isTemplate).toBe(true);
      expect(result.isCommunity).toBe(true);
      expect(result.license).toBe('CC-BY-SA');

      // Verify that dependencies and other fields are preserved from original steps
      expect(result.steps[0]).toMatchObject({
        id: 'step-1',
        phase: 'seedling',
        title: 'Water seedling',
        descriptionIcu: 'Water the seedling',
        relativeDay: 0,
        defaultReminderLocal: '08:00',
        taskType: 'water',
        dependencies: ['step-prereq'],
        rrule: 'FREQ=WEEKLY;BYDAY=MO',
        durationDays: 1,
      });

      expect(result.steps[1]).toMatchObject({
        id: 'step-2',
        phase: 'veg',
        title: 'Feed nutrients',
        descriptionIcu: 'Feed the plant',
        relativeDay: 2,
        defaultReminderLocal: '09:00',
        taskType: 'feed',
        dependencies: [],
      });

      expect(mockAnalytics.track).toHaveBeenCalledWith(
        'playbook_saved_as_template',
        expect.objectContaining({
          templateName: 'My Custom Playbook',
          isPublic: true,
        })
      );
    });

    it('should throw error when no tasks found', async () => {
      const mockTasksCollection = {
        query: jest.fn().mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        }),
      };

      (mockDatabase.get as jest.Mock).mockReturnValue(mockTasksCollection);

      await expect(
        service.saveAsTemplate('plant-1', {
          name: 'Test',
        })
      ).rejects.toThrow('No tasks found for plant');
    });

    it('should throw error when tasks exist but none have playbookId', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: 'Water seedling',
          description: 'Water the seedling',
          dueAtUtc: '2025-01-01T08:00:00Z',
          dueAtLocal: '2025-01-01T08:00:00',
          reminderAtLocal: '2025-01-01T08:00:00',
          playbookId: null, // No playbookId
          originStepId: 'step-1',
          metadata: {
            phaseIndex: 0,
            flags: { manualEdited: true },
          } as PlaybookTaskMetadata,
        },
        {
          id: 'task-2',
          title: 'Feed nutrients',
          description: 'Feed the plant',
          dueAtUtc: '2025-01-03T08:00:00Z',
          dueAtLocal: '2025-01-03T08:00:00',
          reminderAtLocal: '2025-01-03T08:00:00',
          playbookId: undefined, // No playbookId
          originStepId: 'step-2',
          metadata: {
            phaseIndex: 1,
            flags: { manualEdited: true },
          } as PlaybookTaskMetadata,
        },
      ] as TaskModel[];

      // Mock getPlaybookTasks to return tasks with null playbookIds
      const getPlaybookTasksSpy = jest.spyOn(
        service as any,
        'getPlaybookTasks'
      );
      getPlaybookTasksSpy.mockResolvedValue(mockTasks);

      await expect(
        service.saveAsTemplate('plant-1', {
          name: 'Test',
        })
      ).rejects.toThrow(
        'Cannot save as template: missing playbookId on tasks — ensure tasks belong to a playbook or re-run with valid tasks'
      );
    });
  });
});
