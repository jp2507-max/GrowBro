/**
 * Task Generator Tests
 */

import { type Database } from '@nozbe/watermelondb';

import type { Playbook } from '@/types/playbook';

import { TaskGenerator } from './task-generator';

const createMockTask = () => ({
  id: 'mock-task-id',
  title: '',
  description: '',
  dueAtLocal: '',
  dueAtUtc: '',
  timezone: '',
  status: 'pending' as const,
  metadata: {},
});

const mockDatabase = {
  write: jest.fn((callback) => callback()),
  get: jest.fn(() => ({
    create: jest.fn((callback) => {
      const record: any = createMockTask();
      callback(record);
      return Promise.resolve(record);
    }),
  })),
} as unknown as Database;

const createStep = (overrides: any = {}) => ({
  id: 'step-1',
  phase: 'seedling',
  title: 'Test',
  descriptionIcu: 'Test',
  relativeDay: 0,
  defaultReminderLocal: '08:00',
  taskType: 'water',
  dependencies: [],
  ...overrides,
});

const createPlaybook = (steps: any[]): Playbook => ({
  id: 'playbook-1',
  name: 'Test',
  setup: 'auto_indoor',
  locale: 'en',
  phaseOrder: ['seedling', 'veg'],
  steps,
  metadata: {},
  isTemplate: true,
  isCommunity: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createPlant = () => ({
  id: 'plant-1',
  startDate: new Date('2025-01-01T00:00:00Z'),
  timezone: 'UTC',
});

const verifyOriginStepId = (callback: any) => {
  const record: any = createMockTask();
  callback(record);
  expect(record.originStepId).toBe('step-unique-123');
  return Promise.resolve(record);
};

const capturePhaseIndex = (phaseIndexes: number[]) => (callback: any) => {
  const record: any = createMockTask();
  callback(record);
  phaseIndexes.push(record.phaseIndex);
  return Promise.resolve(record);
};

describe('TaskGenerator', () => {
  let taskGenerator: TaskGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    taskGenerator = new TaskGenerator({ database: mockDatabase });
  });

  describe('task generation', () => {
    it('generates correct task count and metrics', async () => {
      const playbook = createPlaybook([createStep()]);
      const result = await taskGenerator.generateTasksFromPlaybook(
        playbook,
        createPlant()
      );
      expect(result.generatedTaskCount).toBe(1);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('traceability', () => {
    it('stores origin_step_id', async () => {
      const playbook = createPlaybook([createStep({ id: 'step-unique-123' })]);
      const createMock = jest.fn(verifyOriginStepId);
      (mockDatabase.get as jest.Mock).mockReturnValue({ create: createMock });
      await taskGenerator.generateTasksFromPlaybook(playbook, createPlant());
      expect(createMock).toHaveBeenCalled();
    });

    it('stores phase_index', async () => {
      const playbook = createPlaybook([
        createStep({ phase: 'seedling' }),
        createStep({ id: 'step-2', phase: 'flower', relativeDay: 30 }),
      ]);
      const phaseIndexes: number[] = [];
      const createMock = jest.fn(capturePhaseIndex(phaseIndexes));
      (mockDatabase.get as jest.Mock).mockReturnValue({ create: createMock });
      await taskGenerator.generateTasksFromPlaybook(playbook, createPlant());
      expect(phaseIndexes).toContain(0);
      expect(phaseIndexes).toContain(2);
    });
  });

  describe('validateRRULEPattern', () => {
    it('validates correct patterns', () => {
      const result = taskGenerator.validateRRULEPattern(
        'FREQ=DAILY;INTERVAL=1'
      );
      expect(result.valid).toBe(true);
    });

    it('rejects invalid patterns', () => {
      const result = taskGenerator.validateRRULEPattern('INVALID');
      expect(result.valid).toBe(false);
    });
  });

  describe('nextOccurrence', () => {
    it('calculates next occurrence', () => {
      const next = taskGenerator.nextOccurrence('FREQ=DAILY;INTERVAL=1', {
        after: new Date('2025-01-01T00:00:00Z'),
        timezone: 'UTC',
      });
      expect(next).not.toBeNull();
    });
  });
});
