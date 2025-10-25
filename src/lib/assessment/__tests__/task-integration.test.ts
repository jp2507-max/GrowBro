/**
 * Task Integration Tests
 *
 * Tests task creation from action plans with prefilled templates.
 */

import type { AssessmentActionPlan } from '@/types/assessment';

import {
  createTasksFromActionPlan,
  TaskIntegrationService,
} from '../task-integration';

describe('TaskIntegrationService', () => {
  let service: TaskIntegrationService;

  beforeEach(() => {
    service = new TaskIntegrationService();
  });

  describe('createTasksFromPlan', () => {
    it('should create tasks from action plan with templates', () => {
      const plan: AssessmentActionPlan = {
        immediateSteps: [
          {
            title: 'Check pH levels',
            description: 'Measure pH and adjust if needed',
            timeframe: '0-24 hours',
            priority: 'high',
            taskTemplate: {
              name: 'Measure pH',
              fields: {
                type: 'monitor',
                description: 'Check pH levels',
              },
            },
          },
        ],
        shortTermActions: [
          {
            title: 'Monitor recovery',
            description: 'Check plant daily for improvements',
            timeframe: '24-48 hours',
            priority: 'medium',
            taskTemplate: {
              name: 'Monitor plant recovery',
              fields: {
                type: 'monitor',
                description: 'Daily recovery check',
              },
            },
          },
        ],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      };

      const result = service.createTasksFromPlan({
        plan,
        plantId: 'plant-1',
        assessmentId: 'assessment-1',
        classId: 'nitrogen_deficiency',
        timezone: 'America/New_York',
      });

      expect(result.taskInputs.length).toBe(2);
      expect(result.metadata.assessmentId).toBe('assessment-1');
      expect(result.metadata.classId).toBe('nitrogen_deficiency');
      expect(result.metadata.createdCount).toBe(2);

      // Check immediate task
      const immediateTask = result.taskInputs[0];
      expect(immediateTask.title).toBe('Measure pH');
      expect(immediateTask.plantId).toBe('plant-1');
      expect(immediateTask.timezone).toBe('America/New_York');
      expect(immediateTask.metadata?.assessmentId).toBe('assessment-1');
      expect(immediateTask.metadata?.generatedFromAssessment).toBe(true);

      // Check short-term task
      const shortTermTask = result.taskInputs[1];
      expect(shortTermTask.title).toBe('Monitor plant recovery');
      expect(shortTermTask.metadata?.priority).toBe('medium');
    });

    it('should skip steps without task templates', () => {
      const plan: AssessmentActionPlan = {
        immediateSteps: [
          {
            title: 'Visual inspection',
            description: 'Inspect plant for issues',
            timeframe: '0-24 hours',
            priority: 'medium',
            // No taskTemplate
          },
          {
            title: 'Check pH',
            description: 'Measure pH',
            timeframe: '0-24 hours',
            priority: 'high',
            taskTemplate: {
              name: 'pH Check',
              fields: { type: 'monitor' },
            },
          },
        ],
        shortTermActions: [],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      };

      const result = service.createTasksFromPlan({
        plan,
        plantId: 'plant-1',
        assessmentId: 'assessment-1',
        classId: 'healthy',
        timezone: 'UTC',
      });

      expect(result.taskInputs.length).toBe(1);
      expect(result.taskInputs[0].title).toBe('pH Check');
    });

    it('should handle empty action plan', () => {
      const plan: AssessmentActionPlan = {
        immediateSteps: [],
        shortTermActions: [],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      };

      const result = service.createTasksFromPlan({
        plan,
        plantId: 'plant-1',
        assessmentId: 'assessment-1',
        classId: 'healthy',
        timezone: 'UTC',
      });

      expect(result.taskInputs.length).toBe(0);
      expect(result.metadata.createdCount).toBe(0);
    });
  });

  describe('extractTaskTemplates', () => {
    it('should extract all task templates from plan', () => {
      const plan: AssessmentActionPlan = {
        immediateSteps: [
          {
            title: 'Step 1',
            description: 'Description 1',
            timeframe: '0-24 hours',
            priority: 'high',
            taskTemplate: {
              name: 'Task 1',
              fields: { type: 'monitor' },
            },
          },
        ],
        shortTermActions: [
          {
            title: 'Step 2',
            description: 'Description 2',
            timeframe: '24-48 hours',
            priority: 'medium',
            taskTemplate: {
              name: 'Task 2',
              fields: { type: 'water' },
            },
          },
        ],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      };

      const templates = service.extractTaskTemplates(plan);

      expect(templates.length).toBe(2);
      expect(templates[0].template.name).toBe('Task 1');
      expect(templates[0].timeframe).toBe('0-24 hours');
      expect(templates[1].template.name).toBe('Task 2');
      expect(templates[1].timeframe).toBe('24-48 hours');
    });
  });

  describe('countCreatableTasks', () => {
    it('should count tasks with templates', () => {
      const plan: AssessmentActionPlan = {
        immediateSteps: [
          {
            title: 'Step 1',
            description: 'Description 1',
            timeframe: '0-24 hours',
            priority: 'high',
            taskTemplate: {
              name: 'Task 1',
              fields: {},
            },
          },
          {
            title: 'Step 2',
            description: 'Description 2',
            timeframe: '0-24 hours',
            priority: 'medium',
            // No template
          },
        ],
        shortTermActions: [
          {
            title: 'Step 3',
            description: 'Description 3',
            timeframe: '24-48 hours',
            priority: 'low',
            taskTemplate: {
              name: 'Task 3',
              fields: {},
            },
          },
        ],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      };

      const count = service.countCreatableTasks(plan);

      expect(count).toBe(2);
    });

    it('should return 0 for plan without templates', () => {
      const plan: AssessmentActionPlan = {
        immediateSteps: [
          {
            title: 'Step 1',
            description: 'Description 1',
            timeframe: '0-24 hours',
            priority: 'high',
          },
        ],
        shortTermActions: [],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      };

      const count = service.countCreatableTasks(plan);

      expect(count).toBe(0);
    });
  });

  describe('createTasksFromActionPlan (convenience function)', () => {
    it('should create tasks using convenience function', () => {
      const plan: AssessmentActionPlan = {
        immediateSteps: [
          {
            title: 'Test task',
            description: 'Test description',
            timeframe: '0-24 hours',
            priority: 'high',
            taskTemplate: {
              name: 'Test Task',
              fields: { type: 'custom' },
            },
          },
        ],
        shortTermActions: [],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      };

      const result = createTasksFromActionPlan({
        plan,
        plantId: 'plant-1',
        assessmentId: 'assessment-1',
        classId: 'healthy',
        timezone: 'UTC',
      });

      expect(result.taskInputs.length).toBe(1);
      expect(result.taskInputs[0].title).toBe('Test Task');
    });
  });
});
