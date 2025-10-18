/**
 * React hook for community feed health monitoring
 *
 * Provides real-time health status and metrics for the community feed
 * with optional alerting on threshold violations.
 *
 * Requirements: 10.5, 10.6
 */

import { useCallback, useEffect, useState } from 'react';

import type { HealthCheckResult } from './health-monitor';
import { communityHealth } from './health-monitor';

export interface UseCommunityHealthOptions {
  /**
   * Polling interval in milliseconds
   * @default 30000 (30 seconds)
   */
  pollingInterval?: number;

  /**
   * Callback invoked when critical alerts are detected
   */
  onAlert?: (result: HealthCheckResult) => void;

  /**
   * Enable automatic Sentry reporting for degraded/critical states
   * @default true
   */
  reportToSentry?: boolean;
}

/**
 * Monitor community feed health with periodic updates
 *
 * @example
 * ```tsx
 * const { health, isLoading } = useCommunityHealth({
 *   onAlert: (result) => {
 *     if (result.status === 'critical') {
 *       showMessage({
 *         message: 'Community feed experiencing issues',
 *         type: 'warning',
 *       });
 *     }
 *   },
 * });
 *
 * if (health?.status === 'critical') {
 *   return <ErrorState />;
 * }
 * ```
 */
export function useCommunityHealth(options: UseCommunityHealthOptions = {}): {
  health: HealthCheckResult | null;
  isLoading: boolean;
  refresh: () => void;
} {
  const { pollingInterval = 30000, onAlert, reportToSentry = true } = options;

  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkHealth = useCallback((): void => {
    const result = communityHealth.getHealthStatus();
    setHealth(result);
    setIsLoading(false);

    // Invoke alert callback if status is not healthy
    if (result.status !== 'healthy' && onAlert) {
      onAlert(result);
    }

    // Report to Sentry if enabled
    if (reportToSentry && result.status !== 'healthy') {
      void communityHealth.reportToSentry(result);
    }
  }, [onAlert, reportToSentry]);

  useEffect(() => {
    // Initial check
    checkHealth();

    // Set up polling
    const interval = setInterval(checkHealth, pollingInterval);

    return () => {
      clearInterval(interval);
    };
  }, [checkHealth, pollingInterval]);

  return {
    health,
    isLoading,
    refresh: checkHealth,
  };
}

/**
 * Get a snapshot of current metrics without polling
 *
 * Useful for one-time checks or manual refresh scenarios.
 */
export function useHealthSnapshot(): {
  getSnapshot: () => HealthCheckResult;
} {
  const getSnapshot = (): HealthCheckResult => {
    return communityHealth.getHealthStatus();
  };

  return { getSnapshot };
}
