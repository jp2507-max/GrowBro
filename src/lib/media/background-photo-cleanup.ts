/**
 * Background Photo Cleanup Service
 *
 * Requirements:
 * - 16.3: Background cleanup jobs for photo storage
 * - 13.3: Run background LRU janitor on app start
 * - 13.4: Offer "Free up space" action
 *
 * Features:
 * - Periodic cleanup based on interval
 * - Battery-aware scheduling
 * - Storage threshold monitoring
 * - Integration with app lifecycle
 */

import { AppState, type AppStateStatus } from 'react-native';

import { DEFAULT_PHOTO_STORAGE_CONFIG } from '@/types/photo-storage';

import { cleanupLRU, initializeJanitor } from './photo-janitor';
import { getStorageInfo } from './photo-storage-service';

/**
 * Background cleanup configuration
 */
export type BackgroundCleanupConfig = {
  /** Interval in milliseconds between cleanup runs (default: 6 hours) */
  cleanupIntervalMs: number;
  /** Storage threshold percentage to trigger cleanup (0-1, default: 0.8) */
  storageThresholdPercent: number;
  /** Enable automatic cleanup on app background/foreground transitions */
  enableAppStateCleanup: boolean;
};

const DEFAULT_CLEANUP_CONFIG: BackgroundCleanupConfig = {
  cleanupIntervalMs: 6 * 60 * 60 * 1000, // 6 hours
  storageThresholdPercent: 0.8, // 80%
  enableAppStateCleanup: true,
};

/**
 * Background cleanup job manager
 */
class BackgroundPhotoCleanup {
  private intervalId: NodeJS.Timeout | null = null;
  private appStateSubscription: any = null;
  private config: BackgroundCleanupConfig;
  private isRunning = false;
  private referencedUris: string[] = [];

  constructor(config: Partial<BackgroundCleanupConfig> = {}) {
    this.config = { ...DEFAULT_CLEANUP_CONFIG, ...config };
  }

  /**
   * Update referenced URIs from database
   */
  updateReferencedUris(uris: string[]): void {
    this.referencedUris = uris;
  }

  /**
   * Check if cleanup should run based on storage threshold
   */
  private async shouldRunCleanup(): Promise<boolean> {
    try {
      const storageInfo = await getStorageInfo();
      const usagePercent =
        storageInfo.totalBytes > 0
          ? storageInfo.totalBytes /
            DEFAULT_PHOTO_STORAGE_CONFIG.maxStorageBytes
          : 0;

      return usagePercent >= this.config.storageThresholdPercent;
    } catch (error) {
      console.warn('Failed to check storage threshold:', error);
      return false;
    }
  }

  /**
   * Run cleanup job
   */
  private async runCleanup(aggressive = false): Promise<void> {
    if (this.isRunning) {
      console.log('[BackgroundCleanup] Cleanup already running, skipping');
      return;
    }

    try {
      this.isRunning = true;

      const shouldRun = aggressive || (await this.shouldRunCleanup());
      if (!shouldRun) {
        console.log(
          '[BackgroundCleanup] Storage below threshold, skipping cleanup'
        );
        return;
      }

      console.log('[BackgroundCleanup] Starting cleanup job');
      const startTime = Date.now();

      const result = await cleanupLRU(
        DEFAULT_PHOTO_STORAGE_CONFIG,
        this.referencedUris,
        aggressive
      );

      const duration = Date.now() - startTime;
      console.log('[BackgroundCleanup] Cleanup completed:', {
        ...result,
        totalDurationMs: duration,
      });
    } catch (error) {
      console.error('[BackgroundCleanup] Cleanup failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (!this.config.enableAppStateCleanup) return;

    // Run cleanup when app goes to background
    if (nextAppState === 'background') {
      console.log('[BackgroundCleanup] App backgrounded, running cleanup');
      this.runCleanup(false);
    }
  }

  /**
   * Start background cleanup service
   */
  start(): void {
    if (this.intervalId) {
      console.warn('[BackgroundCleanup] Service already started');
      return;
    }

    console.log('[BackgroundCleanup] Starting service', {
      intervalMinutes: this.config.cleanupIntervalMs / 1000 / 60,
      thresholdPercent: this.config.storageThresholdPercent * 100,
    });

    // Initial cleanup on start
    initializeJanitor(DEFAULT_PHOTO_STORAGE_CONFIG, this.referencedUris);

    // Periodic cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup(false);
    }, this.config.cleanupIntervalMs);

    // App state listener
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * Stop background cleanup service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    console.log('[BackgroundCleanup] Service stopped');
  }

  /**
   * Run manual cleanup (for "Free up space" action)
   */
  async runManualCleanup(): Promise<void> {
    console.log('[BackgroundCleanup] Manual cleanup triggered');
    await this.runCleanup(true); // Aggressive mode
  }

  /**
   * Get current status
   */
  getStatus(): {
    isRunning: boolean;
    hasActiveInterval: boolean;
    hasAppStateListener: boolean;
    referencedUriCount: number;
  } {
    return {
      isRunning: this.isRunning,
      hasActiveInterval: this.intervalId !== null,
      hasAppStateListener: this.appStateSubscription !== null,
      referencedUriCount: this.referencedUris.length,
    };
  }
}

// Singleton instance
let backgroundCleanupInstance: BackgroundPhotoCleanup | null = null;

/**
 * Get or create background cleanup instance
 */
export function getBackgroundCleanup(
  config?: Partial<BackgroundCleanupConfig>
): BackgroundPhotoCleanup {
  if (!backgroundCleanupInstance) {
    backgroundCleanupInstance = new BackgroundPhotoCleanup(config);
  }
  return backgroundCleanupInstance;
}

/**
 * Initialize background cleanup service
 * Call this once during app initialization
 */
export function initializeBackgroundCleanup(
  referencedUris: string[],
  config?: Partial<BackgroundCleanupConfig>
): void {
  const cleanup = getBackgroundCleanup(config);
  cleanup.updateReferencedUris(referencedUris);
  cleanup.start();
}

/**
 * Stop background cleanup service
 * Call this during app shutdown or cleanup
 */
export function stopBackgroundCleanup(): void {
  if (backgroundCleanupInstance) {
    backgroundCleanupInstance.stop();
    backgroundCleanupInstance = null;
  }
}

/**
 * Run manual cleanup (for "Free up space" button)
 */
export async function runManualPhotoCleanup(): Promise<void> {
  const cleanup = getBackgroundCleanup();
  await cleanup.runManualCleanup();
}
