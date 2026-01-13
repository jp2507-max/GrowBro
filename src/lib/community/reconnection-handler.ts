/**
 * Reconnection Handler
 *
 * Manages network reconnection logic for community feed:
 * - Listens to NetInfo for online state changes
 * - Drains outbox queue on reconnect
 * - Triggers feed refetch after outbox is empty
 * - Minimizes UI flicker from stale → fresh data
 */

import { type Database } from '@nozbe/watermelondb';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { type QueryClient } from '@tanstack/react-query';

import type { OutboxProcessor } from './outbox-processor';
import { getOutboxProcessor } from './outbox-processor';
import {
  isCommunityPostsInfiniteKey,
  isCommunityUserPostsKey,
} from './query-keys';

export interface ReconnectionHandlerOptions {
  database: Database;
  queryClient: QueryClient;
  onReconnect?: () => void;
  onOutboxDrained?: () => void;
}

export class ReconnectionHandler {
  private database: Database;
  private queryClient: QueryClient;
  private outboxProcessor: OutboxProcessor;
  private onReconnectCallback?: () => void;
  private onOutboxDrainedCallback?: () => void;
  private unsubscribe?: () => void;
  private isReconnecting = false;
  private lastOnline: boolean | null = null;

  constructor(options: ReconnectionHandlerOptions) {
    this.database = options.database;
    this.queryClient = options.queryClient;
    this.outboxProcessor = getOutboxProcessor(options.database);
    this.onReconnectCallback = options.onReconnect;
    this.onOutboxDrainedCallback = options.onOutboxDrained;
  }

  /**
   * Start listening to network state changes
   */
  start(): void {
    if (this.unsubscribe) {
      return;
    }
    this.unsubscribe = NetInfo.addEventListener(this.handleNetworkChange);
    console.log('[ReconnectionHandler] Started listening to network changes');
  }

  /**
   * Stop listening to network state changes
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
      console.log('[ReconnectionHandler] Stopped listening');
    }
  }

  /**
   * Invalidate all community-related queries
   */
  private async invalidateCommunityQueries(): Promise<void> {
    await this.queryClient.invalidateQueries({
      predicate: (query) => isCommunityPostsInfiniteKey(query.queryKey),
    });
    await this.queryClient.invalidateQueries({
      predicate: (query) => isCommunityUserPostsKey(query.queryKey),
    });
    await this.queryClient.invalidateQueries({
      queryKey: ['community-comments'],
    });
    await this.queryClient.invalidateQueries({
      queryKey: ['community-post'],
    });
  }

  /**
   * Handle network state change
   */
  private handleNetworkChange = async (state: NetInfoState): Promise<void> => {
    const isOnline =
      Boolean(state?.isConnected) && (state.isInternetReachable ?? true);

    // NetInfo can emit repeated updates while already online (detail changes).
    // Only run reconnection work on an offline → online transition (or first known state).
    if (!isOnline) {
      if (this.lastOnline !== false) {
        console.log('[ReconnectionHandler] Network offline');
      }
      this.lastOnline = false;
      return;
    }

    const shouldHandle = this.lastOnline === null || this.lastOnline === false;
    this.lastOnline = true;

    if (!shouldHandle) {
      return;
    }

    console.log('[ReconnectionHandler] Network online, processing outbox...');

    // Prevent concurrent reconnection attempts
    if (this.isReconnecting) {
      console.log('[ReconnectionHandler] Already reconnecting, skipping...');
      return;
    }

    this.isReconnecting = true;

    try {
      // Notify listeners
      this.onReconnectCallback?.();

      // Process outbox queue
      await this.outboxProcessor.processQueue();

      // Wait a bit for any in-flight operations to complete
      await this.waitForOutboxEmpty(30000); // 30s timeout

      // Notify outbox drained
      this.onOutboxDrainedCallback?.();

      // Invalidate queries to trigger refetch
      await this.invalidateCommunityQueries();

      console.log(
        '[ReconnectionHandler] Outbox drained and queries invalidated'
      );
    } catch (error) {
      console.error('[ReconnectionHandler] Error during reconnection:', error);

      // Notify listeners of failure
      this.onReconnectCallback?.();

      // On error, still try to invalidate queries to show fresh data
      // even if outbox processing failed
      try {
        await this.invalidateCommunityQueries();
      } catch (invalidateError) {
        console.error(
          '[ReconnectionHandler] Failed to invalidate queries:',
          invalidateError
        );
      }
    } finally {
      this.isReconnecting = false;
    }
  };

  /**
   * Wait for outbox to be empty (no pending entries)
   */
  private async waitForOutboxEmpty(timeoutMs: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.outboxProcessor.getStatus();

      if (status.pending === 0) {
        console.log('[ReconnectionHandler] Outbox is empty');
        return;
      }

      // Wait 500ms before checking again
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.warn('[ReconnectionHandler] Timeout waiting for outbox to empty');
  }

  /**
   * Manually trigger reconnection logic (for testing/debugging)
   */
  async triggerReconnect(): Promise<void> {
    await this.handleNetworkChange({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: null,
    });
  }
}

// Singleton instance
let reconnectionHandlerInstance: ReconnectionHandler | null = null;
let instanceDatabase: Database | null = null;
let instanceQueryClient: QueryClient | null = null;

/**
 * Get or create the singleton ReconnectionHandler instance
 *
 * NOTE: This singleton is tied to specific database and queryClient instances.
 * Calling with different instances after initialization will throw an error
 * to prevent inconsistent state.
 */
export function getReconnectionHandler(
  database: Database,
  queryClient: QueryClient
): ReconnectionHandler {
  if (!reconnectionHandlerInstance) {
    reconnectionHandlerInstance = new ReconnectionHandler({
      database,
      queryClient,
    });
    instanceDatabase = database;
    instanceQueryClient = queryClient;
  } else {
    // Validate that the same instances are being used
    if (instanceDatabase !== database || instanceQueryClient !== queryClient) {
      console.warn(
        '[ReconnectionHandler] Singleton called with different database/queryClient instances. ' +
          'Using existing instance. This may indicate an architectural issue.'
      );
    }
  }
  return reconnectionHandlerInstance;
}

/**
 * Reset the singleton instance (for testing or cleanup)
 */
export function resetReconnectionHandler(): void {
  if (reconnectionHandlerInstance) {
    reconnectionHandlerInstance.stop();
    reconnectionHandlerInstance = null;
    instanceDatabase = null;
    instanceQueryClient = null;
  }
}
