import { type Database } from '@nozbe/watermelondb';

import type { AdjustmentContext } from '@/types/ai-adjustments';

import { AIAdjustmentService } from '../ai-adjustment-service';

// Mock feature flags
jest.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: jest.fn(() => ({
    aiAdjustmentsEnabled: true,
    aiAdjustmentsMinSkippedTasks: 2,
    aiAdjustmentsMinConfidence: 0.7,
  })),
}));

describe('AIAdjustmentService', () => {
  let mockDatabase: jest.Mocked<Database>;
  let service: AIAdjustmentService;

  beforeEach(() => {
    // Create mock database
    mockDatabase = {
      get: jest.fn(),
      write: jest.fn((callback) => callback()),
    } as any;

    service = new AIAdjustmentService(mockDatabase);
  });

  describe('shouldSuggestAdjustments', () => {
    test('returns false when feature is disabled', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getFeatureFlags } = require('@/lib/feature-flags');
      getFeatureFlags.mockReturnValueOnce({
        aiAdjustmentsEnabled: false,
        aiAdjustmentsMinSkippedTasks: 2,
        aiAdjustmentsMinConfidence: 0.7,
      });

      const context: AdjustmentContext = {
        plantId: 'plant-1',
        skippedTaskCount: 3,
      };

      const result = await service.shouldSuggestAdjustments(context);

      expect(result.shouldSuggest).toBe(false);
      expect(result.reason).toBe('feature_disabled');
    });

    test('returns false when plant has never suggest preference', async () => {
      const mockCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([
            {
              _raw: { never_suggest: true },
            },
          ]),
        }),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      const context: AdjustmentContext = {
        plantId: 'plant-1',
        skippedTaskCount: 3,
      };

      const result = await service.shouldSuggestAdjustments(context);

      expect(result.shouldSuggest).toBe(false);
      expect(result.reason).toBe('user_disabled');
    });

    test('returns false when thresholds not met', async () => {
      const mockCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([]),
        }),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      const context: AdjustmentContext = {
        plantId: 'plant-1',
        skippedTaskCount: 1, // Below threshold of 2
      };

      const result = await service.shouldSuggestAdjustments(context);

      expect(result.shouldSuggest).toBe(false);
      expect(result.reason).toBe('thresholds_not_met');
    });

    test('returns false when in cooldown', async () => {
      const mockPreferencesCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([]),
        }),
      };

      const mockCooldownsCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([
            {
              _raw: {
                cooldown_until: Date.now() + 1000 * 60 * 60 * 24, // 1 day from now
              },
            },
          ]),
        }),
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'plant_adjustment_preferences') {
          return mockPreferencesCollection as any;
        }
        if (tableName === 'adjustment_cooldowns') {
          return mockCooldownsCollection as any;
        }
        return {} as any;
      });

      const context: AdjustmentContext = {
        plantId: 'plant-1',
        skippedTaskCount: 3,
      };

      const result = await service.shouldSuggestAdjustments(context);

      expect(result.shouldSuggest).toBe(false);
      expect(result.reason).toBe('cooldown_active');
    });

    test('returns true when skipped tasks threshold met', async () => {
      const mockPreferencesCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([]),
        }),
      };

      const mockCooldownsCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([]),
        }),
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'plant_adjustment_preferences') {
          return mockPreferencesCollection as any;
        }
        if (tableName === 'adjustment_cooldowns') {
          return mockCooldownsCollection as any;
        }
        return {} as any;
      });

      const context: AdjustmentContext = {
        plantId: 'plant-1',
        skippedTaskCount: 3,
      };

      const result = await service.shouldSuggestAdjustments(context);

      expect(result.shouldSuggest).toBe(true);
    });

    test('returns true when confidence threshold met', async () => {
      const mockPreferencesCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([]),
        }),
      };

      const mockCooldownsCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([]),
        }),
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'plant_adjustment_preferences') {
          return mockPreferencesCollection as any;
        }
        if (tableName === 'adjustment_cooldowns') {
          return mockCooldownsCollection as any;
        }
        return {} as any;
      });

      const context: AdjustmentContext = {
        plantId: 'plant-1',
        assessmentConfidence: 0.6, // Below threshold of 0.7
      };

      const result = await service.shouldSuggestAdjustments(context);

      expect(result.shouldSuggest).toBe(true);
    });
  });

  describe('generateSuggestions', () => {
    test('returns null when should not suggest', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getFeatureFlags } = require('@/lib/feature-flags');
      getFeatureFlags.mockReturnValueOnce({
        aiAdjustmentsEnabled: false,
        aiAdjustmentsMinSkippedTasks: 2,
        aiAdjustmentsMinConfidence: 0.7,
      });

      const context: AdjustmentContext = {
        plantId: 'plant-1',
        skippedTaskCount: 3,
      };

      const result = await service.generateSuggestions(context);

      expect(result).toBeNull();
    });

    test('generates suggestion with affected tasks', async () => {
      const mockPreferencesCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([]),
        }),
      };

      const mockCooldownsCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([]),
        }),
      };

      const mockTasksCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([
            {
              id: 'task-1',
              _raw: {
                due_at_local: '2025-01-15',
                phase_index: 1,
              },
            },
            {
              id: 'task-2',
              _raw: {
                due_at_local: '2025-01-16',
                phase_index: 1,
              },
            },
          ]),
        }),
      };

      const mockSuggestionsCollection = {
        create: jest.fn(),
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'plant_adjustment_preferences') {
          return mockPreferencesCollection as any;
        }
        if (tableName === 'adjustment_cooldowns') {
          return mockCooldownsCollection as any;
        }
        if (tableName === 'tasks') {
          return mockTasksCollection as any;
        }
        if (tableName === 'adjustment_suggestions') {
          return mockSuggestionsCollection as any;
        }
        return {} as any;
      });

      const context: AdjustmentContext = {
        plantId: 'plant-1',
        playbookId: 'playbook-1',
        skippedTaskCount: 3,
      };

      const result = await service.generateSuggestions(context);

      expect(result).not.toBeNull();
      expect(result?.plantId).toBe('plant-1');
      expect(result?.playbookId).toBe('playbook-1');
      expect(result?.rootCause).toBe('skipped_tasks');
      expect(result?.affectedTasks.length).toBe(2);
      expect(result?.status).toBe('pending');
      expect(mockSuggestionsCollection.create).toHaveBeenCalled();
    });
  });

  describe('applySuggestion', () => {
    test('applies all tasks when no taskIds provided', async () => {
      const mockSuggestionsCollection = {
        find: jest.fn().mockResolvedValue({
          _raw: {
            plant_id: 'plant-1',
            playbook_id: 'playbook-1',
            suggestion_type: 'schedule_shift',
            root_cause: 'skipped_tasks',
            reasoning: 'Test reasoning',
            affected_tasks: JSON.stringify([
              {
                taskId: 'task-1',
                currentDueDate: '2025-01-15',
                proposedDueDate: '2025-01-17',
                reason: 'Test',
              },
            ]),
            confidence: 0.8,
            status: 'pending',
            expires_at: Date.now() + 1000 * 60 * 60 * 24,
            created_at: Date.now(),
            updated_at: Date.now(),
          },
          update: jest.fn(),
        }),
      };

      const mockTasksCollection = {
        find: jest.fn().mockResolvedValue({
          update: jest.fn(),
        }),
      };

      const mockCooldownsCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([]),
        }),
        create: jest.fn(),
      };

      mockDatabase.get.mockImplementation((tableName: string) => {
        if (tableName === 'adjustment_suggestions') {
          return mockSuggestionsCollection as any;
        }
        if (tableName === 'tasks') {
          return mockTasksCollection as any;
        }
        if (tableName === 'adjustment_cooldowns') {
          return mockCooldownsCollection as any;
        }
        return {} as any;
      });

      await service.applySuggestion('suggestion-1');

      expect(mockTasksCollection.find).toHaveBeenCalledWith('task-1');
      expect(mockCooldownsCollection.create).toHaveBeenCalled();
    });
  });

  describe('setNeverSuggest', () => {
    test('creates new preference when none exists', async () => {
      const mockCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([]),
        }),
        create: jest.fn(),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      await service.setNeverSuggest('plant-1', true);

      expect(mockCollection.create).toHaveBeenCalled();
    });

    test('updates existing preference', async () => {
      const mockRecord = {
        update: jest.fn(),
      };

      const mockCollection = {
        query: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          fetch: jest.fn().mockResolvedValue([mockRecord]),
        }),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);

      await service.setNeverSuggest('plant-1', false);

      expect(mockRecord.update).toHaveBeenCalled();
    });
  });
});
