/**
 * Playbook Service Tests
 *
 * Tests for playbook selection, application, and constraint enforcement
 */

import { type Database } from '@nozbe/watermelondb';

import type { Playbook } from '@/types/playbook';

import { InMemoryMetrics } from '../analytics';
import type { PlaybookModel } from '../watermelon-models/playbook';
import { PlaybookService } from './playbook-service';
import { type ScheduleShifter } from './schedule-shifter';

interface MockPlaybookApplication {
  id: string;
  playbookId: string;
  plantId: string;
  status: 'pending' | 'completed' | 'failed';
  appliedAt: Date;
  taskCount?: number;
  durationMs?: number;
  jobId?: string;
  idempotencyKey?: string;
  update?: jest.Mock<
    Promise<void>,
    [(record: MockPlaybookApplication) => void]
  >;
}

// Mock database interface for testing
interface MockDatabase extends Database {
  mockPlaybooks: Partial<PlaybookModel>[];
  mockApplications: MockPlaybookApplication[];
}

const createMockApplication = (
  overrides: Partial<MockPlaybookApplication> = {}
): MockPlaybookApplication => {
  const defaultApplication: MockPlaybookApplication = {
    id: 'app-1',
    playbookId: 'playbook-1',
    plantId: 'plant-1',
    status: 'pending',
    appliedAt: new Date(),
    taskCount: 0,
    durationMs: 0,
    jobId: 'job-1',
    idempotencyKey: 'idem-key-1',
  };

  const mockApplication = { ...defaultApplication, ...overrides };

  const defaultUpdateMock: jest.Mock<
    Promise<void>,
    [(record: MockPlaybookApplication) => void]
  > = jest.fn(async (updateCallback) => {
    updateCallback(mockApplication);
    return Promise.resolve();
  });

  mockApplication.update = mockApplication.update ?? defaultUpdateMock;

  return mockApplication;
};

interface WhereCondition {
  type: 'where';
  left: string;
  comparison: { right: { value: unknown } };
}

interface KeyValueCondition {
  key: string;
  value: unknown;
}

type QueryCondition = WhereCondition | KeyValueCondition;

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(
    () => 'test-uuid-' + Math.random().toString(36).substring(7)
  ),
}));

// Mock ScheduleShifter
jest.mock('./schedule-shifter', () => ({
  ScheduleShifter: jest.fn().mockImplementation(() => ({
    generatePreview: jest.fn(),
    applyShift: jest.fn(),
    undoShift: jest.fn(),
  })),
}));

// Mock database
const createMockDatabase = (): MockDatabase => {
  const mockPlaybooks: Partial<PlaybookModel>[] = [];
  const mockApplications: MockPlaybookApplication[] = [];

  const db = {
    get: jest.fn((tableName: string): any => {
      if (tableName === 'playbooks') {
        return {
          query: jest.fn(() => ({
            fetch: jest.fn(() => Promise.resolve(mockPlaybooks)),
          })),
          find: jest.fn((id: string) => {
            const playbook = mockPlaybooks.find((p) => p.id === id);
            if (!playbook) {
              return Promise.reject(new Error('Playbook not found'));
            }
            return Promise.resolve(playbook);
          }),
        };
      }
      if (tableName === 'playbook_applications') {
        return {
          query: jest.fn((...conditions: QueryCondition[]) => {
            // Simple mock filtering based on Q.where conditions
            let filtered = [...mockApplications];
            conditions.forEach((condition) => {
              if ('type' in condition && condition.type === 'where') {
                // Map snake_case column names to camelCase property names
                const columnToProperty: Record<
                  string,
                  keyof MockPlaybookApplication
                > = {
                  playbook_id: 'playbookId',
                  plant_id: 'plantId',
                  applied_at: 'appliedAt',
                  task_count: 'taskCount',
                  duration_ms: 'durationMs',
                  job_id: 'jobId',
                  idempotency_key: 'idempotencyKey',
                  status: 'status',
                  id: 'id',
                };
                const property =
                  columnToProperty[condition.left] ||
                  (condition.left as keyof MockPlaybookApplication);
                const value = condition.comparison.right.value;
                filtered = filtered.filter((app) => app[property] === value);
              } else if ('key' in condition) {
                // Handle direct property queries (assume already camelCase)
                const field = condition.key as keyof MockPlaybookApplication;
                const value = condition.value;
                filtered = filtered.filter((app) => app[field] === value);
              }
            });
            return {
              fetch: jest.fn(() => Promise.resolve(filtered)),
              sortBy: jest.fn(() => ({
                fetch: jest.fn(() => Promise.resolve(filtered)),
              })),
            };
          }),
          create: jest.fn(
            (callback: (record: MockPlaybookApplication) => void) => {
              const record = createMockApplication();
              callback(record);
              mockApplications.push(record);
              return Promise.resolve(record);
            }
          ),
        };
      }
      return {};
    }),
    write: jest.fn(async (callback: (writer: any) => Promise<any>) => {
      return await callback({} as any);
    }),
    mockPlaybooks,
    mockApplications,
  } as unknown as MockDatabase;

  return db;
};

