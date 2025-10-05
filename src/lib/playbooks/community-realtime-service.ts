import type { RealtimeChannel } from '@supabase/supabase-js';
import * as React from 'react';

import { supabase } from '@/lib/supabase';

type CommunityCallbacks = {
  onTemplateInsert?: (template: any) => void;
  onTemplateUpdate?: (template: any) => void;
  onTemplateDelete?: (templateId: string) => void;
  onRatingChange?: (rating: any) => void;
  onCommentInsert?: (comment: any) => void;
  onCommentUpdate?: (comment: any) => void;
  onCommentDelete?: (commentId: string) => void;
};

/**
 * Service for managing Realtime subscriptions to community playbook templates.
 * Subscribes ONLY to public community data, never to private user data.
 */
export class CommunityRealtimeService {
  private channel: RealtimeChannel | null = null;
  private isSubscribed = false;

  private setupTemplateSubscription(callbacks: CommunityCallbacks): void {
    if (!this.channel) return;
    const hasCallbacks =
      callbacks.onTemplateInsert ||
      callbacks.onTemplateUpdate ||
      callbacks.onTemplateDelete;
    if (!hasCallbacks) return;

    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'community_playbook_templates' },
      (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            callbacks.onTemplateInsert?.(payload.new);
            break;
          case 'UPDATE':
            callbacks.onTemplateUpdate?.(payload.new);
            break;
          case 'DELETE':
            callbacks.onTemplateDelete?.(payload.old.id);
            break;
        }
      }
    );
  }

  private setupRatingSubscription(callbacks: CommunityCallbacks): void {
    if (!this.channel || !callbacks.onRatingChange) return;

    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'template_ratings' },
      (payload) => {
        callbacks.onRatingChange?.(payload.new || payload.old);
      }
    );
  }

  private setupCommentSubscription(callbacks: CommunityCallbacks): void {
    if (!this.channel) return;
    const hasCallbacks =
      callbacks.onCommentInsert ||
      callbacks.onCommentUpdate ||
      callbacks.onCommentDelete;
    if (!hasCallbacks) return;

    this.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'template_comments' },
      (payload) => {
        switch (payload.eventType) {
          case 'INSERT':
            callbacks.onCommentInsert?.(payload.new);
            break;
          case 'UPDATE':
            callbacks.onCommentUpdate?.(payload.new);
            break;
          case 'DELETE':
            callbacks.onCommentDelete?.(payload.old.id);
            break;
        }
      }
    );
  }

  /**
   * Subscribe to community playbook template changes
   */
  subscribe(callbacks: CommunityCallbacks): void {
    if (this.isSubscribed) {
      console.warn('Already subscribed to community realtime');
      return;
    }

    this.channel = supabase.channel('community-playbooks');
    this.setupTemplateSubscription(callbacks);
    this.setupRatingSubscription(callbacks);
    this.setupCommentSubscription(callbacks);

    this.channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.isSubscribed = true;
        console.log('Subscribed to community playbook realtime updates');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Failed to subscribe to community playbook realtime');
        this.isSubscribed = false;
      } else if (status === 'TIMED_OUT') {
        console.error('Realtime subscription timed out');
        this.isSubscribed = false;
      }
    });
  }

  /**
   * Unsubscribe from community playbook template changes
   */
  unsubscribe(): void {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
      this.isSubscribed = false;
      console.log('Unsubscribed from community playbook realtime updates');
    }
  }

  /**
   * Check if currently subscribed
   */
  isActive(): boolean {
    return this.isSubscribed;
  }
}

// Singleton instance
let realtimeService: CommunityRealtimeService | null = null;

/**
 * Get the singleton instance of the community realtime service
 */
export function getCommunityRealtimeService(): CommunityRealtimeService {
  if (!realtimeService) {
    realtimeService = new CommunityRealtimeService();
  }
  return realtimeService;
}

/**
 * Hook for using community realtime in React components
 */
export function useCommunityRealtime(callbacks: CommunityCallbacks) {
  React.useEffect(() => {
    const service = getCommunityRealtimeService();
    service.subscribe(callbacks);

    return () => {
      service.unsubscribe();
    };
  }, [callbacks]);
}
