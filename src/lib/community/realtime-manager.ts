import type { RealtimeChannel } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';

import { supabase } from '@/lib/supabase';
import type {
  Post,
  PostComment,
  PostLike,
  RealtimeEvent,
} from '@/types/community';

import { communityMetrics } from './metrics-tracker';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

type SupabaseRealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  commit_timestamp?: string;
};

type RealtimeCallbacks = {
  onPostChange?: (event: RealtimeEvent<Post>) => void | Promise<void>;
  onCommentChange?: (event: RealtimeEvent<PostComment>) => void | Promise<void>;
  onLikeChange?: (event: RealtimeEvent<PostLike>) => void | Promise<void>;
  onConnectionStateChange?: (state: ConnectionState) => void;
  /**
   * Called every 30s when polling fallback is active (after max reconnect attempts).
   * **Consumer must implement data refetching** (e.g., invalidate React Query).
   */
  onPollRefresh?: () => void;
};

/**
 * Manages real-time subscriptions for community feed with auto-reconnect,
 * exponential backoff, and fallback to polling.
 *
 * Requirements: 3.1, 3.2, 3.7
 */
export class RealtimeConnectionManager {
  private channel: RealtimeChannel | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private callbacks: RealtimeCallbacks = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private isPolling = false;
  private postIdFilter?: string;
  private isActive = false;
  private appStateSubscription: ReturnType<
    typeof AppState.addEventListener
  > | null = null;
  private wasConnectedBeforeBackground = false;
  private isSubscribing = false;

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max)
  private getBackoffDelay(): number {
    const baseDelay = 1000;
    const maxDelay = 32000;
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts),
      maxDelay
    );
    return delay;
  }

  /**
   * Handle app state changes - disconnect when backgrounded, reconnect when foregrounded
   * This prevents stale connections and reduces battery drain on mobile
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (!this.isActive) return;

    if (nextAppState === 'active') {
      // App came to foreground - reconnect if we were connected before
      if (this.wasConnectedBeforeBackground) {
        console.log('[Realtime] App foregrounded, reconnecting...');
        this.reconnectAttempts = 0; // Reset attempts for fresh start
        this.connect();
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background - disconnect to save resources
      this.wasConnectedBeforeBackground =
        this.connectionState === 'connected' ||
        this.connectionState === 'connecting';
      if (this.wasConnectedBeforeBackground) {
        console.log('[Realtime] App backgrounded, disconnecting...');
        this.cleanup();
        this.stopPolling();
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.setConnectionState('disconnected');
      }
    }
  };

  /**
   * Update connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;
    this.connectionState = state;
    this.callbacks.onConnectionStateChange?.(state);
  }

  /**
   * Subscribe to community feed real-time updates
   * @param postId Optional post ID to filter comments subscription
   */
  subscribe(callbacks: RealtimeCallbacks, postId?: string): void {
    if (this.isSubscribing) {
      console.warn('Subscription already in progress');
      return;
    }

    this.isSubscribing = true;
    try {
      // If already connected or connecting, clean up channel without resetting isActive
      // to avoid race condition in handleSubscriptionStatus
      if (
        this.connectionState === 'connected' ||
        this.connectionState === 'connecting'
      ) {
        this.cleanup();
        this.stopPolling();
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      }

      this.callbacks = callbacks;
      this.postIdFilter = postId;
      this.isActive = true;

      // Set up AppState listener for background/foreground handling
      if (!this.appStateSubscription) {
        this.appStateSubscription = AppState.addEventListener(
          'change',
          this.handleAppStateChange
        );
      }

      this.connect();
    } finally {
      this.isSubscribing = false;
    }
  }

  /**
   * Set up postgres_changes subscriptions on the channel
   */
  private setupSubscriptions(): void {
    if (!this.channel) return;

    // Subscribe to posts table with optional post filter
    const postConfig: {
      event: '*';
      schema: 'public';
      table: 'posts';
      filter?: string;
    } = {
      event: '*',
      schema: 'public',
      table: 'posts',
    };

    if (this.postIdFilter) {
      postConfig.filter = `id=eq.${this.postIdFilter}`;
    }

    this.channel.on('postgres_changes', postConfig, (payload) => {
      this.handlePostChange(payload);
    });

    // Subscribe to comments table with optional post filter
    const commentConfig: {
      event: '*';
      schema: 'public';
      table: 'post_comments';
      filter?: string;
    } = {
      event: '*',
      schema: 'public',
      table: 'post_comments',
    };

    if (this.postIdFilter) {
      commentConfig.filter = `post_id=eq.${this.postIdFilter}`;
    }

    this.channel.on('postgres_changes', commentConfig, (payload) => {
      this.handleCommentChange(payload);
    });

    // Subscribe to likes table with optional post filter
    const likeConfig: {
      event: '*';
      schema: 'public';
      table: 'post_likes';
      filter?: string;
    } = {
      event: '*',
      schema: 'public',
      table: 'post_likes',
    };

    if (this.postIdFilter) {
      likeConfig.filter = `post_id=eq.${this.postIdFilter}`;
    }

    this.channel.on('postgres_changes', likeConfig, (payload) => {
      this.handleLikeChange(payload);
    });
  }

  /**
   * Handle subscription status changes
   */
  private handleSubscriptionStatus(
    status: string,
    error?: Error | { message?: string }
  ): void {
    if (!this.isActive) return;
    if (status === 'SUBSCRIBED') {
      this.setConnectionState('connected');
      this.reconnectAttempts = 0;
      this.stopPolling();
      console.log('Connected to community feed realtime');
    } else if (status === 'CHANNEL_ERROR') {
      this.setConnectionState('error');
      console.error('Realtime subscription error:', {
        status,
        errorMessage: error instanceof Error ? error.message : error?.message,
        errorStack: error instanceof Error ? error.stack : undefined,
        channelName: this.channel?.topic,
        reconnectAttempts: this.reconnectAttempts,
      });
      communityMetrics.recordReconnect();
      this.handleConnectionError();
    } else if (status === 'TIMED_OUT') {
      this.setConnectionState('error');
      console.error('Realtime subscription timed out:', {
        status,
        channelName: this.channel?.topic,
        reconnectAttempts: this.reconnectAttempts,
      });
      communityMetrics.recordReconnect();
      this.handleConnectionError();
    } else if (status === 'CLOSED') {
      this.setConnectionState('disconnected');
      console.log('Realtime connection closed:', {
        status,
        wasActive: this.isActive,
        channelName: this.channel?.topic,
      });
      communityMetrics.recordReconnect();
      this.handleConnectionError();
    }
  }

  /**
   * Establish WebSocket connection and set up subscriptions
   */
  private connect(): void {
    if (!this.isActive) return;
    if (this.channel) {
      console.warn('Already connected or connecting to realtime');
      return;
    }

    this.setConnectionState('connecting');

    // Create channel with unique name based on filter
    const channelName = this.postIdFilter
      ? `community-feed-post-${this.postIdFilter}`
      : 'community-feed-global';

    this.channel = supabase.channel(channelName);

    // Set up all postgres_changes subscriptions
    this.setupSubscriptions();

    // Subscribe with status callback (includes error object when available)
    this.channel.subscribe((status, error) => {
      this.handleSubscriptionStatus(status, error);
    });
  }

  /**
   * Handle connection errors with exponential backoff and fallback to polling
   */
  private handleConnectionError(): void {
    if (!this.isActive) return;
    // Clear existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // If max attempts reached, fallback to polling
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached, falling back to polling');
      this.startPolling();
      return;
    }

    // Schedule reconnect with exponential backoff
    const delay = this.getBackoffDelay();
    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.cleanup();
      this.connect();
    }, delay);
  }

  /**
   * Start polling fallback when WebSocket connection fails
   * Polls every 30 seconds as per requirements
   */
  private startPolling(): void {
    if (this.isPolling) return;

    this.isPolling = true;
    console.log('Starting 30s polling fallback');

    // Poll immediately once
    this.pollUpdates();

    // Then poll every 30 seconds
    this.pollingTimer = setInterval(() => {
      this.pollUpdates();
    }, 30000);
  }

  /**
   * Stop polling fallback
   */
  private stopPolling(): void {
    if (!this.isPolling) return;

    this.isPolling = false;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    console.log('Stopped polling fallback');
  }

  /**
   * Poll for updates when real-time is unavailable.
   * Delegates to onPollRefresh callback - consumer must implement refetching.
   * @see RealtimeCallbacks.onPollRefresh for implementation requirements
   */
  private async pollUpdates(): Promise<void> {
    console.log('Polling for updates...');
    this.callbacks.onPollRefresh?.();
  }

  /**
   * Handle post change events
   */
  private async handlePostChange(
    payload: SupabaseRealtimePayload
  ): Promise<void> {
    const event = this.transformPayload<Post>(payload, 'posts');
    if (event && this.callbacks.onPostChange) {
      // Track latency: commit_timestamp → UI update
      if (event.commit_timestamp) {
        const commitTime = new Date(event.commit_timestamp).getTime();
        const latency = Date.now() - commitTime;
        communityMetrics.addLatencySample(latency);
      }
      await this.callbacks.onPostChange(event);
    }
  }

  /**
   * Handle comment change events
   */
  private async handleCommentChange(
    payload: SupabaseRealtimePayload
  ): Promise<void> {
    const event = this.transformPayload<PostComment>(payload, 'post_comments');
    if (event && this.callbacks.onCommentChange) {
      // Track latency: commit_timestamp → UI update
      if (event.commit_timestamp) {
        const commitTime = new Date(event.commit_timestamp).getTime();
        const latency = Date.now() - commitTime;
        communityMetrics.addLatencySample(latency);
      }
      await this.callbacks.onCommentChange(event);
    }
  }

  /**
   * Handle like change events
   */
  private async handleLikeChange(
    payload: SupabaseRealtimePayload
  ): Promise<void> {
    const event = this.transformPayload<PostLike>(payload, 'post_likes');
    if (event && this.callbacks.onLikeChange) {
      // Track latency: commit_timestamp → UI update
      if (event.commit_timestamp) {
        const commitTime = new Date(event.commit_timestamp).getTime();
        const latency = Date.now() - commitTime;
        communityMetrics.addLatencySample(latency);
      }
      await this.callbacks.onLikeChange(event);
    }
  }

  /**
   * Transform Supabase payload to RealtimeEvent format
   */
  private transformPayload<T>(
    payload: SupabaseRealtimePayload,
    table: 'posts' | 'post_comments' | 'post_likes'
  ): RealtimeEvent<T> | null {
    if (!payload) return null;

    // Basic validation: ensure payload has valid structure
    const isValid = (data: unknown): boolean => {
      return data === null || (typeof data === 'object' && data !== null);
    };

    if (!isValid(payload.new) || !isValid(payload.old)) {
      console.error('Invalid payload structure received', { table, payload });
      return null;
    }

    // Extract client_tx_id from the row if present
    const newData = payload.new as Record<string, unknown> | null;
    const oldData = payload.old as Record<string, unknown> | null;
    const clientTxId =
      (newData?.client_tx_id as string | undefined) ??
      (oldData?.client_tx_id as string | undefined);

    return {
      schema: 'public',
      table,
      eventType: payload.eventType,
      commit_timestamp: payload.commit_timestamp || new Date().toISOString(),
      new: payload.new as T | null,
      old: payload.old as Partial<T> | null,
      client_tx_id: clientTxId,
    };
  }

  /**
   * Clean up channel without triggering reconnect
   */
  private cleanup(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  /**
   * Unsubscribe from all real-time updates and cleanup
   */
  unsubscribe(): void {
    this.isActive = false;
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Remove AppState listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.stopPolling();
    this.cleanup();

    this.setConnectionState('disconnected');
    this.reconnectAttempts = 0;
    this.wasConnectedBeforeBackground = false;
    this.callbacks = {};
    this.postIdFilter = undefined;
    console.log('Unsubscribed from community feed realtime');
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if currently polling
   */
  isPollingActive(): boolean {
    return this.isPolling;
  }
}
