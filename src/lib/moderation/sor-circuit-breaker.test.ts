import { cleanup } from '@/lib/test-utils';

import { CircuitBreaker } from './sor-circuit-breaker';

afterEach(cleanup);

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockOperation: jest.Mock;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      resetTimeout: 2000,
    });
    mockOperation = jest.fn();
  });

  describe('initial state', () => {
    test('starts in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.isHealthy()).toBe(true);
      expect(circuitBreaker.isOpen()).toBe(false);
    });

    test('starts with zero counters', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.totalRequests).toBe(0);
      expect(stats.totalFailures).toBe(0);
      expect(stats.totalSuccesses).toBe(0);
    });
  });

  describe('successful operations', () => {
    test('remains CLOSED with successful operations', async () => {
      mockOperation.mockResolvedValue('success');

      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);

      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.isHealthy()).toBe(true);
    });

    test('resets failure count on success', async () => {
      // First fail twice
      mockOperation.mockRejectedValueOnce(new Error('fail'));
      mockOperation.mockRejectedValueOnce(new Error('fail'));
      mockOperation.mockResolvedValueOnce('success');

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await circuitBreaker.execute(mockOperation);

      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0); // Reset after success
      expect(stats.totalFailures).toBe(2);
      expect(stats.totalSuccesses).toBe(1);
    });

    test('tracks total requests and successes', async () => {
      mockOperation.mockResolvedValue('success');

      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);
      await circuitBreaker.execute(mockOperation);

      const stats = circuitBreaker.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalSuccesses).toBe(3);
      expect(stats.totalFailures).toBe(0);
    });
  });

  describe('failure transitions', () => {
    test('transitions to OPEN after exceeding failure threshold', async () => {
      mockOperation.mockRejectedValue(new Error('fail'));

      // Should remain CLOSED for first 2 failures
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('CLOSED');

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Third failure should open circuit
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    test('rejects requests when OPEN', async () => {
      mockOperation.mockRejectedValue(new Error('fail'));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Further requests should fail fast
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        'Circuit breaker is OPEN'
      );
      expect(mockOperation).toHaveBeenCalledTimes(3); // No additional calls
    });

    test('tracks failure statistics', async () => {
      mockOperation.mockRejectedValue(new Error('fail'));

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();

      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(2);
      expect(stats.totalFailures).toBe(2);
      expect(stats.totalRequests).toBe(2);
      expect(stats.lastFailureTime).toBeInstanceOf(Date);
    });
  });

  describe('HALF_OPEN state', () => {
    beforeEach(async () => {
      // Open the circuit first
      mockOperation.mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    test('transitions to HALF_OPEN after reset timeout', async () => {
      // Open the circuit first
      mockOperation.mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait for reset timeout (2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2100));

      mockOperation.mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);

      expect(circuitBreaker.getState()).toBe('HALF_OPEN');
    });

    test('transitions back to OPEN on failure in HALF_OPEN', async () => {
      // Open circuit first, then transition to HALF_OPEN
      mockOperation.mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait and transition to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 2100));
      mockOperation.mockRejectedValue(new Error('fail'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();

      // Any failure in HALF_OPEN should immediately reopen circuit
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    test('transitions to CLOSED after success threshold in HALF_OPEN', async () => {
      // Open circuit first, then transition to HALF_OPEN
      mockOperation.mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait and transition to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Mock successful operations
      mockOperation.mockResolvedValue('success');

      await circuitBreaker.execute(mockOperation);
      expect(circuitBreaker.getState()).toBe('HALF_OPEN'); // 1 success, need 2

      await circuitBreaker.execute(mockOperation);
      expect(circuitBreaker.getState()).toBe('CLOSED'); // 2 successes, circuit closes
    });

    test('resets success count when transitioning to HALF_OPEN', async () => {
      // Open circuit first, then transition to HALF_OPEN
      mockOperation.mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Wait and transition to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 2100));

      mockOperation.mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);

      const stats = circuitBreaker.getStats();
      expect(stats.successCount).toBe(1);

      // Simulate state transition by calling reset
      circuitBreaker.reset();
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Transition back to HALF_OPEN
      mockOperation.mockRejectedValueOnce(new Error('fail'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();

      const newStats = circuitBreaker.getStats();
      expect(newStats.successCount).toBe(0); // Reset
    });
  });

  describe('manual state control', () => {
    test('can manually reset circuit', () => {
      // Open circuit manually
      circuitBreaker.open();
      expect(circuitBreaker.getState()).toBe('OPEN');

      // Reset to closed
      circuitBreaker.reset();
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    test('can manually open circuit', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');

      circuitBreaker.open();
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    test('reset clears all counters', () => {
      circuitBreaker.open();
      circuitBreaker.reset();

      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.lastFailureTime).toBe(null);
    });
  });

  describe('state change listeners', () => {
    test('notifies listeners on state changes', async () => {
      const listener = jest.fn();
      circuitBreaker.onStateChange(listener);

      // Open circuit
      mockOperation.mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }

      expect(listener).toHaveBeenCalledWith('OPEN');
    });

    test('handles listener errors gracefully', async () => {
      const failingListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener failed');
      });
      const normalListener = jest.fn();

      circuitBreaker.onStateChange(failingListener);
      circuitBreaker.onStateChange(normalListener);

      // Open circuit - should not crash despite failing listener
      mockOperation.mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow();
      }

      expect(failingListener).toHaveBeenCalledWith('OPEN');
      expect(normalListener).toHaveBeenCalledWith('OPEN');
    });
  });

  describe('configuration', () => {
    test('uses default configuration when not provided', () => {
      const defaultBreaker = new CircuitBreaker();
      const config = defaultBreaker.getConfig();

      expect(config.failureThreshold).toBe(5);
      expect(config.successThreshold).toBe(2);
      expect(config.timeout).toBe(60000);
      expect(config.resetTimeout).toBe(60000);
    });

    test('overrides default configuration', () => {
      const config = circuitBreaker.getConfig();

      expect(config.failureThreshold).toBe(3);
      expect(config.successThreshold).toBe(2);
      expect(config.timeout).toBe(1000);
      expect(config.resetTimeout).toBe(2000);
    });

    test('can update configuration', () => {
      circuitBreaker.updateConfig({
        failureThreshold: 10,
        successThreshold: 5,
      });

      const config = circuitBreaker.getConfig();
      expect(config.failureThreshold).toBe(10);
      expect(config.successThreshold).toBe(5);
      expect(config.timeout).toBe(1000); // Unchanged
    });
  });

  describe('statistics', () => {
    test('provides comprehensive statistics', async () => {
      // Consecutive failures to trigger OPEN state
      mockOperation
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockRejectedValueOnce(new Error('fail3'))
        .mockResolvedValueOnce('success1')
        .mockRejectedValueOnce(new Error('fail4'));

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(); // fail1
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(); // fail2
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(); // fail3 -> OPEN

      const stats = circuitBreaker.getStats();

      expect(stats.state).toBe('OPEN');
      expect(stats.totalRequests).toBe(3);
      expect(stats.totalSuccesses).toBe(0);
      expect(stats.totalFailures).toBe(3);
      expect(stats.failureCount).toBe(3);
      expect(stats.lastFailureTime).toBeInstanceOf(Date);
      expect(stats.lastStateChange).toBeInstanceOf(Date);
    });
  });
});
