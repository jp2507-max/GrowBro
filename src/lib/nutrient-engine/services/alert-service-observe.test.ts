/**
 * Tests for observeActiveAlerts function
 */

import type { Database } from '@nozbe/watermelondb';

import type { DeviationAlertModel } from '@/lib/watermelon-models/deviation-alert';
import type { PhEcReadingModel } from '@/lib/watermelon-models/ph-ec-reading';

import { observeActiveAlerts } from './alert-service';

describe('observeActiveAlerts', () => {
  let mockDb: Database;

  const createMockTable = () => ({
    query: jest.fn().mockReturnThis(),
  });

  const createMockQueryBuilder = () => ({
    where: jest.fn().mockReturnThis(),
    sortBy: jest.fn().mockReturnThis(),
    observe: jest.fn(),
    observeWithColumns: jest.fn(),
  });

  beforeEach(() => {
    mockDb = {
      get: jest.fn() as any,
    } as unknown as Database;
  });

  describe('observable behavior', () => {
    test('queries ph_ec_readings_v2 with reservoir_id filter', () => {
      const mockReadingsObservable = {
        pipe: jest.fn().mockReturnValue({
          subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
        }),
      };

      const mockQueryBuilder = createMockQueryBuilder();
      mockQueryBuilder.observeWithColumns.mockReturnValue(
        mockReadingsObservable
      );

      const mockTable = createMockTable();
      mockTable.query.mockReturnValue(mockQueryBuilder);

      (mockDb.get as any).mockReturnValue(mockTable);

      const observable = observeActiveAlerts('test-reservoir-id', mockDb);

      expect(mockDb.get).toHaveBeenCalledWith('ph_ec_readings_v2');
      expect(mockTable.query).toHaveBeenCalledWith({
        _condition: 'where',
        left: 'reservoir_id',
        right: 'test-reservoir-id',
      });
      expect(mockQueryBuilder.observeWithColumns).toHaveBeenCalledWith(['id']);
      expect(typeof observable.subscribe).toBe('function');
    });

    test('returns empty observable when no readings exist', (done) => {
      const mockReadings: PhEcReadingModel[] = [];

      // Mock readings observable that emits empty array
      const mockReadingsObservable = {
        pipe: jest.fn().mockImplementation((_operator) => {
          const mockPipedObservable = {
            subscribe: jest.fn().mockImplementation((callbacks) => {
              // Simulate switchMap: emit empty readings
              setTimeout(() => callbacks.next(mockReadings), 0);
              return { unsubscribe: jest.fn() };
            }),
          };
          return mockPipedObservable;
        }),
      };

      // Mock empty alerts observable
      const mockAlertsObservable = {
        subscribe: jest.fn().mockImplementation((callbacks) => {
          setTimeout(() => callbacks.next([]), 0);
          return { unsubscribe: jest.fn() };
        }),
      };

      const mockReadingsQueryBuilder = createMockQueryBuilder();
      mockReadingsQueryBuilder.observeWithColumns.mockReturnValue(
        mockReadingsObservable
      );

      const mockAlertsQueryBuilder = createMockQueryBuilder();
      mockAlertsQueryBuilder.observe.mockReturnValue(mockAlertsObservable);

      const mockReadingsTable = createMockTable();
      mockReadingsTable.query.mockReturnValue(mockReadingsQueryBuilder);

      const mockAlertsTable = createMockTable();
      mockAlertsTable.query.mockReturnValue(mockAlertsQueryBuilder);

      (mockDb.get as any).mockImplementation((tableName: string) => {
        if (tableName === 'ph_ec_readings_v2') {
          return mockReadingsTable;
        } else if (tableName === 'deviation_alerts_v2') {
          return mockAlertsTable;
        }
        throw new Error(`Unexpected table: ${tableName}`);
      });

      const observable = observeActiveAlerts('test-reservoir-id', mockDb);

      observable.subscribe({
        next: (alerts) => {
          expect(alerts).toEqual([]);
          expect(mockDb.get).toHaveBeenNthCalledWith(1, 'ph_ec_readings_v2');
          expect(mockDb.get).toHaveBeenNthCalledWith(2, 'deviation_alerts_v2');

          // Verify empty query condition (id = '')
          expect(mockAlertsQueryBuilder.observe).toHaveBeenCalled();
          done();
        },
      });
    });

    test('queries deviation_alerts_v2 with correct filters when readings exist', (done) => {
      const mockReadings: PhEcReadingModel[] = [
        { id: 'reading-1' } as PhEcReadingModel,
        { id: 'reading-2' } as PhEcReadingModel,
      ];

      const mockAlerts: DeviationAlertModel[] = [
        { id: 'alert-1', readingId: 'reading-1' } as DeviationAlertModel,
      ];

      type AlertQueryCall =
        | { type: 'where'; field: string; condition: unknown }
        | { type: 'sortBy'; field: string; order: unknown };

      const alertQueryCalls: AlertQueryCall[] = [];

      // Mock readings observable
      const mockReadingsObservable = {
        pipe: jest.fn().mockImplementation((_operator) => {
          const mockPipedObservable = {
            subscribe: jest.fn().mockImplementation((callbacks) => {
              // Simulate switchMap: emit readings
              setTimeout(() => callbacks.next(mockReadings), 0);
              return { unsubscribe: jest.fn() };
            }),
          };
          return mockPipedObservable;
        }),
      };

      // Mock alerts observable
      const mockAlertsObservable = {
        subscribe: jest.fn().mockImplementation((callbacks) => {
          setTimeout(() => callbacks.next(mockAlerts), 0);
          return { unsubscribe: jest.fn() };
        }),
      };

      // Mock query builder for alerts that captures conditions
      const mockAlertsQueryBuilder = createMockQueryBuilder();
      mockAlertsQueryBuilder.observe.mockReturnValue(mockAlertsObservable);

      // Override methods to capture calls
      mockAlertsQueryBuilder.where.mockImplementation(
        (field: string, condition: unknown) => {
          alertQueryCalls.push({ type: 'where', field, condition });
          return mockAlertsQueryBuilder;
        }
      );
      mockAlertsQueryBuilder.sortBy.mockImplementation(
        (field: string, order: unknown) => {
          alertQueryCalls.push({ type: 'sortBy', field, order });
          return mockAlertsQueryBuilder;
        }
      );

      const mockReadingsQueryBuilder = createMockQueryBuilder();
      mockReadingsQueryBuilder.observeWithColumns.mockReturnValue(
        mockReadingsObservable
      );

      const mockReadingsTable = createMockTable();
      mockReadingsTable.query.mockReturnValue(mockReadingsQueryBuilder);

      const mockAlertsTable = createMockTable();
      mockAlertsTable.query.mockReturnValue(mockAlertsQueryBuilder);

      (mockDb.get as any).mockImplementation((tableName: string) => {
        if (tableName === 'ph_ec_readings_v2') {
          return mockReadingsTable;
        } else if (tableName === 'deviation_alerts_v2') {
          return mockAlertsTable;
        }
        throw new Error(`Unexpected table: ${tableName}`);
      });

      const observable = observeActiveAlerts('test-reservoir-id', mockDb);

      observable.subscribe({
        next: (alerts) => {
          expect(alerts).toEqual(mockAlerts);

          // Verify queries were called
          expect(mockDb.get).toHaveBeenNthCalledWith(1, 'ph_ec_readings_v2');
          expect(mockDb.get).toHaveBeenNthCalledWith(2, 'deviation_alerts_v2');

          // Verify alert query conditions
          expect(alertQueryCalls).toHaveLength(3);

          // First condition: reading_id oneOf filter
          expect(alertQueryCalls[0]).toEqual({
            type: 'where',
            field: 'reading_id',
            condition: {
              _condition: 'oneOf',
              values: ['reading-1', 'reading-2'],
            },
          });

          // Second condition: resolved_at null filter
          expect(alertQueryCalls[1]).toEqual({
            type: 'where',
            field: 'resolved_at',
            condition: null,
          });

          // Third condition: sort by triggered_at desc
          expect(alertQueryCalls[2]).toEqual({
            type: 'sortBy',
            field: 'triggered_at',
            order: { _sortOrder: 'desc' },
          });

          done();
        },
      });
    });
  });
});
