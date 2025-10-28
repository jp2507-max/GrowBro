/**
 * Timeout Handler with User-Visible Countdown
 *
 * Manages inference timeouts with:
 * - User-visible countdown timer
 * - Cancellation capability
 * - Graceful timeout handling
 * - Progress updates
 *
 * Requirements:
 * - 10.4: Timeout handling with countdown and cancellation
 */

import { MODEL_CONFIG } from './model-config';

export type TimeoutState =
  | 'idle'
  | 'running'
  | 'warning'
  | 'expired'
  | 'cancelled';

export type TimeoutProgress = {
  state: TimeoutState;
  elapsedMs: number;
  remainingMs: number;
  totalMs: number;
  percentComplete: number;
  showWarning: boolean;
};

export type TimeoutOptions = {
  timeoutMs?: number;
  warningThresholdMs?: number;
  onProgress?: (progress: TimeoutProgress) => void;
  onWarning?: (remainingMs: number) => void;
  onTimeout?: () => void;
  onCancel?: () => void;
};

/**
 * Timeout handler with countdown and cancellation support
 */
export class TimeoutHandler {
  private startTime: number = 0;
  private timeoutMs: number;
  private warningThresholdMs: number;
  private state: TimeoutState = 'idle';
  private intervalId: NodeJS.Timeout | null = null;
  private timeoutId: NodeJS.Timeout | null = null;
  private options: TimeoutOptions;

  constructor(options: TimeoutOptions = {}) {
    this.timeoutMs =
      options.timeoutMs || MODEL_CONFIG.DEVICE_INFERENCE_DEADLINE_MS;
    this.warningThresholdMs =
      options.warningThresholdMs || this.timeoutMs * 0.8; // 80% threshold
    this.options = options;
  }

  /**
   * Start the timeout countdown
   */
  start(): void {
    if (this.state === 'running') {
      return;
    }

    this.startTime = Date.now();
    this.state = 'running';

    // Set up progress updates (every 100ms)
    this.intervalId = setInterval(() => {
      this.updateProgress();
    }, 100);

    // Set up timeout
    this.timeoutId = setTimeout(() => {
      this.handleTimeout();
    }, this.timeoutMs);
  }

  /**
   * Cancel the timeout
   */
  cancel(): void {
    if (this.state === 'cancelled' || this.state === 'idle') {
      return;
    }

    this.cleanup();
    this.state = 'cancelled';

    if (this.options.onCancel) {
      this.options.onCancel();
    }
  }

  /**
   * Stop the timeout (successful completion)
   */
  stop(): void {
    if (this.state === 'idle') {
      return;
    }

    this.cleanup();
    this.state = 'idle';
  }

  /**
   * Get current progress
   */
  getProgress(): TimeoutProgress {
    const elapsedMs = Date.now() - this.startTime;
    const remainingMs = Math.max(0, this.timeoutMs - elapsedMs);
    const percentComplete = Math.min(100, (elapsedMs / this.timeoutMs) * 100);
    const showWarning = elapsedMs >= this.warningThresholdMs;

    return {
      state: this.state,
      elapsedMs,
      remainingMs,
      totalMs: this.timeoutMs,
      percentComplete,
      showWarning,
    };
  }

  /**
   * Get current state
   */
  getState(): TimeoutState {
    return this.state;
  }

  /**
   * Check if timeout is active
   */
  isActive(): boolean {
    return this.state === 'running' || this.state === 'warning';
  }

  /**
   * Update progress and check for warning threshold
   */
  private updateProgress(): void {
    const progress = this.getProgress();

    // Check if we've crossed the warning threshold
    if (progress.showWarning && this.state === 'running') {
      this.state = 'warning';
      if (this.options.onWarning) {
        this.options.onWarning(progress.remainingMs);
      }
    }

    // Call progress callback
    if (this.options.onProgress) {
      this.options.onProgress(progress);
    }
  }

  /**
   * Handle timeout expiration
   */
  private handleTimeout(): void {
    this.cleanup();
    this.state = 'expired';

    if (this.options.onTimeout) {
      this.options.onTimeout();
    }
  }

  /**
   * Clean up timers
   */
  private cleanup(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Format remaining time for display (e.g., "3.5s", "45s")
 */
export function formatRemainingTime(remainingMs: number): string {
  if (remainingMs < 0) {
    return '0s';
  }

  const seconds = remainingMs / 1000;

  if (seconds < 10) {
    return `${seconds.toFixed(1)}s`;
  }

  return `${Math.ceil(seconds)}s`;
}

/**
 * Create a promise that rejects after a timeout with cancellation support
 */
export function createCancellableTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions = {}
): {
  promise: Promise<T>;
  cancel: () => void;
  handler: TimeoutHandler;
} {
  const handler = new TimeoutHandler(options);
  let cancelled = false;

  const timeoutPromise = new Promise<T>((_, reject) => {
    handler.start();

    // Override onTimeout to reject the promise
    const originalOnTimeout = options.onTimeout;
    options.onTimeout = () => {
      if (originalOnTimeout) {
        originalOnTimeout();
      }
      reject(new Error('Operation timed out'));
    };
  });

  const wrappedPromise = Promise.race([promise, timeoutPromise])
    .then((result) => {
      if (!cancelled) {
        handler.stop();
      }
      return result;
    })
    .catch((error) => {
      if (!cancelled) {
        handler.stop();
      }
      throw error;
    });

  return {
    promise: wrappedPromise,
    cancel: () => {
      cancelled = true;
      handler.cancel();
    },
    handler,
  };
}

/**
 * Execute a function with timeout and progress tracking
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  options: TimeoutOptions = {}
): Promise<T> {
  const handler = new TimeoutHandler(options);

  return new Promise<T>((resolve, reject) => {
    handler.start();

    // Override callbacks to handle promise resolution
    const originalOnTimeout = options.onTimeout;
    const originalOnCancel = options.onCancel;

    options.onTimeout = () => {
      if (originalOnTimeout) {
        originalOnTimeout();
      }
      reject(new Error('Operation timed out'));
    };

    options.onCancel = () => {
      if (originalOnCancel) {
        originalOnCancel();
      }
      reject(new Error('Operation cancelled'));
    };

    // Execute the function
    fn()
      .then((result) => {
        handler.stop();
        resolve(result);
      })
      .catch((error) => {
        handler.stop();
        reject(error);
      });
  });
}

/**
 * Get timeout configuration for different inference modes
 */
export function getTimeoutConfig(mode: 'device' | 'cloud'): {
  timeoutMs: number;
  warningThresholdMs: number;
} {
  if (mode === 'cloud') {
    return {
      timeoutMs: MODEL_CONFIG.CLOUD_INFERENCE_DEADLINE_MS,
      warningThresholdMs: MODEL_CONFIG.CLOUD_INFERENCE_DEADLINE_MS * 0.8,
    };
  }

  return {
    timeoutMs: MODEL_CONFIG.DEVICE_INFERENCE_DEADLINE_MS,
    warningThresholdMs: MODEL_CONFIG.DEVICE_INFERENCE_DEADLINE_MS * 0.8,
  };
}
