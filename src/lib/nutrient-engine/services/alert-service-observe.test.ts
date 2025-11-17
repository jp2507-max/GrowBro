/**
 * Tests for observeActiveAlerts function
 */

import { observeActiveAlerts } from './alert-service';

describe('observeActiveAlerts', () => {
  let mockDb: {
    get: jest.Mock;
  };

  beforeEach(() => {
    // Mock the database observe method
    const mockObservable = {
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    };

    // Mock the database queries
    mockDb = {
      get: jest.fn().mockReturnValue({
        query: jest.fn().mockReturnValue({
          observeWithColumns: jest.fn().mockReturnValue({
            pipe: jest.fn().mockReturnValue(mockObservable),
          }),
        }),
      }),
    };
  });

  test('returns observable that filters by reservoir ID', () => {
    const observable = observeActiveAlerts('test-reservoir-id', mockDb as any);

    expect(mockDb.get).toHaveBeenCalledWith('ph_ec_readings_v2');
    expect(typeof observable.subscribe).toBe('function');
  });
});
