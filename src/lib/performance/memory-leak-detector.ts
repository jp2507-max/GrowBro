/**
 * Memory leak detection utilities for performance testing
 * Validates memory budgets during 60-second scroll tests
 */

import {
  calculateMemoryDeltaMB,
  findPeakMemory,
  forceGarbageCollection,
  getMemoryMetrics,
  sampleMemoryDuringTest,
  wait,
} from './memory-monitor';
import type { MemoryBudget, MemoryLeakDetectionResult } from './types';

/**
 * Default memory budget thresholds from requirements
 * Requirement 5.4: ≤50MB RSS increase, ≤10MB post-GC
 */
export const DEFAULT_MEMORY_BUDGET: MemoryBudget = {
  maxRSSDeltaMB: 50,
  maxPostGCDeltaMB: 10,
  testDurationSeconds: 60,
};

/**
 * Run memory leak detection test during scroll scenario
 * Returns detailed results with baseline, peak, and post-GC measurements
 */
export async function detectMemoryLeaks(
  testName: string,
  testDurationMs: number = 60000,
  budget: MemoryBudget = DEFAULT_MEMORY_BUDGET
): Promise<MemoryLeakDetectionResult> {
  // Capture baseline before test
  const baseline = getMemoryMetrics();
  console.log(`[MemoryLeakDetector] Baseline: ${JSON.stringify(baseline)}`);

  // Sample memory during test (every 5 seconds)
  const samples = await sampleMemoryDuringTest(testDurationMs, 5000);

  // Find peak memory usage
  const peak = findPeakMemory(samples);
  console.log(`[MemoryLeakDetector] Peak: ${JSON.stringify(peak)}`);

  // Force GC and wait for it to complete
  forceGarbageCollection();
  await wait(2000); // Wait 2s for GC to complete

  // Capture post-GC metrics
  const postGC = getMemoryMetrics();
  console.log(`[MemoryLeakDetector] Post-GC: ${JSON.stringify(postGC)}`);

  // Calculate deltas
  const rssDelta = calculateMemoryDeltaMB(baseline, peak);
  const postGCDelta = calculateMemoryDeltaMB(baseline, postGC);

  // Validate against budget
  const violations: string[] = [];
  let passed = true;

  if (rssDelta > budget.maxRSSDeltaMB) {
    violations.push(
      `RSS delta ${rssDelta.toFixed(2)}MB exceeds budget ${budget.maxRSSDeltaMB}MB`
    );
    passed = false;
  }

  if (postGCDelta > budget.maxPostGCDeltaMB) {
    violations.push(
      `Post-GC delta ${postGCDelta.toFixed(2)}MB exceeds budget ${budget.maxPostGCDeltaMB}MB`
    );
    passed = false;
  }

  return {
    testName,
    duration: testDurationMs,
    baseline,
    peak,
    postGC,
    rssDelta,
    postGCDelta,
    passed,
    violations,
  };
}

/**
 * Format memory leak detection result for reporting
 */
export function formatMemoryLeakResult(
  result: MemoryLeakDetectionResult
): string {
  const status = result.passed ? '✅ PASSED' : '❌ FAILED';
  const lines = [
    `Memory Leak Detection: ${status}`,
    `Test: ${result.testName}`,
    `Duration: ${result.duration / 1000}s`,
    ``,
    `Baseline RSS: ${(result.baseline.rssMemory / (1024 * 1024)).toFixed(2)} MB`,
    `Peak RSS: ${(result.peak.rssMemory / (1024 * 1024)).toFixed(2)} MB`,
    `Post-GC RSS: ${(result.postGC.rssMemory / (1024 * 1024)).toFixed(2)} MB`,
    ``,
    `RSS Delta: ${result.rssDelta.toFixed(2)} MB`,
    `Post-GC Delta: ${result.postGCDelta.toFixed(2)} MB`,
  ];

  if (result.violations.length > 0) {
    lines.push('', 'Violations:');
    result.violations.forEach((v) => lines.push(`  - ${v}`));
  }

  return lines.join('\n');
}

/**
 * Export memory leak result as JSON artifact for CI
 */
export function exportMemoryLeakArtifact(
  result: MemoryLeakDetectionResult,
  buildMetadata: Record<string, unknown>
): Record<string, unknown> {
  return {
    testName: result.testName,
    timestamp: Date.now(),
    duration: result.duration,
    passed: result.passed,
    violations: result.violations,
    metrics: {
      baseline: {
        heapUsed: result.baseline.heapUsed,
        heapTotal: result.baseline.heapTotal,
        rssMemory: result.baseline.rssMemory,
      },
      peak: {
        heapUsed: result.peak.heapUsed,
        heapTotal: result.peak.heapTotal,
        rssMemory: result.peak.rssMemory,
      },
      postGC: {
        heapUsed: result.postGC.heapUsed,
        heapTotal: result.postGC.heapTotal,
        rssMemory: result.postGC.rssMemory,
      },
      deltas: {
        rssDeltaMB: result.rssDelta,
        postGCDeltaMB: result.postGCDelta,
      },
    },
    build: buildMetadata,
  };
}
