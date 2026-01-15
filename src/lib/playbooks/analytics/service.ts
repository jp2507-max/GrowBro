/**
 * Core analytics service for tracking playbook events
 */

import * as Sentry from '@sentry/react-native';
import { MMKV } from 'react-native-mmkv';

import type {
  AnalyticsConfig,
  AnalyticsEvent,
  BaseAnalyticsEvent,
} from './types';

const STORAGE_KEY = 'playbook_analytics_events';
const SESSION_KEY = 'playbook_analytics_session';

class AnalyticsService {
  private config: AnalyticsConfig = {
    enabled: true,
    debug: __DEV__,
    batchSize: 10,
    flushIntervalMs: 30000, // 30 seconds
    persistEvents: true,
    maxQueueSize: 1000,
  };

  private storage: MMKV;
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private sessionId: string;

  constructor() {
    this.storage = new MMKV({ id: 'playbook-analytics' });
    this.sessionId = this.getOrCreateSessionId();
    this.loadPersistedEvents();
    this.startFlushTimer();
  }

  /**
   * Configure analytics service
   */
  configure(config: Partial<AnalyticsConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.config.debug) {
      console.log('[Analytics] Configured:', this.config);
    }
  }

  /**
   * Track an analytics event
   */
  track<T extends AnalyticsEvent>(
    eventType: T['type'],
    payload: Omit<T, keyof BaseAnalyticsEvent | 'type'>
  ): void {
    if (!this.config.enabled) return;

    const event: AnalyticsEvent = {
      type: eventType,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      ...payload,
    } as unknown as AnalyticsEvent;

    this.eventQueue.push(event);
    const maxQueueSize = this.config.maxQueueSize ?? 1000;
    if (this.eventQueue.length > maxQueueSize) {
      this.eventQueue.splice(0, this.eventQueue.length - maxQueueSize);
    }

    if (this.config.debug) {
      console.log('[Analytics] Event tracked:', event);
    }

    // Send to Sentry as breadcrumb
    Sentry.addBreadcrumb({
      category: 'analytics',
      message: eventType,
      level: 'info',
      data: payload as Record<string, unknown>,
    });

    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }

    // Persist if enabled
    if (this.config.persistEvents) {
      this.persistEvents();
    }
  }

  /**
   * Flush queued events
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue = [];

    if (this.config.debug) {
      console.log('[Analytics] Flushing events:', events.length);
    }

    try {
      // Send to analytics backend (placeholder for actual implementation)
      await this.sendEvents(events);

      // Clear persisted events after successful flush
      if (this.config.persistEvents) {
        this.storage.delete(STORAGE_KEY);
      }
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue.unshift(...events);
      console.error('[Analytics] Failed to flush events:', error);
      Sentry.captureException(error);
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Reset session (e.g., on logout)
   */
  resetSession(): void {
    this.sessionId = this.generateSessionId();
    this.storage.set(SESSION_KEY, this.sessionId);
    if (this.config.debug) {
      console.log('[Analytics] Session reset:', this.sessionId);
    }
  }

  /**
   * Cleanup on app shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  // Private methods

  private getOrCreateSessionId(): string {
    const existing = this.storage.getString(SESSION_KEY);
    if (existing) return existing;

    const newSessionId = this.generateSessionId();
    this.storage.set(SESSION_KEY, newSessionId);
    return newSessionId;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private loadPersistedEvents(): void {
    if (!this.config.persistEvents) return;

    try {
      const persisted = this.storage.getString(STORAGE_KEY);
      if (persisted) {
        this.eventQueue = JSON.parse(persisted);
        if (this.config.debug) {
          console.log(
            '[Analytics] Loaded persisted events:',
            this.eventQueue.length
          );
        }
      }
    } catch (error) {
      console.error('[Analytics] Failed to load persisted events:', error);
    }
  }

  private persistEvents(): void {
    try {
      this.storage.set(STORAGE_KEY, JSON.stringify(this.eventQueue));
    } catch (error) {
      console.error('[Analytics] Failed to persist events:', error);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushIntervalMs);
  }

  private async sendEvents(events: AnalyticsEvent[]): Promise<void> {
    // Placeholder for actual analytics backend integration
    // This could send to:
    // - Custom analytics API
    // - Supabase Edge Function
    // - Third-party analytics service
    // - Multiple destinations

    if (this.config.debug) {
      console.log('[Analytics] Would send events:', events);
    }

    // For now, just log to Sentry
    events.forEach((event) => {
      Sentry.addBreadcrumb({
        category: 'analytics.batch',
        message: event.type,
        level: 'info',
        data: event as unknown as Record<string, unknown>,
      });
    });

    // Simulate network delay in dev
    if (__DEV__) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

// Singleton instance
export const analyticsService = new AnalyticsService();
