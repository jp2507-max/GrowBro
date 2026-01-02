/**
 * Offline Queue Management
 * Tracks pending changes and manages offline operation queue
 */

import type { Collection, Database, Model } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import type { Subscription } from 'rxjs';
import { Observable } from 'rxjs';
import { mergeMap, shareReplay, startWith, throttleTime } from 'rxjs/operators';

import { generateDeduplicationKey, isDuplicate } from './conflict-resolver';

/**
 * Generate idempotency key for safe retries
 * Used to ensure duplicate operations don't create multiple records
 *
 * @param operationKey - Operation identifier (e.g., table_operation)
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
  const collections = Object.values(database.collections.map);

  // Stream collection change sets (created/updated/deleted)
  // experimentalSubscribe returns an unsubscribe function, not a subscription object
  const changes$ = new Observable<unknown>((subscriber) => {
    const unsubscribeFns = collections.map((collection) =>
      collection.experimentalSubscribe((changeSet) => {
        subscriber.next(changeSet);
      })
    );

    return () => {
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
    };
  });

  return changes$.pipe(
    throttleTime(throttleMs),
    startWith(null),
    mergeMap(() => getPendingFromCollections(collections)),
    shareReplay({ bufferSize: 1, refCount: true })
  );
}

async function getPendingFromCollections(
  collections: Collection<Model>[]
): Promise<number> {
  let pending = 0;

  for (const collection of collections) {
    // _dirtyRaw exposes local status in WatermelonDB models
    const dirty = await collection
      .query(Q.where('_status', Q.oneOf(['created', 'updated', 'deleted'])))
      .fetchCount();

    pending += dirty;
  }

  return pending;
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
  private pending$: Observable<number> | undefined;
  private pendingSubscription: Subscription | undefined;

  constructor(database: Database) {
    this.database = database;
    this.pendingCount = 0;
    this.pending$ = undefined;
    this.pendingSubscription = undefined;
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
    if (!this.pending$) {
      this.pending$ = observePendingChangesCount(this.database, throttleMs);
      // Keep a cached count for imperative reads
      this.pendingSubscription = this.pending$.subscribe((count) => {
        this.pendingCount = count;
      });
    }
    return this.pending$;
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
    // Filter at database level using indexed measured_at column
    const cutoffTime = Date.now() - 5000;
    const recentReadings = await collection
      .query(Q.where('measured_at', Q.gte(cutoffTime)))
      .fetch();

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

  /**
   * Dispose of the offline queue and clean up subscriptions
   * Call this when the OfflineQueue instance is no longer needed
   */
  dispose(): void {
    if (this.pendingSubscription) {
      this.pendingSubscription.unsubscribe();
      this.pendingSubscription = undefined;
    }
    this.pending$ = undefined;
    this.pendingCount = 0;
  }
}
