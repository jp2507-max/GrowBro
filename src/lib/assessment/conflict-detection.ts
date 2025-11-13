/**
 * Conflict detection utilities
 */
export function detectConflicts<T extends Record<string, unknown>>(
  localData: T,
  serverData: T
): string[] {
  const conflicts: string[] = [];
  const allKeys = new Set([
    ...Object.keys(localData),
    ...Object.keys(serverData),
  ]);

  for (const key of allKeys) {
    const localValue = localData[key];
    const serverValue = serverData[key];

    // Skip if values are equal
    if (isEqual(localValue, serverValue)) {
      continue;
    }

    // Skip timestamp fields (expected to differ)
    if (
      key.includes('timestamp') ||
      key.includes('_at') ||
      key === 'createdAt' ||
      key === 'updatedAt'
    ) {
      continue;
    }

    conflicts.push(key);
  }

  return conflicts;
}

/**
 * Deep equality check for values
 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => isEqual(item, b[index]));
    }

    if (Array.isArray(a) || Array.isArray(b)) {
      return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) => {
      const aObj = a as Record<string, unknown>;
      const bObj = b as Record<string, unknown>;
      return isEqual(aObj[key], bObj[key]);
    });
  }

  return false;
}
