/**
 * Sync utility helpers
 */
export function mergePartialUpdate<T extends Record<string, any>>(
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
    (merged as any)[key] = value as any;
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
