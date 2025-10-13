/**
 * Tests for reservoir event tracking service
 *
 * Tests database operations, event tracking, undo functionality,
 * and dose calculation helpers.
 *
 * Requirements: 1.6, 1.7, 2.5, 2.8, 7.6
 */

// Mock the database import before importing the service

import {
  calculateDilutionRecommendation,
  calculateDoseRecommendation,
  createReservoirEvent,
  deleteReservoirEvent,
  getCumulativeEcChange,
  getCumulativePhChange,
  getRecentEvents,
  listEventsByDateRange,
  listEventsByReservoir,
  observeRecentEvents,
  observeReservoirEvents,
  undoLastEvent,
} from './reservoir-event-service';

const mockDatabase = {
  get: jest.fn(),
  write: jest.fn((fn) => fn()),
};

jest.mock('@/lib/watermelon', () => ({
  database: mockDatabase,
}));

// Mock WatermelonDB
jest.mock('@nozbe/watermelondb');

// ============================================================================
// Test Setup
// ============================================================================

describe('reservoir-event-service', () => {
  let mockCollection: any;
  let mockEvent: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mocks
    mockEvent = {
      id: 'event-1',
      reservoirId: 'reservoir-1',
      kind: 'ADD_NUTRIENT',
      deltaEc25c: 0.5,
      deltaPh: -0.2,
      note: 'Added nutrients',
      userId: 'user-1',
      createdAt: new Date(Date.now() - 1000), // 1 second ago
      updatedAt: new Date(),
      markAsDeleted: jest.fn(),
      update: jest.fn((fn) => {
        fn(mockEvent);
        return Promise.resolve(mockEvent);
      }),
    };

    mockCollection = {
      create: jest.fn((fn) => {
        fn(mockEvent);
        return Promise.resolve(mockEvent);
      }),
      find: jest.fn().mockResolvedValue(mockEvent),
      query: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue([mockEvent]),
        observe: jest.fn().mockReturnValue({
          subscribe: jest.fn().mockReturnValue({
            unsubscribe: jest.fn(),
          }),
        }),
      }),
    };

    // Mock the database methods
    mockDatabase.get.mockReturnValue(mockCollection);
    mockDatabase.write.mockImplementation((fn) => fn());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  // ============================================================================
  // Database Operations Tests
  // ============================================================================

  describe('Database Operations', () => {
    describe('createReservoirEvent', () => {
      test('creates valid event with all fields', async () => {
        const eventData = {
          reservoirId: 'reservoir-1',
          kind: 'ADD_NUTRIENT' as const,
          deltaEc25c: 0.5,
          deltaPh: -0.2,
          note: 'Added nutrients',
        };

        const result = await createReservoirEvent(eventData, 'user-1');

        expect(result.id).toBe('event-1');
        expect(result.reservoirId).toBe('reservoir-1');
        expect(result.kind).toBe('ADD_NUTRIENT');
        expect(result.deltaEc25c).toBe(0.5);
        expect(result.deltaPh).toBe(-0.2);
        expect(result.note).toBe('Added nutrients');
        expect(mockDatabase.write).toHaveBeenCalled();
        expect(mockCollection.create).toHaveBeenCalled();
      });

      test('creates event with minimal fields', async () => {
        const eventData = {
          reservoirId: 'reservoir-1',
          kind: 'FILL' as const,
        };

        await createReservoirEvent(eventData);

        expect(mockCollection.create).toHaveBeenCalled();
        expect(mockDatabase.write).toHaveBeenCalled();
      });

      test('validates required reservoirId', async () => {
        const eventData = {
          reservoirId: '',
          kind: 'FILL' as const,
        };

        await expect(createReservoirEvent(eventData)).rejects.toThrow(
          'Reservoir ID is required'
        );
      });

      test('validates required kind', async () => {
        const eventData = {
          reservoirId: 'reservoir-1',
          kind: '' as any,
        };

        await expect(createReservoirEvent(eventData)).rejects.toThrow(
          'Event kind is required'
        );
      });

      test('validates deltaEc25c range', async () => {
        const eventData = {
          reservoirId: 'reservoir-1',
          kind: 'ADD_NUTRIENT' as const,
          deltaEc25c: 15, // Too high
        };

        await expect(createReservoirEvent(eventData)).rejects.toThrow(
          'EC delta exceeds reasonable range'
        );
      });

      test('validates deltaPh range', async () => {
        const eventData = {
          reservoirId: 'reservoir-1',
          kind: 'PH_UP' as const,
          deltaPh: 10, // Too high
        };

        await expect(createReservoirEvent(eventData)).rejects.toThrow(
          'pH delta exceeds reasonable range'
        );
      });
    });

    describe('listEventsByReservoir', () => {
      test('returns events sorted by creation date descending', async () => {
        const events = [
          {
            ...mockEvent,
            id: 'event-1',
            createdAt: new Date(Date.now() - 3000),
          },
          {
            ...mockEvent,
            id: 'event-2',
            createdAt: new Date(Date.now() - 1000),
          },
          {
            ...mockEvent,
            id: 'event-3',
            createdAt: new Date(Date.now() - 2000),
          },
        ];

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue(events),
        });

        const result = await listEventsByReservoir('reservoir-1');

        expect(result).toHaveLength(3);
        expect(result[0].id).toBe('event-2'); // Most recent first
        expect(result[1].id).toBe('event-3');
        expect(result[2].id).toBe('event-1');
      });

      test('respects limit parameter', async () => {
        const events = Array.from({ length: 10 }, (_, i) => ({
          ...mockEvent,
          id: `event-${i}`,
        }));

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue(events),
        });

        const result = await listEventsByReservoir('reservoir-1', 5);

        expect(result).toHaveLength(5);
      });

      test('returns empty array for reservoir with no events', async () => {
        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        });

        const result = await listEventsByReservoir('empty-reservoir');

        expect(result).toEqual([]);
      });
    });

    describe('listEventsByDateRange', () => {
      test('filters events within date range', async () => {
        const startMs = Date.now() - 5000;
        const endMs = Date.now() + 5000;

        const events = [
          { ...mockEvent, createdAt: new Date(startMs + 1000) },
          { ...mockEvent, createdAt: new Date(startMs - 1000) }, // Before range
          { ...mockEvent, createdAt: new Date(endMs + 1000) }, // After range
        ];

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([events[0]]),
        });

        const result = await listEventsByDateRange(
          'reservoir-1',
          startMs,
          endMs
        );

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(events[0]);
      });

      test('sorts events by creation date ascending', async () => {
        const events = [
          {
            ...mockEvent,
            id: 'event-1',
            createdAt: new Date(Date.now() + 2000),
          },
          {
            ...mockEvent,
            id: 'event-2',
            createdAt: new Date(Date.now() + 1000),
          },
        ];

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([events[1], events[0]]), // Wrong order from DB
        });

        const result = await listEventsByDateRange(
          'reservoir-1',
          0,
          Date.now() + 3000
        );

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('event-2'); // Earlier first
        expect(result[1].id).toBe('event-1');
      });
    });

    describe('getRecentEvents', () => {
      test('returns events within undo window', async () => {
        const recentEvent = {
          ...mockEvent,
          createdAt: new Date(Date.now() - 1000),
        };

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([recentEvent]),
        });

        const result = await getRecentEvents('reservoir-1');

        expect(result).toHaveLength(1);
        expect(result[0]).toBe(recentEvent);
      });

      test('sorts recent events by creation date descending', async () => {
        const events = [
          {
            ...mockEvent,
            id: 'event-1',
            createdAt: new Date(Date.now() - 3000),
          },
          {
            ...mockEvent,
            id: 'event-2',
            createdAt: new Date(Date.now() - 1000),
          },
        ];

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([events[1], events[0]]),
        });

        const result = await getRecentEvents('reservoir-1');

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('event-2'); // Most recent first
        expect(result[1].id).toBe('event-1');
      });
    });

    describe('undoLastEvent', () => {
      test('creates compensating event for last event', async () => {
        const lastEvent = {
          ...mockEvent,
          deltaEc25c: 0.5,
          deltaPh: -0.2,
          note: 'Added nutrients',
        };

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([lastEvent]),
        });

        const result = await undoLastEvent('reservoir-1', 'user-1');

        expect(result).not.toBeNull();
        expect(result?.deltaEc25c).toBe(-0.5); // Opposite
        expect(result?.deltaPh).toBe(0.2); // Opposite
        expect(result?.note).toContain('Undo: ADD_NUTRIENT');
        expect(mockCollection.create).toHaveBeenCalled();
      });

      test('returns null when no recent events', async () => {
        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        });

        const result = await undoLastEvent('reservoir-1');

        expect(result).toBeNull();
        expect(mockCollection.create).not.toHaveBeenCalled();
      });

      test('handles event with only EC change', async () => {
        const lastEvent = { ...mockEvent, deltaEc25c: 0.3, deltaPh: undefined };

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([lastEvent]),
        });

        const result = await undoLastEvent('reservoir-1');

        expect(result?.deltaEc25c).toBe(-0.3);
        expect(result?.deltaPh).toBeUndefined();
      });

      test('handles event with only pH change', async () => {
        const lastEvent = { ...mockEvent, deltaPh: 0.1, deltaEc25c: undefined };

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([lastEvent]),
        });

        const result = await undoLastEvent('reservoir-1');

        expect(result?.deltaPh).toBe(-0.1);
        expect(result?.deltaEc25c).toBeUndefined();
      });
    });

    describe('getCumulativeEcChange', () => {
      test('calculates total EC change within date range', async () => {
        const events = [
          { ...mockEvent, deltaEc25c: 0.5 },
          { ...mockEvent, deltaEc25c: -0.2 },
          { ...mockEvent, deltaEc25c: 0.3 },
        ];

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue(events),
        });

        const result = await getCumulativeEcChange(
          'reservoir-1',
          0,
          Date.now() + 1000
        );

        expect(result).toBe(0.6); // 0.5 - 0.2 + 0.3
      });

      test('ignores events without EC delta', async () => {
        const events = [
          { ...mockEvent, deltaEc25c: 0.5 },
          { ...mockEvent, deltaEc25c: undefined },
          { ...mockEvent, deltaEc25c: 0.3 },
        ];

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue(events),
        });

        const result = await getCumulativeEcChange(
          'reservoir-1',
          0,
          Date.now() + 1000
        );

        expect(result).toBe(0.8); // 0.5 + 0.3
      });

      test('returns 0 for no events', async () => {
        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        });

        const result = await getCumulativeEcChange(
          'reservoir-1',
          0,
          Date.now() + 1000
        );

        expect(result).toBe(0);
      });
    });

    describe('getCumulativePhChange', () => {
      test('calculates total pH change within date range', async () => {
        const events = [
          { ...mockEvent, deltaPh: -0.2 },
          { ...mockEvent, deltaPh: 0.1 },
          { ...mockEvent, deltaPh: -0.3 },
        ];

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue(events),
        });

        const result = await getCumulativePhChange(
          'reservoir-1',
          0,
          Date.now() + 1000
        );

        expect(result).toBe(-0.4); // -0.2 + 0.1 - 0.3
      });

      test('ignores events without pH delta', async () => {
        const events = [
          { ...mockEvent, deltaPh: -0.2 },
          { ...mockEvent, deltaPh: undefined },
          { ...mockEvent, deltaPh: 0.1 },
        ];

        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue(events),
        });

        const result = await getCumulativePhChange(
          'reservoir-1',
          0,
          Date.now() + 1000
        );

        expect(result).toBe(-0.1); // -0.2 + 0.1
      });

      test('returns 0 for no events', async () => {
        mockCollection.query.mockReturnValue({
          fetch: jest.fn().mockResolvedValue([]),
        });

        const result = await getCumulativePhChange(
          'reservoir-1',
          0,
          Date.now() + 1000
        );

        expect(result).toBe(0);
      });
    });

    describe('deleteReservoirEvent', () => {
      test('marks event as deleted', async () => {
        await deleteReservoirEvent('event-1');

        expect(mockEvent.markAsDeleted).toHaveBeenCalled();
        expect(mockDatabase.write).toHaveBeenCalled();
        expect(mockCollection.find).toHaveBeenCalledWith('event-1');
      });

      test('throws error for non-existent event', async () => {
        mockCollection.find.mockRejectedValueOnce(new Error('Not found'));

        await expect(deleteReservoirEvent('non-existent')).rejects.toThrow();
      });
    });

    describe('observeReservoirEvents', () => {
      test('returns observable that emits events', async () => {
        const mockObservable = {
          subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
        };

        mockCollection.query.mockReturnValue({
          observe: jest.fn().mockReturnValue(mockObservable),
        });

        const observable = observeReservoirEvents('reservoir-1');

        expect(observable).toBeDefined();
        expect(typeof observable.subscribe).toBe('function');
      });

      test('respects limit parameter', async () => {
        const mockObservable = {
          subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
        };

        mockCollection.query.mockReturnValue({
          observe: jest.fn().mockReturnValue(mockObservable),
        });

        observeReservoirEvents('reservoir-1', 10);

        expect(mockCollection.query).toHaveBeenCalled();
      });
    });

    describe('observeRecentEvents', () => {
      test('returns observable that filters recent events', async () => {
        const mockObservable = {
          subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
        };

        mockCollection.query.mockReturnValue({
          observe: jest.fn().mockReturnValue(mockObservable),
        });

        const observable = observeRecentEvents('reservoir-1');

        expect(observable).toBeDefined();
        expect(typeof observable.subscribe).toBe('function');
      });
    });
  });

  // ==========================================================================
  // Dose Calculation Tests (Requirement 2.8)
  // ==========================================================================

  describe('calculateDoseRecommendation', () => {
    test('calculates single-step dose for small increase', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 1.0,
        targetEc25c: 1.1,
        volumeL: 20,
        stockConcentration: 1.0,
      });

      expect(recommendation.currentEc25c).toBe(1.0);
      expect(recommendation.targetEc25c).toBe(1.1);
      expect(recommendation.recommendedAdditionML).toBeCloseTo(1.8, 1);
      expect(recommendation.steps).toHaveLength(1);
      expect(recommendation.warnings.length).toBeGreaterThan(0);
    });

    test('calculates multi-step dose for large increase', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 0.5,
        targetEc25c: 2.0,
        volumeL: 20,
        stockConcentration: 1.0,
      });

      expect(recommendation.steps.length).toBeGreaterThan(1);
      expect(
        recommendation.warnings.some((w) => w.includes('EDUCATIONAL GUIDANCE'))
      ).toBe(true);

      recommendation.steps.forEach((step) => {
        expect(step.additionML).toBeGreaterThan(0);
        expect(step.waitTimeMinutes).toBe(15);
      });
    });

    test('handles current EC at or above target', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 2.0,
        targetEc25c: 1.5,
        volumeL: 20,
        stockConcentration: 1.0,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(recommendation.warnings[0]).toContain('at or above target');
    });

    test('includes safety warnings', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 1.0,
        targetEc25c: 1.5,
        volumeL: 20,
        stockConcentration: 1.0,
      });

      expect(
        recommendation.warnings.some((w) => w.includes('EDUCATIONAL GUIDANCE'))
      ).toBe(true);
      expect(
        recommendation.warnings.some((w) => w.includes('Conservative dosing'))
      ).toBe(true);
      expect(recommendation.safetyMargin).toBe(0.9);
    });

    test('validates input parameters', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 15,
        targetEc25c: 1.5,
        volumeL: 20,
        stockConcentration: 1.0,
      });

      expect(
        recommendation.warnings.some((w) => w.includes('outside normal range'))
      ).toBe(true);
    });

    test('handles zero stock concentration', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 1.0,
        targetEc25c: 2.0,
        volumeL: 20,
        stockConcentration: 0,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('Stock concentration must be positive')
        )
      ).toBe(true);
    });

    test('handles negative stock concentration', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 1.0,
        targetEc25c: 2.0,
        volumeL: 20,
        stockConcentration: -0.5,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('Stock concentration must be positive')
        )
      ).toBe(true);
    });

    test('handles zero volume with volume-related warning', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 1.0,
        targetEc25c: 2.0,
        volumeL: 0,
        stockConcentration: 1.0,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('Reservoir volume outside reasonable range')
        )
      ).toBe(true);
    });

    test('handles negative volume with volume-related warning', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 1.0,
        targetEc25c: 2.0,
        volumeL: -5,
        stockConcentration: 1.0,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('Reservoir volume outside reasonable range')
        )
      ).toBe(true);
    });

    test('handles negative current EC with warning', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: -1.0,
        targetEc25c: 2.0,
        volumeL: 20,
        stockConcentration: 1.0,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('Current EC cannot be negative')
        )
      ).toBe(true);
    });

    test('handles negative target EC with warning', () => {
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 1.0,
        targetEc25c: -0.5,
        volumeL: 20,
        stockConcentration: 1.0,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('Target EC cannot be negative')
        )
      ).toBe(true);
    });

    test('handles null current EC with validation warning', () => {
      // @ts-expect-error Testing invalid input
      const recommendation = calculateDoseRecommendation({
        currentEc25c: null,
        targetEc25c: 2.0,
        volumeL: 20,
        stockConcentration: 1.0,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('All parameters must be valid numbers')
        )
      ).toBe(true);
    });

    test('handles undefined target EC with validation warning', () => {
      // @ts-expect-error Testing invalid input
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 1.0,
        targetEc25c: undefined,
        volumeL: 20,
        stockConcentration: 1.0,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('All parameters must be valid numbers')
        )
      ).toBe(true);
    });

    test('handles null volume with validation warning', () => {
      // @ts-expect-error Testing invalid input
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 1.0,
        targetEc25c: 2.0,
        volumeL: null,
        stockConcentration: 1.0,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('All parameters must be valid numbers')
        )
      ).toBe(true);
    });

    test('handles undefined stock concentration with validation warning', () => {
      // @ts-expect-error Testing invalid input
      const recommendation = calculateDoseRecommendation({
        currentEc25c: 1.0,
        targetEc25c: 2.0,
        volumeL: 20,
        stockConcentration: undefined,
      });

      expect(recommendation.recommendedAdditionML).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('All parameters must be valid numbers')
        )
      ).toBe(true);
    });
  });

  describe('calculateDilutionRecommendation', () => {
    test('calculates dilution volume for EC reduction', () => {
      const recommendation = calculateDilutionRecommendation({
        currentEc25c: 2.0,
        targetEc25c: 1.5,
        currentVolumeL: 20,
        sourceWaterEc25c: 0,
      });

      expect(recommendation.dilutionVolumeL).toBeCloseTo(6.7, 1);
      expect(recommendation.finalVolumeL).toBeCloseTo(26.7, 1);
      expect(recommendation.steps.length).toBeGreaterThan(0);
      expect(
        recommendation.warnings.some((w) => w.includes('EDUCATIONAL GUIDANCE'))
      ).toBe(true);
    });

    test('handles current EC at or below target', () => {
      const recommendation = calculateDilutionRecommendation({
        currentEc25c: 1.0,
        targetEc25c: 1.5,
        currentVolumeL: 20,
        sourceWaterEc25c: 0,
      });

      expect(recommendation.dilutionVolumeL).toBe(0);
      expect(recommendation.steps).toHaveLength(0);
      expect(recommendation.warnings[0]).toContain('at or below target');
    });

    test('handles source water with EC', () => {
      const recommendation = calculateDilutionRecommendation({
        currentEc25c: 2.0,
        targetEc25c: 1.5,
        currentVolumeL: 20,
        sourceWaterEc25c: 0.3,
      });

      expect(recommendation.dilutionVolumeL).toBeGreaterThan(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('source water is pH-adjusted')
        )
      ).toBe(true);
    });

    test('handles impossible dilution target', () => {
      const recommendation = calculateDilutionRecommendation({
        currentEc25c: 2.0,
        targetEc25c: 0.5,
        currentVolumeL: 20,
        sourceWaterEc25c: 0.8,
      });

      expect(recommendation.dilutionVolumeL).toBe(0);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('at or below source water EC')
        )
      ).toBe(true);
    });

    test('provides step-by-step instructions', () => {
      const recommendation = calculateDilutionRecommendation({
        currentEc25c: 2.0,
        targetEc25c: 1.5,
        currentVolumeL: 20,
        sourceWaterEc25c: 0,
      });

      expect(recommendation.steps.some((s) => s.includes('Remove'))).toBe(true);
      expect(recommendation.steps.some((s) => s.includes('Add'))).toBe(true);
      expect(recommendation.steps.some((s) => s.includes('Mix'))).toBe(true);
      expect(recommendation.steps.some((s) => s.includes('Measure'))).toBe(
        true
      );
    });

    test('handles zero current volume with dilution steps', () => {
      const recommendation = calculateDilutionRecommendation({
        currentEc25c: 2.0,
        targetEc25c: 1.5,
        currentVolumeL: 0,
        sourceWaterEc25c: 0,
      });

      expect(recommendation.dilutionVolumeL).toBe(0);
      expect(recommendation.finalVolumeL).toBe(0);
      expect(recommendation.steps).toHaveLength(5); // Still generates steps even with 0 dilution
      expect(
        recommendation.warnings.some((w) => w.toLowerCase().includes('volume'))
      ).toBe(true);
    });

    test('handles negative current volume with calculated dilution', () => {
      const recommendation = calculateDilutionRecommendation({
        currentEc25c: 2.0,
        targetEc25c: 1.5,
        currentVolumeL: -5,
        sourceWaterEc25c: 0,
      });

      expect(recommendation.dilutionVolumeL).toBeCloseTo(-1.7, 1);
      expect(recommendation.finalVolumeL).toBeCloseTo(-6.7, 1);
      expect(recommendation.steps).toHaveLength(5);
      expect(
        recommendation.warnings.some((w) => w.toLowerCase().includes('volume'))
      ).toBe(true);
    });

    test('handles extreme dilution requirements with large dilution volume', () => {
      const recommendation = calculateDilutionRecommendation({
        currentEc25c: 10.0,
        targetEc25c: 1.0,
        currentVolumeL: 20,
        sourceWaterEc25c: 0,
      });

      expect(recommendation.dilutionVolumeL).toBeGreaterThan(100);
      expect(recommendation.finalVolumeL).toBeGreaterThan(120);
      expect(recommendation.steps).toHaveLength(5);
      expect(
        recommendation.warnings.some((w) => w.toLowerCase().includes('volume'))
      ).toBe(true);
    });

    test('warns about reservoir capacity for large final volumes', () => {
      const recommendation = calculateDilutionRecommendation({
        currentEc25c: 5.0,
        targetEc25c: 1.0,
        currentVolumeL: 50,
        sourceWaterEc25c: 0,
      });

      expect(recommendation.dilutionVolumeL).toBeGreaterThan(100);
      expect(recommendation.finalVolumeL).toBeGreaterThan(150);
      expect(
        recommendation.warnings.some((w) =>
          w.includes('Verify your reservoir can accommodate')
        )
      ).toBe(true);
    });
  });
});
