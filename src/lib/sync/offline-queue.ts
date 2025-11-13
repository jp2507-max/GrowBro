/**
 * Offline Queue Management
 * Tracks pending changes and manages offline operation queue
 */

import type { Database, Model } from '@nozbe/watermelondb';
import { Observable } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

import { generateDeduplicationKey, isDuplicate } from './conflict-resolver';

/**
 * Generate idempotency key for safe retries
 * Used to ensure duplicate operations don't create multiple records
 *
 * @param table - Table name
 * @param operation - Operation type
 * @param id - Record ID
 * @param timestamp - Operation timestamp
 * @returns Idempotency key string
 */
export function generateIdempotencyKey(
  operationKey: string,
  id: string,
  timestamp: number
): string {
  return `${operationKey}_${id}_${timestamp}`;
}

/**
 * Get observable for pending changes count
 * Throttled to avoid excessive updates
 *
 * @param database - WatermelonDB database instance
 * @param throttleMs - Throttle interval in milliseconds
 * @returns Observable emitting pending changes count
 */
export function observePendingChangesCount(
  database: Database,
  throttleMs = 1000
): Observable<number> {
  // WatermelonDB doesn't expose pending changes directly
  // We'll track synced status via local storage or a custom counter
  // For now, return a mock observable that can be implemented later
  return new Observable<number>((subscriber) => {
    // TODO: Implement actual pending changes tracking
    // This could query _status='created'/'updated' records or use a custom counter
    subscriber.next(0);
    return () => {
      // Cleanup
    };
  }).pipe(throttleTime(throttleMs));
}

/**
 * Deduplicate ph_ec_readings before enqueueing
 * Checks for near-duplicates within ±1s tolerance
 *
 * @param newReading - New reading to check
 * @param existingReadings - Array of existing readings
 * @returns True if reading is unique (not a duplicate)
 */
export function isUniqueReading(
  newReading: {
    plant_id?: string;
    meter_id?: string;
    measured_at: number;
  },
  existingReadings: {
    plant_id?: string;
    meter_id?: string;
    measured_at: number;
  }[]
): boolean {
  return !existingReadings.some((existing) =>
    isDuplicate(newReading, existing)
  );
}

/**
 * Get deduplication key for server-side uniqueness check
 * Server should enforce UNIQUE index on this key pattern
 *
 * @param plantId - Plant ID (optional)
 * @param meterId - Meter ID (optional)
 * @param measuredAtMs - Measured timestamp in milliseconds
 * @returns Deduplication key
 */
export function getReadingDeduplicationKey(
  plantId: string | undefined,
  meterId: string | undefined,
  measuredAtMs: number
): string {
  return generateDeduplicationKey(plantId, meterId, measuredAtMs);
}

/**
 * OfflineQueue class for managing queued operations
 */
export class OfflineQueue {
  private database: Database;
  private pendingCount: number;

  constructor(database: Database) {
    this.database = database;
    this.pendingCount = 0;
  }

  /**
   * Get current pending changes count
   *
   * @returns Number of pending changes
   */
  getPendingCount(): number {
    return this.pendingCount;
  }

  /**
   * Observe pending changes count
   *
   * @param throttleMs - Throttle interval
   * @returns Observable of pending count
   */
  observePendingCount(throttleMs = 1000): Observable<number> {
    return observePendingChangesCount(this.database, throttleMs);
  }

  /**
   * Check if reading is duplicate before queueing
   *
   * @param reading - Reading to check
   * @param table - Table name (e.g., 'ph_ec_readings')
   * @returns Promise resolving to true if unique
   */
  async checkDuplicate(
    reading: {
      plant_id?: string;
      meter_id?: string;
      measured_at: number;
    },
    table: string
  ): Promise<boolean> {
    // Query recent readings from database
    const collection = this.database.get(table);

    // Get readings from last 5 seconds (±1s tolerance + buffer)
    const recentReadings = await collection.query().fetch();
    // Note: Add proper query filtering when implementing with actual WatermelonDB models

    const existingReadings = recentReadings
      .map((record: Model) => {
        const raw = record as unknown as Record<string, unknown>;
        return {
          plant_id: raw.plantId as string | undefined,
          meter_id: raw.meterId as string | undefined,
          measured_at: raw.measuredAt as number | undefined,
        };
      })
      .filter(
        (r): r is typeof r & { measured_at: number } =>
          typeof r.measured_at === 'number'
      );

    return isUniqueReading(reading, existingReadings);
  }

  /**
   * Increment pending count (when operation queued)
   */
  incrementPending(): void {
    this.pendingCount++;
  }

  /**
   * Decrement pending count (when operation synced)
   */
  decrementPending(): void {
    this.pendingCount = Math.max(0, this.pendingCount - 1);
  }

  /**
   * Reset pending count
   */
  resetPending(): void {
    this.pendingCount = 0;
  }
}