describe('PlaybookService', () => {
  let service: PlaybookService;
  let database: MockDatabase;
  let analytics: InMemoryMetrics;
  let mockScheduleShifter: jest.Mocked<ScheduleShifter>;

  beforeEach(() => {
    database = createMockDatabase();
    analytics = new InMemoryMetrics();
    service = new PlaybookService({ database, analytics });

    // Spy on the ScheduleShifter methods
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockScheduleShifter = (service as any).scheduleShifter;
    jest.spyOn(mockScheduleShifter, 'generatePreview');
    jest.spyOn(mockScheduleShifter, 'applyShift');
    jest.spyOn(mockScheduleShifter, 'undoShift');
  });

  afterEach(() => {
    jest.clearAllMocks();
    analytics.clear();
  });

  describe('getAvailablePlaybooks', () => {
    test('returns all non-deleted playbooks', async () => {
      const mockPlaybook: Partial<PlaybookModel> = {
        id: 'playbook-1',
        name: 'Auto Indoor',
        setup: 'auto_indoor',

        toPlaybook: jest.fn(() => ({
          id: 'playbook-1',
          name: 'Auto Indoor',
          setup: 'auto_indoor',
          locale: 'en',
          phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
          steps: [],
          metadata: {},
          isTemplate: true,
          isCommunity: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        })) as any,
      };

      database.mockPlaybooks.push(mockPlaybook);

      const playbooks = await service.getAvailablePlaybooks();

      expect(playbooks).toHaveLength(1);
      expect(playbooks[0].id).toBe('playbook-1');
      expect(playbooks[0].name).toBe('Auto Indoor');
    });
  });

  describe('getPlaybookPreview', () => {
    test('calculates preview with total weeks, phase durations, and task count', async () => {
      const mockPlaybook: Playbook = {
        id: 'playbook-1',
        name: 'Auto Indoor',
        setup: 'auto_indoor',
        locale: 'en',
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        steps: [
          {
            id: 'step-1',
            phase: 'seedling',
            title: 'Water seedling',
            descriptionIcu: 'Water your seedling',
            relativeDay: 1,
            defaultReminderLocal: '08:00',
            taskType: 'water',
            dependencies: [],
          },
          {
            id: 'step-2',
            phase: 'seedling',
            title: 'Check seedling',
            descriptionIcu: 'Check seedling health',
            relativeDay: 3,
            defaultReminderLocal: '20:00',
            taskType: 'monitor',
            dependencies: [],
          },
          {
            id: 'step-3',
            phase: 'veg',
            title: 'Feed plant',
            descriptionIcu: 'Feed your plant',
            relativeDay: 7,
            durationDays: 14,
            defaultReminderLocal: '08:00',
            taskType: 'feed',
            dependencies: [],
          },
        ],
        metadata: {
          estimatedDuration: 12,
        },
        isTemplate: true,
        isCommunity: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPlaybookModel: Partial<PlaybookModel> = {
        id: 'playbook-1',
        toPlaybook: jest.fn(() => mockPlaybook),
      };

      database.mockPlaybooks.push(mockPlaybookModel);

      const preview = await service.getPlaybookPreview('playbook-1');

      expect(preview.playbookId).toBe('playbook-1');
      expect(preview.name).toBe('Auto Indoor');
      expect(preview.setup).toBe('auto_indoor');
      expect(preview.totalTasks).toBe(3);
      expect(preview.totalWeeks).toBeGreaterThan(0);
      expect(preview.phaseBreakdown).toHaveLength(4);

      // Check seedling phase
      const seedlingPhase = preview.phaseBreakdown.find(
        (p) => p.phase === 'seedling'
      );
      expect(seedlingPhase).toBeDefined();
      expect(seedlingPhase!.taskCount).toBe(2);
      expect(seedlingPhase!.durationDays).toBe(4); // max(1+1, 3+1)

      // Check veg phase
      const vegPhase = preview.phaseBreakdown.find((p) => p.phase === 'veg');
      expect(vegPhase).toBeDefined();
      expect(vegPhase!.taskCount).toBe(1);
      expect(vegPhase!.durationDays).toBe(21); // 7 + 14
    });
  });

  describe('validateOneActivePlaybookPerPlant', () => {
    test('returns true when no playbook is applied to plant', async () => {
      const isValid = await service.validateOneActivePlaybookPerPlant(
        'plant-1',
        'playbook-1'
      );

      expect(isValid).toBe(true);
    });

    test('returns false when different playbook is already applied', async () => {
      const mockApplication = createMockApplication({
        playbookId: 'playbook-2',
        plantId: 'plant-1',
        status: 'pending',
      });

      database.mockApplications.push(mockApplication);

      const isValid = await service.validateOneActivePlaybookPerPlant(
        'plant-1',
        'playbook-1'
      );

      expect(isValid).toBe(false);
    });

    test('returns true when completed playbook exists for plant', async () => {
      const mockApplication = createMockApplication({
        playbookId: 'playbook-1',
        plantId: 'plant-1',
        status: 'completed',
      });

      database.mockApplications.push(mockApplication);

      const isValid = await service.validateOneActivePlaybookPerPlant(
        'plant-1',
        'playbook-1'
      );

      expect(isValid).toBe(true);
    });

    test('returns false when pending playbook exists for plant', async () => {
      const mockApplication = createMockApplication({
        playbookId: 'playbook-1',
        plantId: 'plant-1',
        status: 'pending',
      });

      database.mockApplications.push(mockApplication);

      const isValid = await service.validateOneActivePlaybookPerPlant(
        'plant-1',
        'playbook-2' // Different playbook
      );

      expect(isValid).toBe(false);
    });
  });

  describe('applyPlaybookToPlant', () => {
    test('applies playbook with idempotency key', async () => {
      const mockPlaybook: Playbook = {
        id: 'playbook-1',
        name: 'Auto Indoor',
        setup: 'auto_indoor',
        locale: 'en',
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        steps: [],
        metadata: {},
        isTemplate: true,
        isCommunity: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPlaybookModel: Partial<PlaybookModel> = {
        id: 'playbook-1',
        toPlaybook: jest.fn(() => mockPlaybook),
      };

      database.mockPlaybooks.push(mockPlaybookModel);

      const result = await service.applyPlaybookToPlant(
        'playbook-1',
        'plant-1',
        {
          idempotencyKey: 'test-key-1',
        }
      );

      expect(result.playbookId).toBe('playbook-1');
      expect(result.plantId).toBe('plant-1');
      expect(result.appliedTaskCount).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.jobId).toBe('string');
      expect(result.jobId.length).toBeGreaterThan(0);

      // Check analytics event
      const events = analytics.getAll();
      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('playbook_apply');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((events[0].payload as any).playbookId).toBe('playbook-1');
    });

    test('returns existing result for duplicate idempotency key', async () => {
      const mockPlaybook: Playbook = {
        id: 'playbook-1',
        name: 'Auto Indoor',
        setup: 'auto_indoor',
        locale: 'en',
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        steps: [],
        metadata: {},
        isTemplate: true,
        isCommunity: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPlaybookModel: Partial<PlaybookModel> = {
        id: 'playbook-1',
        toPlaybook: jest.fn(() => mockPlaybook),
      };

      database.mockPlaybooks.push(mockPlaybookModel);

      // First application
      const result1 = await service.applyPlaybookToPlant(
        'playbook-1',
        'plant-1',
        {
          idempotencyKey: 'test-key-1',
        }
      );

      // Second application with same key
      const result2 = await service.applyPlaybookToPlant(
        'playbook-1',
        'plant-1',
        {
          idempotencyKey: 'test-key-1',
        }
      );

      expect(result2.jobId).toBe(result1.jobId);
      expect(result2.appliedTaskCount).toBe(result1.appliedTaskCount);
    });

    test('throws error when plant has active playbook', async () => {
      const mockApplication = createMockApplication({
        playbookId: 'playbook-2',
        plantId: 'plant-1',
        status: 'pending',
      });

      database.mockApplications.push(mockApplication);

      const mockPlaybook: Playbook = {
        id: 'playbook-1',
        name: 'Auto Indoor',
        setup: 'auto_indoor',
        locale: 'en',
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        steps: [],
        metadata: {},
        isTemplate: true,
        isCommunity: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPlaybookModel: Partial<PlaybookModel> = {
        id: 'playbook-1',
        toPlaybook: jest.fn(() => mockPlaybook),
      };

      database.mockPlaybooks.push(mockPlaybookModel);

      await expect(
        service.applyPlaybookToPlant('playbook-1', 'plant-1')
      ).rejects.toThrow('Plant already has an active playbook');
    });

    test('allows multiple playbooks when allowMultiple is true', async () => {
      const mockApplication = createMockApplication({
        playbookId: 'playbook-2',
        plantId: 'plant-1',
        status: 'pending',
      });

      database.mockApplications.push(mockApplication);

      const mockPlaybook: Playbook = {
        id: 'playbook-1',
        name: 'Auto Indoor',
        setup: 'auto_indoor',
        locale: 'en',
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        steps: [],
        metadata: {},
        isTemplate: true,
        isCommunity: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPlaybookModel: Partial<PlaybookModel> = {
        id: 'playbook-1',
        toPlaybook: jest.fn(() => mockPlaybook),
      };

      database.mockPlaybooks.push(mockPlaybookModel);

      const result = await service.applyPlaybookToPlant(
        'playbook-1',
        'plant-1',
        {
          allowMultiple: true,
        }
      );

      expect(result.playbookId).toBe('playbook-1');
      expect(result.plantId).toBe('plant-1');
    });

    test('tracks performance metrics', async () => {
      const mockPlaybook: Playbook = {
        id: 'playbook-1',
        name: 'Auto Indoor',
        setup: 'auto_indoor',
        locale: 'en',
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        steps: [],
        metadata: {},
        isTemplate: true,
        isCommunity: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const mockPlaybookModel: Partial<PlaybookModel> = {
        id: 'playbook-1',
        toPlaybook: jest.fn(() => mockPlaybook),
      };

      database.mockPlaybooks.push(mockPlaybookModel);

      const result = await service.applyPlaybookToPlant(
        'playbook-1',
        'plant-1'
      );

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.durationMs).toBeLessThan(1000); // Should be fast
    });
  });

  describe('placeholder methods', () => {
    test('shiftPlaybookSchedule returns schedule shift preview', async () => {
      const mockPreview = {
        shiftId: 'shift-123',
        plantId: 'plant-1',
        daysDelta: 3,
        affectedTaskCount: 5,
        firstNewDate: '2024-01-04T00:00:00.000Z',
        lastNewDate: '2024-01-10T00:00:00.000Z',
        collisionWarnings: [],
        manuallyEditedCount: 0,
        phaseBreakdown: [
          {
            phaseIndex: 0,
            taskCount: 2,
            netDelta: 3,
          },
        ],
        options: {},
      };

      mockScheduleShifter.generatePreview.mockResolvedValue(mockPreview);

      const result = await service.shiftPlaybookSchedule('plant-1', 3);

      expect(mockScheduleShifter.generatePreview).toHaveBeenCalledWith(
        'plant-1',
        3,
        undefined
      );
      expect(result).toEqual(mockPreview);
    });

    test('confirmScheduleShift calls applyShift with correct arguments', async () => {
      mockScheduleShifter.applyShift.mockResolvedValue(undefined);

      await service.confirmScheduleShift('plant-1', 'shift-123');

      expect(mockScheduleShifter.applyShift).toHaveBeenCalledWith('shift-123');
    });

    test('undoScheduleShift calls undoShift with correct arguments', async () => {
      mockScheduleShifter.undoShift.mockResolvedValue(undefined);

      await service.undoScheduleShift('plant-1', 'shift-123');

      expect(mockScheduleShifter.undoShift).toHaveBeenCalledWith(
        'plant-1',
        'shift-123'
      );
    });

    test('suggestScheduleAdjustments throws not implemented error', async () => {
      await expect(
        service.suggestScheduleAdjustments('plant-1', {
          plantId: 'plant-1',
          skippedTaskCount: 2,
          lastSevenDays: true,
        })
      ).rejects.toThrow('Not implemented yet');
    });

    test('applyAISuggestion throws not implemented error', async () => {
      await expect(
        service.applyAISuggestion('plant-1', 'suggestion-1')
      ).rejects.toThrow('Not implemented yet');
    });
  });
});
