/**
 * Sync Worker
 * Handles background synchronization with retry logic and exponential backoff
 * Wraps WatermelonDB synchronize() with robust error handling
 */

import type { Database } from '@nozbe/watermelondb';
import { synchronize } from '@nozbe/watermelondb/sync';

import { ConsentService } from '@/lib/privacy/consent-service';
import { ConsentRequiredError } from '@/lib/privacy/errors';

import { resolveConflict } from './conflict-resolver';
import { retryWithBackoff } from './exponential-backoff';
import type {
  SyncConfig,
  SyncEventCallbacks,
  SyncPullResponse,
  SyncPushPayload,
  SyncState,
  SyncStatus,
  TableName,
} from './types';

/**
 * Default sync configuration
 */
const DEFAULT_CONFIG: SyncConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  enableLogging: __DEV__,
};

/**
 * SyncWorker class for managing database synchronization
 */
export class SyncWorker {
  private database: Database;
  private config: SyncConfig;
  private callbacks: SyncEventCallbacks;
  private currentState: SyncState;
  private lastSyncAt?: number;
  private lastError?: Error;
  private retryAttempt: number;

  constructor(
    database: Database,
    config: Partial<SyncConfig> = {},
    callbacks: SyncEventCallbacks = {}
  ) {
    this.database = database;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.currentState = 'idle';
    this.retryAttempt = 0;
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncStatus {
    return {
      state: this.currentState,
      lastSyncAt: this.lastSyncAt,
      lastError: this.lastError?.message,
      pendingChanges: 0, // TODO: Implement pending changes counter
      retryAttempt: this.retryAttempt,
    };
  }

  /**
   * Execute synchronization with retry logic
   *
   * @param endpoints - Pull and push endpoint functions
   * @param lastPulledAt - Last successful pull timestamp (server-provided)
   * @param migrationsEnabledAtVersion - Schema version for migration sync
   * @returns Promise resolving when sync completes
   */
  async synchronize(
    endpoints: {
      pullEndpoint: (lastPulledAt: number | null) => Promise<SyncPullResponse>;
      pushEndpoint: (payload: SyncPushPayload) => Promise<void>;
    },
    lastPulledAt: number | null = null,
    migrationsEnabledAtVersion?: number
  ): Promise<void> {
    await this.assertCloudProcessingConsent();
    this.currentState = 'syncing';
    this.callbacks.onSyncStart?.();

    try {
      await this.performSync(
        endpoints,
        lastPulledAt,
        migrationsEnabledAtVersion
      );

      // Success
      this.handleSyncSuccess();
    } catch (error) {
      // All retries exhausted
      this.handleSyncError(error as Error);
      throw error;
    }
  }

  private async assertCloudProcessingConsent(): Promise<void> {
    const consents = await ConsentService.getConsents();
    if (consents.cloudProcessing) return;
    const error = new ConsentRequiredError(
      'Cloud sync requires cloudProcessing consent',
      'cloudProcessing'
    );
    this.currentState = 'error';
    this.lastError = error;
    this.callbacks.onSyncError?.(error);
    throw error;
  }

  private async performSync(
    endpoints: {
      pullEndpoint: (lastPulledAt: number | null) => Promise<SyncPullResponse>;
      pushEndpoint: (payload: SyncPushPayload) => Promise<void>;
    },
    lastPulledAt: number | null,
    migrationsEnabledAtVersion?: number
  ): Promise<void> {
    await retryWithBackoff(
      async () => {
        await synchronize({
          database: this.database,
          pullChanges: this.createPullChanges(
            endpoints.pullEndpoint,
            lastPulledAt
          ),
          pushChanges: this.createPushChanges(endpoints.pushEndpoint),
          migrationsEnabledAtVersion,
          conflictResolver: this.createConflictResolver(),
        });
      },
      {
        maxRetries: this.config.maxRetries,
        baseDelayMs: this.config.baseDelayMs,
        maxDelayMs: this.config.maxDelayMs,
      },
      (attempt, error) => {
        this.retryAttempt = attempt;
        if (this.config.enableLogging) {
          console.warn(
            `[SyncWorker] Retry attempt ${attempt + 1}/${this.config.maxRetries}:`,
            error.message
          );
        }
      }
    );
  }

  private createPullChanges(
    pullEndpoint: (lastPulledAt: number | null) => Promise<SyncPullResponse>,
    lastPulledAt: number | null
  ) {
    return async (_args: {
      lastPulledAt?: number;
      schemaVersion: number;
      migration: unknown;
    }) => {
      const timestamp = lastPulledAt ?? _args.lastPulledAt ?? null;

      if (this.config.enableLogging) {
        console.log('[SyncWorker] Pulling changes since:', timestamp);
      }

      const response = await pullEndpoint(timestamp);

      if (this.config.enableLogging) {
        console.log(
          '[SyncWorker] Pulled changes:',
          Object.keys(response.changes).length,
          'tables'
        );
      }

      return {
        changes: response.changes,
        timestamp: response.serverTimestamp,
      };
    };
  }

  private createPushChanges(
    pushEndpoint: (payload: SyncPushPayload) => Promise<void>
  ) {
    return async ({
      changes,
      lastPulledAt: syncLastPulledAt,
    }: {
      changes: SyncPushPayload['changes'];
      lastPulledAt: number | null;
    }) => {
      if (this.config.enableLogging) {
        console.log('[SyncWorker] Pushing changes:', changes);
      }

      await pushEndpoint({
        changes,
        lastPulledAt: syncLastPulledAt ?? 0,
      });

      if (this.config.enableLogging) {
        console.log('[SyncWorker] Push complete');
      }
    };
  }

  private createConflictResolver() {
    return (
      tableSchema: { name: string },
      local: Record<string, unknown>,
      remote: Record<string, unknown>
    ) => {
      const resolution = resolveConflict(
        { ...local, id: String(local.id || '') },
        { ...remote, id: String(remote.id || '') },
        tableSchema.name as TableName | undefined
      );

      if (this.config.enableLogging) {
        console.log(
          `[SyncWorker] Conflict in ${tableSchema.name}:`,
          resolution.reason
        );
      }

      // Handle needs-review conflicts by defaulting to remote for now
      // TODO: Implement proper needs-review handling (e.g., store conflict for manual resolution)
      if (resolution.winner === 'needs-review') {
        console.warn(
          `[SyncWorker] Conflict in ${tableSchema.name} requires manual review, defaulting to remote`
        );
        return remote;
      }

      return resolution.winner === 'remote' ? remote : local;
    };
  }

  private handleSyncSuccess(): void {
    this.currentState = 'idle';
    this.lastSyncAt = Date.now();
    this.lastError = undefined;
    this.retryAttempt = 0;
    this.callbacks.onSyncSuccess?.();

    if (this.config.enableLogging) {
      console.log('[SyncWorker] Sync complete');
    }
  }

  private handleSyncError(error: Error): void {
    this.currentState = 'error';
    this.lastError = error;
    this.callbacks.onSyncError?.(error);

    if (this.config.enableLogging) {
      console.error('[SyncWorker] Sync failed after retries:', error);
    }
  }

  /**
   * Set sync state to offline
   */
  setOffline(): void {
    this.currentState = 'offline';
  }

  /**
   * Set sync state to idle (online)
   */
  setOnline(): void {
    if (this.currentState === 'offline') {
      this.currentState = 'idle';
    }
  }

  /**
   * Register event callbacks
   */
  on(event: 'start', callback: () => void): void;
  on(event: 'success', callback: () => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  on(
    event: 'start' | 'success' | 'error',
    callback: ((error: Error) => void) | (() => void)
  ): void {
    switch (event) {
      case 'start':
        this.callbacks.onSyncStart = callback as () => void;
        break;
      case 'success':
        this.callbacks.onSyncSuccess = callback as () => void;
        break;
      case 'error':
        this.callbacks.onSyncError = callback as (error: Error) => void;
        break;
    }
  }
}
