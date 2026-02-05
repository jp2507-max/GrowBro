import type { Plant } from '@/api/plants/types';
import { TaskEngine } from '@/lib/growbro-task-engine/task-engine';
import type { SeriesSpec } from '@/lib/growbro-task-engine/types';

const seriesStore: any[] = [];
const tasksStore: any[] = [];

const mockSeriesCollection = {
  create: jest.fn(async (cb: (record: any) => void) => {
    const record: any = {
      id: `series-${seriesStore.length + 1}`,
      update: jest.fn(async (fn: (rec: any) => void) => fn(record)),
    };
    cb(record);
    seriesStore.push(record);
    return record;
  }),
  query: jest.fn(() => ({
    fetch: jest.fn(async () => seriesStore),
  })),
};

const mockTasksCollection = {
  query: jest.fn(() => ({
    fetch: jest.fn(async () => tasksStore),
  })),
};

jest.mock('@/lib/watermelon', () => ({
  database: {
    get: jest.fn((name: string) => {
      if (name === 'series') return mockSeriesCollection;
      if (name === 'tasks') return mockTasksCollection;
      return mockSeriesCollection;
    }),
    write: jest.fn(async (fn: () => Promise<void> | void) => fn()),
  },
}));

describe('TaskEngine sync schedules', () => {
  beforeEach(() => {
    seriesStore.length = 0;
    tasksStore.length = 0;
    mockSeriesCollection.create.mockClear();
  });

  it('avoids duplicate series for same engineKey/signature', async () => {
    const engine = new TaskEngine('UTC');
    const plant: Plant = {
      id: 'plant-1',
      name: 'Test Plant',
      stage: 'seedling',
      plantedAt: '2024-01-01T00:00:00.000Z',
      stageEnteredAt: '2024-01-01T00:00:00.000Z',
      metadata: { medium: 'soil' },
    };

    const spec: SeriesSpec = {
      title: 'Water Plant',
      description: 'Test schedule',
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: '2024-01-01T09:00:00.000Z',
      dtstartUtc: '2024-01-01T09:00:00.000Z',
      timezone: 'UTC',
      metadata: { engineKey: 'digital.test' },
    };

    await engine.syncSchedulesForPlant(plant, [spec]);
    await engine.syncSchedulesForPlant(plant, [spec]);

    expect(mockSeriesCollection.create).toHaveBeenCalledTimes(1);
    expect(seriesStore).toHaveLength(1);
  });

  it('updates existing series when signature changes without duplicating', async () => {
    const engine = new TaskEngine('UTC');
    const plant: Plant = {
      id: 'plant-2',
      name: 'Test Plant 2',
      stage: 'seedling',
      plantedAt: '2024-01-01T00:00:00.000Z',
      stageEnteredAt: '2024-01-01T00:00:00.000Z',
      metadata: { medium: 'soil' },
    };

    const engineKey = 'hydrology.check_water_need.symptom_dryness';
    const baseSpec: SeriesSpec = {
      title: 'Check Water Need',
      description: 'Test schedule',
      rrule: 'FREQ=DAILY;INTERVAL=1',
      dtstartLocal: '2024-01-01T09:00:00.000Z',
      dtstartUtc: '2024-01-01T09:00:00.000Z',
      timezone: 'UTC',
      metadata: { engineKey, sourceEventId: 'event-1' },
    };
    const updatedSpec: SeriesSpec = {
      ...baseSpec,
      dtstartLocal: '2024-01-02T09:00:00.000Z',
      dtstartUtc: '2024-01-02T09:00:00.000Z',
      metadata: { engineKey, sourceEventId: 'event-2' },
    };

    await engine.syncSchedulesForPlant(plant, [baseSpec]);
    await engine.syncSchedulesForPlant(plant, [updatedSpec]);

    expect(mockSeriesCollection.create).toHaveBeenCalledTimes(1);
    expect(seriesStore).toHaveLength(1);
    expect(seriesStore[0].update).toHaveBeenCalledTimes(1);
    expect(seriesStore[0].dtstartLocal).toBe(updatedSpec.dtstartLocal);
    expect(seriesStore[0].dtstartUtc).toBe(updatedSpec.dtstartUtc);
    expect(seriesStore[0].metadata?.sourceEventId).toBe('event-2');
  });
});
