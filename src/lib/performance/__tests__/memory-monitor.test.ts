/**
 * Unit tests for memory monitoring utilities
 */

import {
  calculateAverageMemory,
  calculateMemoryDeltaMB,
  findPeakMemory,
  forceGarbageCollection,
  formatMemoryMetrics,
  getMemoryMetrics,
  wait,
} from '../memory-monitor';
import type { MemoryMetrics } from '../types';

describe('memory-monitor', () => {
  describe('getMemoryMetrics', () => {
    it('returns memory metrics snapshot', () => {
      const metrics = getMemoryMetrics();

      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('heapUsed');
      expect(metrics).toHaveProperty('heapTotal');
      expect(metrics).toHaveProperty('rssMemory');
      expect(typeof metrics.timestamp).toBe('number');
      expect(typeof metrics.heapUsed).toBe('number');
      expect(typeof metrics.heapTotal).toBe('number');
      expect(typeof metrics.rssMemory).toBe('number');
    });

    it('returns non-negative memory values', () => {
      const metrics = getMemoryMetrics();

      expect(metrics.heapUsed).toBeGreaterThanOrEqual(0);
      expect(metrics.heapTotal).toBeGreaterThanOrEqual(0);
      expect(metrics.rssMemory).toBeGreaterThanOrEqual(0);
    });
  });

  describe('forceGarbageCollection', () => {
    it('calls global.gc if available', () => {
      const mockGC = jest.fn();
      global.gc = mockGC;

      forceGarbageCollection();

      expect(mockGC).toHaveBeenCalledTimes(1);
    });

    it('handles missing global.gc gracefully', () => {
      const globalWithGC = global as unknown as { gc?: () => void };
      globalWithGC.gc = undefined;

      expect(() => forceGarbageCollection()).not.toThrow();
    });
  });

  describe('calculateMemoryDeltaMB', () => {
    it('calculates positive memory delta', () => {
      const baseline: MemoryMetrics = {
        timestamp: Date.now(),
        heapUsed: 10 * 1024 * 1024,
        heapTotal: 20 * 1024 * 1024,
        rssMemory: 30 * 1024 * 1024,
      };

      const current: MemoryMetrics = {
        timestamp: Date.now(),
        heapUsed: 15 * 1024 * 1024,
        heapTotal: 25 * 1024 * 1024,
        rssMemory: 80 * 1024 * 1024, // +50MB
      };

      const delta = calculateMemoryDeltaMB(baseline, current);

      expect(delta).toBeCloseTo(50, 1);
    });

    it('calculates negative memory delta', () => {
      const baseline: MemoryMetrics = {
        timestamp: Date.now(),
        heapUsed: 10 * 1024 * 1024,
        heapTotal: 20 * 1024 * 1024,
        rssMemory: 80 * 1024 * 1024,
      };

      const current: MemoryMetrics = {
        timestamp: Date.now(),
        heapUsed: 5 * 1024 * 1024,
        heapTotal: 15 * 1024 * 1024,
        rssMemory: 30 * 1024 * 1024, // -50MB
      };

      const delta = calculateMemoryDeltaMB(baseline, current);

      expect(delta).toBeCloseTo(-50, 1);
    });

    it('returns zero for identical metrics', () => {
      const metrics: MemoryMetrics = {
        timestamp: Date.now(),
        heapUsed: 10 * 1024 * 1024,
        heapTotal: 20 * 1024 * 1024,
        rssMemory: 30 * 1024 * 1024,
      };

      const delta = calculateMemoryDeltaMB(metrics, metrics);

      expect(delta).toBe(0);
    });
  });

  describe('formatMemoryMetrics', () => {
    it('formats memory metrics as string', () => {
      const metrics: MemoryMetrics = {
        timestamp: Date.now(),
        heapUsed: 10 * 1024 * 1024,
        heapTotal: 20 * 1024 * 1024,
        rssMemory: 30 * 1024 * 1024,
      };

      const formatted = formatMemoryMetrics(metrics);

      expect(formatted).toContain('Heap:');
      expect(formatted).toContain('RSS:');
      expect(formatted).toContain('MB');
    });
  });

  describe('wait', () => {
    it('resolves after specified duration', async () => {
      const start = Date.now();
      await wait(100);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(90); // Allow 10ms tolerance
    });
  });

  describe('findPeakMemory', () => {
    it('finds sample with highest RSS', () => {
      const samples: MemoryMetrics[] = [
        {
          timestamp: Date.now(),
          heapUsed: 10 * 1024 * 1024,
          heapTotal: 20 * 1024 * 1024,
          rssMemory: 30 * 1024 * 1024,
        },
        {
          timestamp: Date.now(),
          heapUsed: 15 * 1024 * 1024,
          heapTotal: 25 * 1024 * 1024,
          rssMemory: 80 * 1024 * 1024, // Peak
        },
        {
          timestamp: Date.now(),
          heapUsed: 12 * 1024 * 1024,
          heapTotal: 22 * 1024 * 1024,
          rssMemory: 50 * 1024 * 1024,
        },
      ];

      const peak = findPeakMemory(samples);

      expect(peak.rssMemory).toBe(80 * 1024 * 1024);
    });

    it('returns first sample when all have same RSS', () => {
      const samples: MemoryMetrics[] = [
        {
          timestamp: 1000,
          heapUsed: 10 * 1024 * 1024,
          heapTotal: 20 * 1024 * 1024,
          rssMemory: 30 * 1024 * 1024,
        },
        {
          timestamp: 2000,
          heapUsed: 10 * 1024 * 1024,
          heapTotal: 20 * 1024 * 1024,
          rssMemory: 30 * 1024 * 1024,
        },
      ];

      const peak = findPeakMemory(samples);

      expect(peak.timestamp).toBe(1000);
    });
  });

  describe('calculateAverageMemory', () => {
    it('calculates average RSS in MB', () => {
      const samples: MemoryMetrics[] = [
        {
          timestamp: Date.now(),
          heapUsed: 10 * 1024 * 1024,
          heapTotal: 20 * 1024 * 1024,
          rssMemory: 30 * 1024 * 1024,
        },
        {
          timestamp: Date.now(),
          heapUsed: 15 * 1024 * 1024,
          heapTotal: 25 * 1024 * 1024,
          rssMemory: 50 * 1024 * 1024,
        },
        {
          timestamp: Date.now(),
          heapUsed: 12 * 1024 * 1024,
          heapTotal: 22 * 1024 * 1024,
          rssMemory: 40 * 1024 * 1024,
        },
      ];

      const average = calculateAverageMemory(samples);

      expect(average).toBeCloseTo(40, 1); // (30 + 50 + 40) / 3 = 40
    });

    it('returns 0 for empty samples', () => {
      const average = calculateAverageMemory([]);

      expect(average).toBe(0);
    });
  });
});
