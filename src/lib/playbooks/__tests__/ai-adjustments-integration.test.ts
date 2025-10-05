/* eslint-disable max-lines-per-function */
/**
 * Integration test for AI adjustment system
 * Tests the complete flow from suggestion generation to acceptance and voting
 */

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

describe('AI Adjustments Integration', () => {
  let mockDatabase: jest.Mocked<Database>;
  let service: AIAdjustmentService;

  beforeEach(() => {
    mockDatabase = {
      get: jest.fn(),
      write: jest.fn((callback) => callback()),
    } as any;

    service = new AIAdjustmentService(mockDatabase);
  });

  test('complete flow: generate → accept → vote', async () => {
    // Setup mocks
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
      create: jest.fn(),
    };

    const mockTasksCollection = {
      query: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([
          {
            id: 'task-1',
            _raw: { due_at_local: '2025-01-15', phase_index: 1 },
            update: jest.fn(),
          },
        ]),
      }),
      find: jest.fn().mockResolvedValue({
        update: jest.fn(),
      }),
    };

    const mockSuggestionsCollection = {
      create: jest.fn().mockImplementation((callback) => {
        const record = {
          id: 'suggestion-1',
          _raw: {},
          update: jest.fn(),
        };
        callback(record._raw);
        return record;
      }),
      find: jest.fn().mockImplementation((id) => {
        return Promise.resolve({
          id,
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
        });
      }),
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
      if (tableName === 'tasks') {
        return mockTasksCollection as any;
      }
      if (tableName === 'adjustment_suggestions') {
        return mockSuggestionsCollection as any;
      }
      return {} as any;
    });

    // Step 1: Generate suggestion
    const context: AdjustmentContext = {
      plantId: 'plant-1',
      playbookId: 'playbook-1',
      skippedTaskCount: 3,
    };

    const suggestion = await service.generateSuggestions(context);

    expect(suggestion).not.toBeNull();
    expect(suggestion?.plantId).toBe('plant-1');
    expect(suggestion?.status).toBe('pending');
    expect(mockSuggestionsCollection.create).toHaveBeenCalled();

    // Step 2: Accept suggestion
    await service.applySuggestion(suggestion!.id);

    expect(mockTasksCollection.find).toHaveBeenCalledWith('task-1');
    expect(mockCooldownsCollection.create).toHaveBeenCalled();

    // Step 3: Vote on helpfulness
    const updateSpy = jest.fn();
    mockSuggestionsCollection.find = jest.fn().mockResolvedValue({
      id: suggestion!.id,
      _raw: {},
      update: updateSpy,
    });

    await service.voteHelpfulness(suggestion!.id, 'helpful');

    expect(updateSpy).toHaveBeenCalled();
  });

  test('complete flow: generate → decline → cooldown', async () => {
    // Setup mocks
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
      create: jest.fn(),
    };

    const mockTasksCollection = {
      query: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([
          {
            id: 'task-1',
            _raw: { due_at_local: '2025-01-15', phase_index: 1 },
          },
        ]),
      }),
    };

    const mockSuggestionsCollection = {
      create: jest.fn().mockImplementation((callback) => {
        const record = {
          id: 'suggestion-1',
          _raw: {},
          update: jest.fn(),
        };
        callback(record._raw);
        return record;
      }),
      find: jest.fn().mockImplementation((id) => {
        return Promise.resolve({
          id,
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
        });
      }),
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

    // Step 1: Generate suggestion
    const context: AdjustmentContext = {
      plantId: 'plant-1',
      playbookId: 'playbook-1',
      skippedTaskCount: 3,
    };

    const suggestion = await service.generateSuggestions(context);
    expect(suggestion).not.toBeNull();

    // Step 2: Decline suggestion
    const updateSpy = jest.fn();
    mockSuggestionsCollection.find = jest.fn().mockResolvedValue({
      id: suggestion!.id,
      _raw: {
        plant_id: 'plant-1',
        root_cause: 'skipped_tasks',
      },
      update: updateSpy,
    });

    await service.declineSuggestion(suggestion!.id);

    expect(updateSpy).toHaveBeenCalled();
    expect(mockCooldownsCollection.create).toHaveBeenCalled();

    // Step 3: Verify cooldown prevents new suggestions
    mockCooldownsCollection.query = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue([
        {
          _raw: {
            cooldown_until: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
          },
        },
      ]),
    });

    const result = await service.shouldSuggestAdjustments(context);
    expect(result.shouldSuggest).toBe(false);
    expect(result.reason).toBe('cooldown_active');
  });

  test('never suggest preference blocks all suggestions', async () => {
    const mockPreferencesCollection = {
      query: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        fetch: jest.fn().mockResolvedValue([]),
      }),
      create: jest.fn(),
    };

    mockDatabase.get.mockReturnValue(mockPreferencesCollection as any);

    // Set never suggest
    await service.setNeverSuggest('plant-1', true);
    expect(mockPreferencesCollection.create).toHaveBeenCalled();

    // Update mock to return the preference
    mockPreferencesCollection.query = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      fetch: jest.fn().mockResolvedValue([
        {
          _raw: { never_suggest: true },
        },
      ]),
    });

    // Try to generate suggestion
    const context: AdjustmentContext = {
      plantId: 'plant-1',
      skippedTaskCount: 5,
    };

    const result = await service.shouldSuggestAdjustments(context);
    expect(result.shouldSuggest).toBe(false);
    expect(result.reason).toBe('user_disabled');
  });
});
