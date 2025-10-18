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
   * Handle network state change
   */
  private handleNetworkChange = async (state: NetInfoState): Promise<void> => {
    if (!state) {
      console.log('[ReconnectionHandler] Network offline');
      return;
    }

    if (state.isConnected === false || state.isInternetReachable === false) {
      console.log('[ReconnectionHandler] Network offline');
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
      await this.queryClient.invalidateQueries({ queryKey: ['posts'] });
      await this.queryClient.invalidateQueries({ queryKey: ['post-comments'] });
      await this.queryClient.invalidateQueries({ queryKey: ['post-likes'] });

      console.log(
        '[ReconnectionHandler] Outbox drained and queries invalidated'
      );
    } catch (error) {
      console.error('[ReconnectionHandler] Error during reconnection:', error);
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

/**
 * Get or create the singleton ReconnectionHandler instance
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
  }
  return reconnectionHandlerInstance;
}
