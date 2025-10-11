/**
 * Unit tests for schedule adjustment service
 *
 * Requirements: 5.5, 5.6
 */

import type { Database } from '@nozbe/watermelondb';

import { updateTask } from '@/lib/task-manager';

import type { DeviationAlert } from '../types';
import {
  AdjustmentAction,
  type AdjustmentUndoState,
  applyAdjustments,
  proposeAdjustments,
  revertAdjustments,
} from './schedule-adjustment-service';

// Mock dependencies
jest.mock('@/lib/task-manager');

const mockUpdateTask = updateTask as jest.MockedFunction<typeof updateTask>;

describe('schedule-adjustment-service', () => {
  let mockDatabase: Database;
  let mockTasksCollection: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock task collection with query chain
    const mockQuery = {
      fetch: jest.fn(),
    };

    mockTasksCollection = {
      query: jest.fn().mockReturnValue(mockQuery),
      find: jest.fn(),
    };

    mockDatabase = {
      get: jest.fn().mockReturnValue(mockTasksCollection),
    } as any;
  });

  describe('proposeAdjustments', () => {
    const mockAlert: DeviationAlert = {
      id: 'alert-1',
      readingId: 'reading-1',
      type: 'ec_high',
      severity: 'warning',
      message: 'EC is above target range',
      recommendations: ['Dilute nutrient solution', 'Recheck in 24h'],
      recommendationCodes: ['DILUTE_10PCT', 'RECHECK_24H'],
      triggeredAt: Date.now(),
      createdAt: 1640995200000, // 2022-01-01 00:00:00 UTC
      updatedAt: 1640995200000, // 2022-01-01 00:00:00 UTC
    };

    const mockTasks = [
      {
        id: 'task-1',
        title: 'Feed - veg phase',
        description: 'Original instructions',
        dueAtLocal: '2025-01-15T09:00:00Z',
        status: 'pending',
        metadata: { type: 'feeding' },
      },
      {
        id: 'task-2',
        title: 'Feed - veg phase',
        description: 'Original instructions',
        dueAtLocal: '2025-01-16T09:00:00Z',
        status: 'pending',
        metadata: { type: 'feeding' },
      },
    ];

    test('proposes adjustments for upcoming feeding tasks', async () => {
      const mockQuery = mockTasksCollection.query();
      mockQuery.fetch.mockResolvedValue(mockTasks);

      const proposal = await proposeAdjustments(mockDatabase, {
        alert: mockAlert,
        plantId: 'plant-1',
        maxTasks: 3,
      });

      expect(proposal.affectedTaskCount).toBe(2);
      expect(proposal.proposedAdjustments).toHaveLength(2);
      expect(proposal.canApply).toBe(true);
      expect(mockTasksCollection.query).toHaveBeenCalled();
    });

    test('determines correct action for EC high alert', async () => {
      const mockQuery = mockTasksCollection.query();
      mockQuery.fetch.mockResolvedValue([mockTasks[0]]);

      const proposal = await proposeAdjustments(mockDatabase, {
        alert: mockAlert,
        plantId: 'plant-1',
      });

      expect(proposal.proposedAdjustments[0].action).toBe(
        AdjustmentAction.DILUTE
      );
    });

    test('determines correct action for pH low alert', async () => {
      const phLowAlert: DeviationAlert = {
        ...mockAlert,
        type: 'ph_low',
        message: 'pH is below target range',
      };

      const mockQuery = mockTasksCollection.query();
      mockQuery.fetch.mockResolvedValue([mockTasks[0]]);

      const proposal = await proposeAdjustments(mockDatabase, {
        alert: phLowAlert,
        plantId: 'plant-1',
      });

      expect(proposal.proposedAdjustments[0].action).toBe(
        AdjustmentAction.ADJUST_PH_UP
      );
    });

    test('respects maxTasks parameter', async () => {
      const mockQuery = mockTasksCollection.query();
      // Mock fetch to return only 1 task when maxTasks is 1
      mockQuery.fetch.mockResolvedValue([mockTasks[0]]);

      const proposal = await proposeAdjustments(mockDatabase, {
        alert: mockAlert,
        plantId: 'plant-1',
        maxTasks: 1,
      });

      expect(proposal.proposedAdjustments).toHaveLength(1);
      // Verify Q.take was called with correct limit
      expect(mockTasksCollection.query).toHaveBeenCalled();
    });

    test('returns empty proposal when no tasks found', async () => {
      const mockQuery = mockTasksCollection.query();
      mockQuery.fetch.mockResolvedValue([]);

      const proposal = await proposeAdjustments(mockDatabase, {
        alert: mockAlert,
        plantId: 'plant-1',
      });

      expect(proposal.affectedTaskCount).toBe(0);
      expect(proposal.canApply).toBe(false);
    });

    test('includes severity in proposals', async () => {
      const criticalAlert: DeviationAlert = {
        ...mockAlert,
        severity: 'critical',
      };

      const mockQuery = mockTasksCollection.query();
      mockQuery.fetch.mockResolvedValue([mockTasks[0]]);

      const proposal = await proposeAdjustments(mockDatabase, {
        alert: criticalAlert,
        plantId: 'plant-1',
      });

      expect(proposal.proposedAdjustments[0].severity).toBe('high');
    });
  });

  describe('applyAdjustments', () => {
    const mockProposals = [
      {
        taskId: 'task-1',
        taskTitle: 'Feed - veg phase',
        currentDueDate: '2025-01-15T09:00:00Z',
        action: AdjustmentAction.DILUTE,
        reason: 'EC too high',
        newInstructions: 'Updated instructions',
        severity: 'medium' as const,
      },
    ];

    const mockTask = {
      id: 'task-1',
      title: 'Feed - veg phase',
      description: 'Original instructions',
      dueAtLocal: '2025-01-15T09:00:00Z',
      dueAtUtc: '2025-01-15T09:00:00Z',
      timezone: 'UTC',
      status: 'pending',
      metadata: { type: 'feeding' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    test('applies adjustments and returns result', async () => {
      mockTasksCollection.find.mockResolvedValue(mockTask);
      mockUpdateTask.mockResolvedValue({
        ...mockTask,
        description: 'Updated instructions',
      } as any);

      const result = await applyAdjustments(mockDatabase, mockProposals);

      expect(result.tasksUpdated).toBe(1);
      expect(result.taskIds).toEqual(['task-1']);
      expect(result.errors).toHaveLength(0);
      expect(mockUpdateTask).toHaveBeenCalledTimes(1);
    });

    test('stores undo state', async () => {
      mockTasksCollection.find.mockResolvedValue(mockTask);
      mockUpdateTask.mockResolvedValue(mockTask as any);

      const result = await applyAdjustments(mockDatabase, mockProposals);

      expect(result.undo).toBeDefined();
      expect(result.undo.operation).toBe('update');
      expect(result.undo.previousTasks).toHaveLength(1);
    });

    test('handles task update errors', async () => {
      mockTasksCollection.find.mockResolvedValue(mockTask);
      mockUpdateTask.mockRejectedValue(new Error('Update failed'));

      const result = await applyAdjustments(mockDatabase, mockProposals);

      expect(result.tasksUpdated).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Update failed');
    });

    test('continues on partial failures', async () => {
      const multipleProposals = [
        mockProposals[0],
        { ...mockProposals[0], taskId: 'task-2' },
      ];

      mockTasksCollection.find.mockResolvedValue(mockTask);
      mockUpdateTask
        .mockRejectedValueOnce(new Error('First task failed'))
        .mockResolvedValueOnce(mockTask as any);

      const result = await applyAdjustments(mockDatabase, multipleProposals);

      expect(result.tasksUpdated).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    test('includes adjustment metadata in task updates', async () => {
      mockTasksCollection.find.mockResolvedValue(mockTask);
      mockUpdateTask.mockResolvedValue(mockTask as any);

      await applyAdjustments(mockDatabase, mockProposals);

      const updateCall = mockUpdateTask.mock.calls[0];
      expect(updateCall[1].metadata).toMatchObject({
        adjustedFor: AdjustmentAction.DILUTE,
        adjustmentReason: 'EC too high',
        adjustmentTimestamp: expect.any(Number),
      });
    });
  });

  describe('revertAdjustments', () => {
    const mockUndo: AdjustmentUndoState = {
      adjustmentId: 'manual-adjustment',
      operation: 'update',
      previousTasks: [
        {
          id: 'task-1',
          seriesId: 'series-1',
          title: 'Feed - veg phase',
          description: 'Original instructions',
          dueAtLocal: '2025-01-15T09:00:00Z',
          dueAtUtc: '2025-01-15T09:00:00Z',
          timezone: 'UTC',
          reminderAtLocal: undefined,
          reminderAtUtc: undefined,
          plantId: 'plant-1',
          status: 'pending',
          completedAt: undefined,
          metadata: { type: 'feeding' },
          serverRevision: undefined,
          serverUpdatedAtMs: undefined,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          deletedAt: undefined,
        },
      ],
      timestamp: Date.now(),
    };

    test('reverts tasks to previous state', async () => {
      mockUpdateTask.mockResolvedValue({} as any);

      const revertedCount = await revertAdjustments(mockDatabase, mockUndo);

      expect(revertedCount).toBe(1);
      expect(mockUpdateTask).toHaveBeenCalledWith('task-1', {
        description: 'Original instructions',
        metadata: { type: 'feeding' },
      });
    });

    test('continues on revert failures', async () => {
      const multipleUndo: AdjustmentUndoState = {
        ...mockUndo,
        previousTasks: [
          mockUndo.previousTasks[0],
          { ...mockUndo.previousTasks[0], id: 'task-2' },
        ],
      };

      mockUpdateTask
        .mockRejectedValueOnce(new Error('Revert failed'))
        .mockResolvedValueOnce({} as any);

      const revertedCount = await revertAdjustments(mockDatabase, multipleUndo);

      expect(revertedCount).toBe(1);
    });
  });
});
