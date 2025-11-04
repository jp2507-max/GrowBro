/**
 * Settings Sync Status Banner
 * Displays sync status, errors, and retry actions
 *
 * Requirements: 2.8
 */

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import {
  getPermanentErrorCount,
  getSyncStats,
  retryFailed,
} from '@/lib/settings/sync-service';
import type { SyncQueueStats } from '@/lib/settings/types';

interface SettingsSyncBannerProps {
  /**
   * Callback when retry is triggered
   */
  onRetry?: () => void;
  /**
   * Test ID for testing
   */
  testID?: string;
}

/**
 * Banner component for displaying settings sync status
 * Shows pending changes, errors, and manual retry action
 */
// eslint-disable-next-line max-lines-per-function -- JSX-heavy UI component with multiple state displays
export function SettingsSyncBanner({
  onRetry,
  testID = 'settings-sync-banner',
}: SettingsSyncBannerProps): React.ReactElement | null {
  const [stats, setStats] = useState<SyncQueueStats | null>(null);
  const [permanentErrors, setPermanentErrors] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const isMountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load stats on mount and refresh periodically
  useEffect(() => {
    isMountedRef.current = true;

    const loadStats = async () => {
      if (!isMountedRef.current) return;
      const current = await getSyncStats();
      if (isMountedRef.current) setStats(current);
      if (isMountedRef.current) setPermanentErrors(getPermanentErrorCount());
    };

    void loadStats();

    // Refresh every 5 seconds
    intervalRef.current = setInterval(() => {
      void loadStats();
    }, 5000);

    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleRetry = async () => {
    if (isMountedRef.current) setRetrying(true);
    try {
      await retryFailed();
      onRetry?.();

      // Reload stats after retry
      const current = await getSyncStats();
      if (isMountedRef.current) setStats(current);
      if (isMountedRef.current) setPermanentErrors(getPermanentErrorCount());
    } finally {
      if (isMountedRef.current) setRetrying(false);
    }
  };

  if (!stats) {
    return null;
  }

  // Don't show banner if nothing to display
  const totalPending = stats.pending + stats.error;
  if (totalPending === 0 && permanentErrors === 0) {
    return null;
  }

  // Show syncing state
  if (stats.syncing > 0) {
    return (
      <View
        className="flex-row items-center gap-3 bg-primary-50 px-4 py-3"
        testID={testID}
      >
        <ActivityIndicator size="small" color="#0066CC" />
        {/* Sync progress indicator and text */}
        <View className="flex-1">
          <Text
            className="text-sm font-medium text-primary-900"
            tx="settings.sync.banner.syncing_title"
          />
          <Text
            className="text-xs text-primary-700"
            tx={`settings.sync.banner.syncing_progress_${stats.syncing === 1 ? 'one' : 'other'}`}
            txOptions={{ count: stats.syncing }}
          />
        </View>
      </View>
    );
  }

  // Show error state with retry
  if (stats.error > 0 || permanentErrors > 0) {
    return (
      <View className="gap-3 bg-danger-50 px-4 py-3" testID={testID}>
        {/* Error message content */}
        <View className="flex-row items-start gap-3">
          <View className="flex-1">
            <Text
              className="text-sm font-medium text-danger-900"
              tx="settings.sync.banner.error_title"
            />
            <Text
              className="text-xs text-danger-700"
              tx={`settings.sync.banner.error_message_${stats.error === 1 ? 'one' : 'other'}`}
              txOptions={{ count: stats.error }}
            />
            {/* Additional info for permanent errors */}
            {permanentErrors > 0 && (
              <Text
                className="mt-1 text-xs text-danger-700"
                tx={`settings.sync.banner.error_permanent_${permanentErrors === 1 ? 'one' : 'other'}`}
                txOptions={{ count: permanentErrors }}
              />
            )}
          </View>
        </View>
        {/* Retry action button */}
        <View className="flex-row gap-2">
          <Button
            tx="common.retry"
            onPress={handleRetry}
            size="sm"
            variant="secondary"
            disabled={retrying}
            loading={retrying}
            className="flex-1"
            testID={`${testID}-retry-button`}
          />
        </View>
      </View>
    );
  }

  // Show pending state (offline)
  if (stats.pending > 0) {
    return (
      <View
        className="flex-row items-center gap-3 bg-warning-50 px-4 py-3"
        testID={testID}
      >
        {/* Offline notification content */}
        <View className="flex-1">
          <Text
            className="text-sm font-medium text-warning-900"
            tx="settings.sync.banner.offline_title"
          />
          <Text
            className="text-xs text-warning-700"
            tx={`settings.sync.banner.offline_message_${stats.pending === 1 ? 'one' : 'other'}`}
            txOptions={{ count: stats.pending }}
          />
        </View>
      </View>
    );
  }

  return null;
}

/**
 * Compact inline sync status indicator
 * For use in settings rows
 */
interface SyncStatusIndicatorProps {
  status: 'synced' | 'pending' | 'error';
  testID?: string;
  tx?: (status: 'pending' | 'error') => string;
}

export function SyncStatusIndicator({
  status,
  testID = 'sync-status-indicator',
  tx,
}: SyncStatusIndicatorProps): React.ReactElement | null {
  switch (status) {
    case 'synced':
      return null; // Don't show anything when synced

    case 'pending':
      return (
        <View className="flex-row items-center gap-1" testID={testID}>
          <ActivityIndicator size="small" color="#D97706" />
          <Text className="text-xs text-warning-700" tx={tx?.('pending')} />
        </View>
      );

    case 'error':
      return (
        <View className="flex-row items-center gap-1" testID={testID}>
          <Text className="text-xs text-danger-700" tx={tx?.('error')} />
        </View>
      );

    default:
      return null;
  }
}
