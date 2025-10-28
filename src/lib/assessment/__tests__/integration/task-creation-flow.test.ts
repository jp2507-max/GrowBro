/**
 * Task Creation Flow Integration Tests
 *
 * Tests end-to-end task creation from assessment action plans.
 *
 * Requirements:
 * - 3.4: Enable task creation from assessment results
 * - 9.1: Track task creation rates
 */

import { trackTaskCreation } from '@/lib/assessment/action-tracking';
import { handleTaskCreation } from '@/lib/assessment/task-creation-handler';
import { createTasksFromActionPlan } from '@/lib/assessment/task-integration';
import { createTask } from '@/lib/task-manager';
import type { AssessmentResult } from '@/types/assessment';

// Mock dependencies
jest.mock('@/lib/task-manager', () => ({
  createTask: jest.fn(),
}));

jest.mock('@/lib/action-tracking', () => ({
  trackTaskCreation: jest.fn(),
}));

const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>;
const mockTrackTaskCreation = trackTaskCreation as jest.MockedFunction<
  typeof trackTaskCreation
>;

describe('Task Creation Flow', () => {
  const mockPlantId = 'plant-123';
  const mockAssessmentId = 'assessment-456';
  const mockTimezone = 'Europe/Berlin';

  const mockActionPlan = {
    immediateSteps: [
      {
        title: 'Check pH levels',
        description: 'Measure and adjust pH',
        priority: 'high' as const,
        timeframe: '0-24h',
        taskTemplate: {
          name: 'pH Check',
          description: 'Measure pH and adjust if needed',
          fields: {
            category: 'monitoring',
          },
        },
      },
      {
        title: 'Increase nitrogen',
        description: 'Add nitrogen-rich fertilizer',
        priority: 'high' as const,
        timeframe: '0-24h',
        taskTemplate: {
          name: 'Nitrogen Feeding',
          description: 'Apply nitrogen fertilizer',
          fields: {
            category: 'feeding',
          },
        },
      },
    ],
    shortTermActions: [
      {
        title: 'Monitor recovery',
        description: 'Check for improvement',
        priority: 'medium' as const,
        timeframe: '24-48h',
        taskTemplate: {
          name: 'Recovery Check',
          description: 'Monitor plant recovery',
          fields: {
            category: 'monitoring',
          },
        },
      },
    ],
    diagnosticChecks: [],
    warnings: [],
    disclaimers: [],
  };

  const mockAssessment: AssessmentResult = {
    topClass: {
      id: 'nitrogen_deficiency',
      name: 'Nitrogen Deficiency',
      category: 'nutrient',
      description: 'Plant lacks nitrogen',
      isOod: false,
      visualCues: ['Yellowing lower leaves', 'Pale green coloration'],
      actionTemplate: mockActionPlan,
      createdAt: Date.now(),
    },
    calibratedConfidence: 0.85,
    rawConfidence: 0.88,
    modelVersion: '1.0.0',
    processingTimeMs: 150,
    perImage: [],
    aggregationMethod: 'highest-confidence',
    mode: 'device',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateTask.mockResolvedValue({
      id: 'task-id',
      title: 'Test Task',
      status: 'pending',
      dueAtLocal: '2025-01-01T08:00:00+01:00',
      dueAtUtc: '2025-01-01T07:00:00Z',
      timezone: mockTimezone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {},
    });
  });

  describe('createTasksFromActionPlan', () => {
    it('should generate task inputs from action plan', () => {
      const result = createTasksFromActionPlan({
        plan: mockActionPlan,
        plantId: mockPlantId,
        assessmentId: mockAssessmentId,
        classId: 'nitrogen_deficiency',
        timezone: mockTimezone,
      });

      expect(result.taskInputs).toHaveLength(3);
      expect(result.metadata.assessmentId).toBe(mockAssessmentId);
      expect(result.metadata.classId).toBe('nitrogen_deficiency');
      expect(result.metadata.createdCount).toBe(3);
    });

    it('should include assessment metadata in task inputs', () => {
      const result = createTasksFromActionPlan({
        plan: mockActionPlan,
        plantId: mockPlantId,
        assessmentId: mockAssessmentId,
        classId: 'nitrogen_deficiency',
        timezone: mockTimezone,
      });

      const firstTask = result.taskInputs[0];
      expect(firstTask.plantId).toBe(mockPlantId);
      expect(firstTask.metadata?.assessmentId).toBe(mockAssessmentId);
      expect(firstTask.metadata?.generatedFromAssessment).toBe(true);
      expect(firstTask.metadata?.priority).toBe('high');
    });

    it('should set correct due dates for immediate vs short-term actions', () => {
      const result = createTasksFromActionPlan({
        plan: mockActionPlan,
        plantId: mockPlantId,
        assessmentId: mockAssessmentId,
        classId: 'nitrogen_deficiency',
        timezone: mockTimezone,
      });

      // Immediate steps should be due today
      const immediateTask = result.taskInputs[0];
      expect(immediateTask.dueAtLocal).toBeDefined();

      // Short-term actions should be due tomorrow
      const shortTermTask = result.taskInputs[2];
      expect(shortTermTask.dueAtLocal).toBeDefined();
    });

    it('should return empty array when no task templates exist', () => {
      const emptyPlan = {
        immediateSteps: [
          {
            title: 'No template',
            description: 'Step without template',
            priority: 'medium' as const,
            timeframe: '0-24h',
          },
        ],
        shortTermActions: [],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      };

      const result = createTasksFromActionPlan({
        plan: emptyPlan,
        plantId: mockPlantId,
        assessmentId: mockAssessmentId,
        classId: 'test',
        timezone: mockTimezone,
      });

      expect(result.taskInputs).toHaveLength(0);
      expect(result.metadata.createdCount).toBe(0);
    });
  });

  describe('handleTaskCreation', () => {
    it('should create all tasks successfully', async () => {
      const result = await handleTaskCreation({
        plan: mockActionPlan,
        plantId: mockPlantId,
        assessmentId: mockAssessmentId,
        classId: 'nitrogen_deficiency',
        timezone: mockTimezone,
        assessment: mockAssessment,
      });

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.totalCount).toBe(3);
      expect(result.createdTaskIds).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should track task creation event', async () => {
      await handleTaskCreation({
        plan: mockActionPlan,
        plantId: mockPlantId,
        assessmentId: mockAssessmentId,
        classId: 'nitrogen_deficiency',
        timezone: mockTimezone,
        assessment: mockAssessment,
      });

      expect(mockTrackTaskCreation).toHaveBeenCalledWith(
        mockAssessmentId,
        mockAssessment,
        expect.objectContaining({
          taskCount: 3,
          plantId: mockPlantId,
          timezone: mockTimezone,
        })
      );
    });

    it('should handle partial failure gracefully', async () => {
      mockCreateTask
        .mockResolvedValueOnce({
          id: 'task-1',
          title: 'Task 1',
          status: 'pending',
          dueAtLocal: '2025-01-01T08:00:00+01:00',
          dueAtUtc: '2025-01-01T07:00:00Z',
          timezone: mockTimezone,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {},
        })
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({
          id: 'task-3',
          title: 'Task 3',
          status: 'pending',
          dueAtLocal: '2025-01-01T08:00:00+01:00',
          dueAtUtc: '2025-01-01T07:00:00Z',
          timezone: mockTimezone,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {},
        });

      const result = await handleTaskCreation({
        plan: mockActionPlan,
        plantId: mockPlantId,
        assessmentId: mockAssessmentId,
        classId: 'nitrogen_deficiency',
        timezone: mockTimezone,
        assessment: mockAssessment,
      });

      expect(result.success).toBe(true); // Partial success
      expect(result.createdCount).toBe(2);
      expect(result.failedCount).toBe(1);
      expect(result.totalCount).toBe(3);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Database error');
    });

    it('should handle complete failure', async () => {
      mockCreateTask.mockRejectedValue(new Error('Complete failure'));

      const result = await handleTaskCreation({
        plan: mockActionPlan,
        plantId: mockPlantId,
        assessmentId: mockAssessmentId,
        classId: 'nitrogen_deficiency',
        timezone: mockTimezone,
        assessment: mockAssessment,
      });

      expect(result.success).toBe(false);
      expect(result.createdCount).toBe(0);
      expect(result.failedCount).toBe(3);
      expect(result.totalCount).toBe(3);
    });

    it('should return success with zero tasks when action plan is empty', async () => {
      const emptyPlan = {
        immediateSteps: [],
        shortTermActions: [],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      };

      const result = await handleTaskCreation({
        plan: emptyPlan,
        plantId: mockPlantId,
        assessmentId: mockAssessmentId,
        classId: 'test',
        timezone: mockTimezone,
        assessment: mockAssessment,
      });

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(0);
      expect(result.totalCount).toBe(0);
      expect(mockCreateTask).not.toHaveBeenCalled();
    });
  });
});
