/**
 * Time Sync Validator
 *
 * Validates server timestamp usage and handles device clock skew
 * Requirement 19.4: Use server timestamps as authoritative for ordering and conflicts
 */

/**
 * Maximum acceptable clock skew in milliseconds (5 minutes)
 * Beyond this threshold, we warn about potential sync issues
 */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Minimum acceptable clock skew to ignore (10 seconds)
 * Small differences are expected due to network latency
 */
export const MIN_CLOCK_SKEW_MS = 10 * 1000;

export interface ClockSkewResult {
  skewMs: number;
  isSignificant: boolean;
  shouldWarn: boolean;
  message?: string;
}

/**
 * Calculate clock skew between client and server
 * Requirement 19.4
 *
 * @param clientTimestamp Client's current timestamp
 * @param serverTimestamp Server's timestamp from last sync
 * @returns Clock skew calculation result
 */
export function calculateClockSkew(
  clientTimestamp: Date,
  serverTimestamp: Date
): ClockSkewResult {
  const skewMs = Math.abs(
    clientTimestamp.getTime() - serverTimestamp.getTime()
  );

  const isSignificant = skewMs > MIN_CLOCK_SKEW_MS;
  const shouldWarn = skewMs > MAX_CLOCK_SKEW_MS;

  let message: string | undefined;

  if (shouldWarn) {
    const minutesDiff = Math.round(skewMs / (60 * 1000));
    message = `Device clock differs from server by ${minutesDiff} minutes. This may affect sync reliability.`;
  }

  return {
    skewMs,
    isSignificant,
    shouldWarn,
    message,
  };
}

/**
 * Validate timestamp is server-authoritative
 * Requirement 19.4
 *
 * Server timestamps must be used for:
 * - Conflict resolution (Last-Write-Wins)
 * - Stage ordering
 * - Duration calculations
 *
 * @param timestamp Timestamp to validate
 * @param source Source of the timestamp ('client' | 'server')
 * @returns Validation result
 */
export function validateTimestampSource(
  timestamp: Date | null | undefined,
  source: 'client' | 'server'
): {
  valid: boolean;
  warning?: string;
} {
  if (!timestamp) {
    return {
      valid: false,
      warning: 'Timestamp is null or undefined',
    };
  }

  // For critical operations, only server timestamps are valid
  if (source === 'client') {
    return {
      valid: true,
      warning:
        'Client timestamp used. Server timestamp should override on sync.',
    };
  }

  return { valid: true };
}

/**
 * Compare timestamps for Last-Write-Wins conflict resolution
 * Requirement 19.4
 *
 * Server timestamps are authoritative for determining which update wins
 *
 * @param timestamp1 First timestamp (server-authoritative)
 * @param timestamp2 Second timestamp (server-authoritative)
 * @returns -1 if timestamp1 is earlier, 0 if equal, 1 if timestamp1 is later
 */
export function compareServerTimestamps(
  timestamp1: Date,
  timestamp2: Date
): -1 | 0 | 1 {
  const t1 = timestamp1.getTime();
  const t2 = timestamp2.getTime();

  if (t1 < t2) return -1;
  if (t1 > t2) return 1;
  return 0;
}

/**
 * Get authoritative timestamp for sync operations
 * Requirement 19.4
 *
 * Prefers server timestamp if available, falls back to client with warning
 *
 * @param serverTimestamp Server timestamp (authoritative)
 * @param clientTimestamp Client fallback timestamp
 * @returns Timestamp to use and source indicator
 */
export function getAuthoritativeTimestamp(
  serverTimestamp: Date | null | undefined,
  clientTimestamp: Date
): {
  timestamp: Date;
  source: 'server' | 'client';
  shouldSync: boolean;
} {
  if (serverTimestamp) {
    return {
      timestamp: serverTimestamp,
      source: 'server',
      shouldSync: false,
    };
  }

  // Fallback to client timestamp but flag for sync
  return {
    timestamp: clientTimestamp,
    source: 'client',
    shouldSync: true, // Should sync to get server timestamp
  };
}

/**
 * Validate timestamp ordering for stage progression
 * Requirement 19.2, 19.4
 *
 * Ensures stage_started_at < stage_completed_at < next_stage_started_at
 *
 * @param timestamps Array of timestamp objects with labels
 * @returns Validation result
 */
export function validateTimestampOrdering(
  timestamps: { label: string; timestamp: Date }[]
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  for (let i = 0; i < timestamps.length - 1; i++) {
    const current = timestamps[i];
    const next = timestamps[i + 1];

    if (current.timestamp >= next.timestamp) {
      errors.push(
        `${current.label} (${current.timestamp.toISOString()}) must be before ${next.label} (${next.timestamp.toISOString()})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
