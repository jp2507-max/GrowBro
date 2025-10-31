/**
 * Shared utility functions for assessment analytics
 */

/**
 * Calculate p95 percentile
 */
export function calculateP95(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[index] ?? 0;
}
