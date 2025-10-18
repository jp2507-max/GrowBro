import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type {
  Post,
  PostComment,
  PostLike,
  RealtimeEvent,
} from '@/types/community';

import { communityMetrics } from './metrics-tracker';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

type RealtimeCallbacks = {
  onPostChange?: (event: RealtimeEvent<Post>) => void | Promise<void>;
  onCommentChange?: (event: RealtimeEvent<PostComment>) => void | Promise<void>;
  onLikeChange?: (event: RealtimeEvent<PostLike>) => void | Promise<void>;
  onConnectionStateChange?: (state: ConnectionState) => void;
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
    // If already connected or connecting, perform clean re-subscribe
    if (
      this.connectionState === 'connected' ||
      this.connectionState === 'connecting'
    ) {
      this.unsubscribe();
    }

    this.callbacks = callbacks;
    this.postIdFilter = postId;
    this.connect();
  }

  /**
   * Establish WebSocket connection and set up subscriptions
   */
  private connect(): void {
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

    // Subscribe to posts table with optional post filter
    const postConfig: any = {
      event: '*',
      schema: 'public',
      table: 'posts',
    };

    // Apply post filter for scoped subscriptions
    if (this.postIdFilter) {
      postConfig.filter = `id=eq.${this.postIdFilter}`;
    }

    this.channel.on('postgres_changes', postConfig, (payload) => {
      this.handlePostChange(payload);
    });

    // Subscribe to comments table with optional post filter
    const commentConfig: any = {
      event: '*',
      schema: 'public',
      table: 'post_comments',
    };

    // Apply post filter for scoped subscriptions
    if (this.postIdFilter) {
      commentConfig.filter = `post_id=eq.${this.postIdFilter}`;
    }

    this.channel.on('postgres_changes', commentConfig, (payload) => {
      this.handleCommentChange(payload);
    });

    // Subscribe to likes table with optional post filter
    const likeConfig: any = {
      event: '*',
      schema: 'public',
      table: 'post_likes',
    };

    // Apply post filter for scoped subscriptions
    if (this.postIdFilter) {
      likeConfig.filter = `post_id=eq.${this.postIdFilter}`;
    }

    this.channel.on('postgres_changes', likeConfig, (payload) => {
      this.handleLikeChange(payload);
    });

    // Subscribe with status callback
    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.setConnectionState('connected');
        this.reconnectAttempts = 0;
        this.stopPolling();
        console.log('Connected to community feed realtime');
      } else if (status === 'CHANNEL_ERROR') {
        this.setConnectionState('error');
        console.error('Realtime subscription error');
        communityMetrics.recordReconnect();
        this.handleConnectionError();
      } else if (status === 'TIMED_OUT') {
        this.setConnectionState('error');
        console.error('Realtime subscription timed out');
        communityMetrics.recordReconnect();
        this.handleConnectionError();
      } else if (status === 'CLOSED') {
        this.setConnectionState('disconnected');
        console.log('Realtime connection closed');
        communityMetrics.recordReconnect();
        this.handleConnectionError();
      }
    });
  }

  /**
   * Handle connection errors with exponential backoff and fallback to polling
   */
  private handleConnectionError(): void {
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
   * Poll for updates when real-time is unavailable
   * This is a simplified implementation - actual polling should trigger
   * refetch in React Query
   */
  private async pollUpdates(): Promise<void> {
    // Notify listeners to trigger refetch
    // In practice, this would trigger React Query refetch
    console.log('Polling for updates...');
  }

  /**
   * Handle post change events
   */
  private async handlePostChange(payload: any): Promise<void> {
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
  private async handleCommentChange(payload: any): Promise<void> {
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
  private async handleLikeChange(payload: any): Promise<void> {
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
    payload: any,
    table: 'posts' | 'post_comments' | 'post_likes'
  ): RealtimeEvent<T> | null {
    if (!payload) return null;

    // Extract client_tx_id from the row if present
    const clientTxId = payload.new?.client_tx_id ?? payload.old?.client_tx_id;

    return {
      schema: 'public',
      table,
      eventType: payload.eventType,
      commit_timestamp: payload.commit_timestamp || new Date().toISOString(),
      new: payload.new || null,
      old: payload.old || null,
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
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopPolling();
    this.cleanup();

    this.setConnectionState('disconnected');
    this.reconnectAttempts = 0;
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
