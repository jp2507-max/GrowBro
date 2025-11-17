/**
 * Performance tests for authentication system
 *
 * Tests critical performance metrics:
 * - Token refresh performance
 * - Session validation performance
 * - Lockout check performance
 * - Analytics event batching
 *
 * Requirements: 5.3, 5.4, 7.1, 7.4
 *
 * These tests hit real Supabase and MMKV services and are disabled by default.
 * To run them, set RUN_PERFORMANCE_TESTS=true in your environment:
 *   RUN_PERFORMANCE_TESTS=true pnpm test src/lib/auth/__tests__/performance.test.ts
 */

import { supabase } from '@/lib/supabase';

import { mmkvAuthStorage } from '../auth-storage';
import { sanitizeAuthPII, trackAuthEvent } from '../auth-telemetry';
import { runPerformanceBenchmark } from '../performance-benchmark';

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  TOKEN_REFRESH: 2000, // 2 seconds max
  SESSION_VALIDATION: 1000, // 1 second max
  LOCKOUT_CHECK: 500, // 500ms max
  PII_SANITIZATION: 100, // 100ms max
  STORAGE_READ: 50, // 50ms max
  STORAGE_WRITE: 50, // 50ms max
  ANALYTICS_BATCH: 200, // 200ms max for batching
};

/**
 * Measure execution time of an async function
 */
async function measurePerformance<T>(
  fn: () => Promise<T>,
  label: string
): Promise<{ result: T; duration: number }> {
  const start = global.performance.now();
  const result = await fn();
  const duration = global.performance.now() - start;

  console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);

  return { result, duration };
}

// Only run performance tests when explicitly enabled to avoid hitting real services
const shouldRunPerformanceTests = process.env.RUN_PERFORMANCE_TESTS === 'true';

