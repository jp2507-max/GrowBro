/**
 * Unit tests for memory leak detection utilities
 */

import {
  DEFAULT_MEMORY_BUDGET,
  exportMemoryLeakArtifact,
  formatMemoryLeakResult,
} from '../memory-leak-detector';
import type { MemoryLeakDetectionResult } from '../types';

describe('memory-leak-detector', () => {
  describe('DEFAULT_MEMORY_BUDGET', () => {
    it('has correct budget thresholds from requirements', () => {
      expect(DEFAULT_MEMORY_BUDGET.maxRSSDeltaMB).toBe(50);
      expect(DEFAULT_MEMORY_BUDGET.maxPostGCDeltaMB).toBe(10);
      expect(DEFAULT_MEMORY_BUDGET.testDurationSeconds).toBe(60);
    });
  });

  describe('formatMemoryLeakResult', () => {
    it('formats passing result correctly', () => {
      const result: MemoryLeakDetectionResult = {
        testName: 'Community Feed Scroll',
        duration: 60000,
        baseline: {
          timestamp: Date.now(),
          heapUsed: 10 * 1024 * 1024,
          heapTotal: 20 * 1024 * 1024,
          rssMemory: 30 * 1024 * 1024,
        },
        peak: {
          timestamp: Date.now(),
          heapUsed: 15 * 1024 * 1024,
          heapTotal: 25 * 1024 * 1024,
          rssMemory: 70 * 1024 * 1024,
        },
        postGC: {
          timestamp: Date.now(),
          heapUsed: 11 * 1024 * 1024,
          heapTotal: 21 * 1024 * 1024,
          rssMemory: 35 * 1024 * 1024,
        },
        rssDelta: 40,
        postGCDelta: 5,
        passed: true,
        violations: [],
      };

      const formatted = formatMemoryLeakResult(result);

      expect(formatted).toContain('✅ PASSED');
      expect(formatted).toContain('Community Feed Scroll');
      expect(formatted).toContain('60s');
      expect(formatted).toContain('40.00 MB');
      expect(formatted).toContain('5.00 MB');
    });

    it('formats failing result with violations', () => {
      const result: MemoryLeakDetectionResult = {
        testName: 'Memory Leak Test',
        duration: 60000,
        baseline: {
          timestamp: Date.now(),
          heapUsed: 10 * 1024 * 1024,
          heapTotal: 20 * 1024 * 1024,
          rssMemory: 30 * 1024 * 1024,
        },
        peak: {
          timestamp: Date.now(),
          heapUsed: 20 * 1024 * 1024,
          heapTotal: 30 * 1024 * 1024,
          rssMemory: 100 * 1024 * 1024,
        },
        postGC: {
          timestamp: Date.now(),
          heapUsed: 15 * 1024 * 1024,
          heapTotal: 25 * 1024 * 1024,
          rssMemory: 50 * 1024 * 1024,
        },
        rssDelta: 70,
        postGCDelta: 20,
        passed: false,
        violations: [
          'RSS delta 70.00MB exceeds budget 50MB',
          'Post-GC delta 20.00MB exceeds budget 10MB',
        ],
      };

      const formatted = formatMemoryLeakResult(result);

      expect(formatted).toContain('❌ FAILED');
      expect(formatted).toContain('Violations:');
      expect(formatted).toContain('RSS delta 70.00MB exceeds budget 50MB');
      expect(formatted).toContain('Post-GC delta 20.00MB exceeds budget 10MB');
    });
  });

  describe('exportMemoryLeakArtifact', () => {
    it('exports complete artifact with build metadata', () => {
      const result: MemoryLeakDetectionResult = {
        testName: 'Community Feed Scroll',
        duration: 60000,
        baseline: {
          timestamp: Date.now(),
          heapUsed: 10 * 1024 * 1024,
          heapTotal: 20 * 1024 * 1024,
          rssMemory: 30 * 1024 * 1024,
        },
        peak: {
          timestamp: Date.now(),
          heapUsed: 15 * 1024 * 1024,
          heapTotal: 25 * 1024 * 1024,
          rssMemory: 70 * 1024 * 1024,
        },
        postGC: {
          timestamp: Date.now(),
          heapUsed: 11 * 1024 * 1024,
          heapTotal: 21 * 1024 * 1024,
          rssMemory: 35 * 1024 * 1024,
        },
        rssDelta: 40,
        postGCDelta: 5,
        passed: true,
        violations: [],
      };

      const buildMetadata = {
        buildHash: 'abc123',
        device: 'Pixel 6a',
        platform: 'android',
      };

      const artifact = exportMemoryLeakArtifact(result, buildMetadata);

      expect(artifact.testName).toBe('Community Feed Scroll');
      expect(artifact.duration).toBe(60000);
      expect(artifact.passed).toBe(true);
      expect(artifact.violations).toEqual([]);
      expect(artifact).toHaveProperty('timestamp');
      expect(artifact).toHaveProperty('metrics');
      expect(artifact).toHaveProperty('build');
      expect(artifact.build).toEqual(buildMetadata);
    });

    it('includes all memory metrics in artifact', () => {
      const result: MemoryLeakDetectionResult = {
        testName: 'Test',
        duration: 60000,
        baseline: {
          timestamp: Date.now(),
          heapUsed: 10 * 1024 * 1024,
          heapTotal: 20 * 1024 * 1024,
          rssMemory: 30 * 1024 * 1024,
        },
        peak: {
          timestamp: Date.now(),
          heapUsed: 15 * 1024 * 1024,
          heapTotal: 25 * 1024 * 1024,
          rssMemory: 70 * 1024 * 1024,
        },
        postGC: {
          timestamp: Date.now(),
          heapUsed: 11 * 1024 * 1024,
          heapTotal: 21 * 1024 * 1024,
          rssMemory: 35 * 1024 * 1024,
        },
        rssDelta: 40,
        postGCDelta: 5,
        passed: true,
        violations: [],
      };

      const artifact = exportMemoryLeakArtifact(result, {});

      expect(artifact.metrics).toHaveProperty('baseline');
      expect(artifact.metrics).toHaveProperty('peak');
      expect(artifact.metrics).toHaveProperty('postGC');
      expect(artifact.metrics).toHaveProperty('deltas');
      // @ts-expect-error - accessing nested property
      expect(artifact.metrics.deltas.rssDeltaMB).toBe(40);
      // @ts-expect-error - accessing nested property
      expect(artifact.metrics.deltas.postGCDeltaMB).toBe(5);
    });
  });
});
