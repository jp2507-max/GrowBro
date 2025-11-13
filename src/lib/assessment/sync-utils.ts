/**
 * Sync utility helpers
 */
export function mergePartialUpdate<T extends Record<string, unknown>>(
  localData: T,
  serverUpdate: Partial<T> & Record<string, unknown>,
  preserveLocalFields: string[] = []
): T {
  const merged = { ...localData };

  for (const [key, value] of Object.entries(serverUpdate)) {
    // Skip fields that should be preserved locally
    if (preserveLocalFields.includes(key)) {
      continue;
    }

    // Apply server update
    if (key in merged) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}

/**
 * Check if data needs sync based on timestamps
 */
export function needsSync(
  localTimestamp: number,
  serverTimestamp: number,
  syncThresholdMs: number = 1000
): boolean {
  // If timestamps differ by more than threshold, sync is needed
  return Math.abs(localTimestamp - serverTimestamp) > syncThresholdMs;
}
