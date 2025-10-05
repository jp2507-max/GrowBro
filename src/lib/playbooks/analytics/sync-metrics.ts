/* eslint-disable max-params */
/**
 * Sync performance metrics tracker
 */

import { MMKV } from 'react-native-mmkv';

import { analyticsService } from './service';
import type {
  ConflictMetrics,
  ConflictRestoredEvent,
  ConflictSeenEvent,
  SyncCompleteEvent,
  SyncFailEvent,
  SyncMetrics,
  SyncStartEvent,
} from './types';

const SYNC_METRICS_KEY = 'sync_metrics';
const CONFLICT_METRICS_KEY = 'conflict_metrics';
const ACTIVE_SYNCS_KEY = 'active_syncs';

interface ActiveSync {
  operation: 'pull' | 'push' | 'full';
  startTime: number;
}

class SyncMetricsTracker {
  private storage: MMKV;
  private activeSyncs: Map<string, ActiveSync>;

  constructor() {
    this.storage = new MMKV({ id: 'sync-metrics' });
    this.activeSyncs = new Map();
  }

  /**
   * Track sync start
   */
  trackSyncStart(syncId: string, operation: 'pull' | 'push' | 'full'): void {
    this.activeSyncs.set(syncId, {
      operation,
      startTime: Date.now(),
    });

    analyticsService.track<SyncStartEvent>('sync_start', {
      operation,
    });
  }

  /**
   * Track sync completion
   */
  trackSyncComplete(syncId: string, recordsSynced: number): void {
    const activeSync = this.activeSyncs.get(syncId);
    if (!activeSync) {
      console.warn('[SyncMetrics] Sync not found:', syncId);
      return;
    }

    const latencyMs = Date.now() - activeSync.startTime;

    analyticsService.track<SyncCompleteEvent>('sync_complete', {
      operation: activeSync.operation,
      latencyMs,
      recordsSynced,
    });

    this.activeSyncs.delete(syncId);
    this.updateSyncMetrics('success', latencyMs);
  }

  /**
   * Track sync failure
   */
  trackSyncFail(syncId: string, errorCode: string, retryable: boolean): void {
    const activeSync = this.activeSyncs.get(syncId);
    if (!activeSync) {
      console.warn('[SyncMetrics] Sync not found:', syncId);
      return;
    }

    const latencyMs = Date.now() - activeSync.startTime;

    analyticsService.track<SyncFailEvent>('sync_fail', {
      operation: activeSync.operation,
      errorCode,
      retryable,
      latencyMs,
    });

    this.activeSyncs.delete(syncId);
    this.updateSyncMetrics('fail', latencyMs);
  }

  /**
   * Track conflict detection
   */
  trackConflictSeen(
    table: string,
    recordId: string,
    conflictType: ConflictSeenEvent['conflictType'],
    resolution: ConflictSeenEvent['resolution']
  ): void {
    analyticsService.track<ConflictSeenEvent>('conflict_seen', {
      table,
      recordId,
      conflictType,
      resolution,
    });

    this.updateConflictMetrics('seen', resolution);
  }

  /**
   * Track conflict restoration
   */
  trackConflictRestored(
    table: string,
    recordId: string,
    conflictType: ConflictRestoredEvent['conflictType']
  ): void {
    analyticsService.track<ConflictRestoredEvent>('conflict_restored', {
      table,
      recordId,
      conflictType,
    });

    this.updateConflictMetrics('restored', 'client_wins');
  }

  /**
   * Get current sync metrics
   */
  getSyncMetrics(): SyncMetrics {
    const stored = this.storage.getString(SYNC_METRICS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }

    return {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      averageLatencyMs: 0,
      failRate: 0,
      lastCalculated: Date.now(),
    };
  }

  /**
   * Get current conflict metrics
   */
  getConflictMetrics(): ConflictMetrics {
    const stored = this.storage.getString(CONFLICT_METRICS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }

    return {
      totalConflicts: 0,
      resolvedByServer: 0,
      resolvedByClient: 0,
      manualResolutions: 0,
      restoredCount: 0,
      lastCalculated: Date.now(),
    };
  }

  /**
   * Reset metrics (for testing or maintenance)
   */
  resetMetrics(): void {
    this.storage.delete(SYNC_METRICS_KEY);
    this.storage.delete(CONFLICT_METRICS_KEY);
    this.storage.delete(ACTIVE_SYNCS_KEY);
    this.activeSyncs.clear();
  }

  // Private methods

  private updateSyncMetrics(
    result: 'success' | 'fail',
    latencyMs: number
  ): void {
    const metrics = this.getSyncMetrics();

    metrics.totalSyncs++;
    if (result === 'success') {
      metrics.successfulSyncs++;
    } else {
      metrics.failedSyncs++;
    }

    // Update running average latency
    const totalLatency = metrics.averageLatencyMs * (metrics.totalSyncs - 1);
    metrics.averageLatencyMs = (totalLatency + latencyMs) / metrics.totalSyncs;

    // Recalculate fail rate
    metrics.failRate =
      metrics.totalSyncs > 0 ? metrics.failedSyncs / metrics.totalSyncs : 0;
    metrics.lastCalculated = Date.now();

    this.storage.set(SYNC_METRICS_KEY, JSON.stringify(metrics));
  }

  private updateConflictMetrics(
    type: 'seen' | 'restored',
    resolution: ConflictSeenEvent['resolution']
  ): void {
    const metrics = this.getConflictMetrics();

    if (type === 'seen') {
      metrics.totalConflicts++;
      switch (resolution) {
        case 'server_wins':
          metrics.resolvedByServer++;
          break;
        case 'client_wins':
          metrics.resolvedByClient++;
          break;
        case 'manual':
          metrics.manualResolutions++;
          break;
      }
    } else {
      metrics.restoredCount++;
    }

    metrics.lastCalculated = Date.now();
    this.storage.set(CONFLICT_METRICS_KEY, JSON.stringify(metrics));
  }
}

// Singleton instance
export const syncMetrics = new SyncMetricsTracker();