if (shouldRunPerformanceTests) {
  // Display performance thresholds before running tests
  runPerformanceBenchmark();

  describe('Authentication Performance Tests', () => {
    describe('Token Refresh Performance', () => {
      it('should refresh token within performance threshold', async () => {
        // Skip if no active session
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          console.log('Skipping token refresh test - no active session');
          return;
        }

        const { duration } = await measurePerformance(async () => {
          const { data, error } = await supabase.auth.refreshSession();
          expect(error).toBeNull();
          return data;
        }, 'Token Refresh');

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.TOKEN_REFRESH);
      }, 10000); // 10 second timeout

      it('should handle concurrent token refresh requests efficiently', async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          console.log('Skipping concurrent refresh test - no active session');
          return;
        }

        const { duration } = await measurePerformance(async () => {
          // Simulate multiple concurrent refresh attempts
          const promises = Array.from({ length: 5 }, () =>
            supabase.auth.refreshSession()
          );
          const results = await Promise.all(promises);

          // All should succeed (Supabase handles deduplication)
          results.forEach((result) => {
            expect(result.error).toBeNull();
          });

          return results;
        }, 'Concurrent Token Refresh (5x)');

        // Should not be 5x slower due to deduplication
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.TOKEN_REFRESH * 2);
      }, 15000);
    });

    describe('Session Validation Performance', () => {
      it('should validate session within performance threshold', async () => {
        const { duration } = await measurePerformance(async () => {
          const { data, error } = await supabase.auth.getSession();
          expect(error).toBeNull();
          return data;
        }, 'Session Validation');

        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.SESSION_VALIDATION
        );
      });

      it('should use cached session for repeated validations', async () => {
        // First call (may hit network)
        await supabase.auth.getSession();

        // Second call (should use cache)
        const { duration } = await measurePerformance(async () => {
          const { data } = await supabase.auth.getSession();
          return data;
        }, 'Cached Session Validation');

        // Cached validation should be very fast
        expect(duration).toBeLessThan(100); // 100ms max for cached
      });
    });

    describe('Storage Performance', () => {
      it('should read from MMKV storage within threshold', async () => {
        const testKey = 'performance-test-key';
        const testValue = 'test-value';

        // Write test data
        await mmkvAuthStorage.setItem(testKey, testValue);

        const { duration, result } = await measurePerformance(async () => {
          return await mmkvAuthStorage.getItem(testKey);
        }, 'MMKV Storage Read');

        expect(result).toBe(testValue);
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.STORAGE_READ);

        // Cleanup
        await mmkvAuthStorage.removeItem(testKey);
      });

      it('should write to MMKV storage within threshold', async () => {
        const testKey = 'performance-test-write';
        const testValue = JSON.stringify({
          access_token: 'test-token',
          refresh_token: 'test-refresh',
          expires_at: Date.now() + 3600000,
        });

        const { duration } = await measurePerformance(async () => {
          await mmkvAuthStorage.setItem(testKey, testValue);
        }, 'MMKV Storage Write');

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.STORAGE_WRITE);

        // Cleanup
        await mmkvAuthStorage.removeItem(testKey);
      });

      it('should handle large session data efficiently', async () => {
        const testKey = 'performance-test-large';
        // Simulate large session with metadata
        const largeValue = JSON.stringify({
          access_token: 'x'.repeat(1000),
          refresh_token: 'y'.repeat(1000),
          user: {
            id: 'test-user',
            email: 'test@example.com',
            user_metadata: {
              // Large metadata object
              data: Array.from({ length: 100 }, (_, i) => ({
                key: `field_${i}`,
                value: `value_${i}`,
              })),
            },
          },
        });

        const { duration } = await measurePerformance(async () => {
          await mmkvAuthStorage.setItem(testKey, largeValue);
          await mmkvAuthStorage.getItem(testKey);
        }, 'MMKV Large Data Write+Read');

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.STORAGE_WRITE * 2);

        // Cleanup
        await mmkvAuthStorage.removeItem(testKey);
      });
    });

    describe('PII Sanitization Performance', () => {
      it('should sanitize PII within performance threshold', async () => {
        const testData = {
          email: 'test@example.com',
          ip_address: '192.168.1.100',
          device_id: 'device-12345',
          user_id: 'user-67890',
          password: 'secret123',
          name: 'Test User',
        };

        const { duration, result } = await measurePerformance(async () => {
          return await sanitizeAuthPII(testData);
        }, 'PII Sanitization');

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PII_SANITIZATION);
        expect(result.email).not.toBe(testData.email); // Should be hashed
        expect(result.password).toBe('[REDACTED]');
        expect(result.device_id).toBeUndefined();
      });

      it('should handle bulk PII sanitization efficiently', async () => {
        const testDataArray = Array.from({ length: 10 }, (_, i) => ({
          email: `test${i}@example.com`,
          ip_address: `192.168.1.${i}`,
          device_id: `device-${i}`,
          password: `secret${i}`,
        }));

        const { duration } = await measurePerformance(async () => {
          return await Promise.all(testDataArray.map(sanitizeAuthPII));
        }, 'Bulk PII Sanitization (10x)');

        // Should scale linearly
        expect(duration).toBeLessThan(
          PERFORMANCE_THRESHOLDS.PII_SANITIZATION * 10
        );
      });
    });

    describe('Analytics Event Batching Performance', () => {
      it('should batch analytics events efficiently', async () => {
        const events = Array.from({ length: 10 }, (_, i) => ({
          event: 'auth_sign_in' as const,
          properties: {
            email: `test${i}@example.com`,
            user_id: `user-${i}`,
            method: 'email' as const,
            timestamp: new Date().toISOString(),
          },
        }));

        const { duration } = await measurePerformance(async () => {
          // Track multiple events
          await Promise.all(
            events.map((e) => trackAuthEvent(e.event, e.properties))
          );
        }, 'Analytics Event Batching (10x)');

        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.ANALYTICS_BATCH);
      });
    });

    describe('Memory Usage', () => {
      it('should not leak memory during repeated operations', async () => {
        const iterations = 100;
        const testKey = 'memory-test-key';

        // Measure memory before
        if (global.gc) {
          global.gc();
        }
        const memoryBefore = process.memoryUsage().heapUsed;

        // Perform repeated operations
        for (let i = 0; i < iterations; i++) {
          await mmkvAuthStorage.setItem(testKey, `value-${i}`);
          await mmkvAuthStorage.getItem(testKey);
          await sanitizeAuthPII({
            email: `test${i}@example.com`,
            ip_address: `192.168.1.${i}`,
          });
        }

        // Cleanup
        await mmkvAuthStorage.removeItem(testKey);

        // Measure memory after
        if (global.gc) {
          global.gc();
        }
        const memoryAfter = process.memoryUsage().heapUsed;

        const memoryIncrease = (memoryAfter - memoryBefore) / 1024 / 1024; // MB
        console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);

        // Should not increase by more than 10MB for 100 iterations
        expect(memoryIncrease).toBeLessThan(10);
      });
    });
  });
}
