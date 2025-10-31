/**
 * Performance thresholds (in milliseconds)
 */
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
 * Performance benchmark utility
 * Run with: RUN_PERFORMANCE_TESTS=true pnpm test performance.test.ts --verbose
 */
export function runPerformanceBenchmark() {
  console.log('\n=== Authentication Performance Benchmark ===\n');
  console.log('Thresholds:');
  Object.entries(PERFORMANCE_THRESHOLDS).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}ms`);
  });
  console.log('\nRun tests to see actual performance metrics.\n');
}
