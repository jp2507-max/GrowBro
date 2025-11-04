/**
 * Settings Sync Status Banner
 * Displays sync status, errors, and retry actions
 *
 * Requirements: 2.8
 */

import React, { useEffect, useState } from 'react';
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

  // Load stats on mount and refresh periodically
  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      if (!mounted) return;
      const current = await getSyncStats();
      setStats(current);
      setPermanentErrors(getPermanentErrorCount());
    };

    void loadStats();

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      void loadStats();
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryFailed();
      onRetry?.();

      // Reload stats after retry
      const current = await getSyncStats();
      setStats(current);
      setPermanentErrors(getPermanentErrorCount());
    } finally {
      setRetrying(false);
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
        <View className="flex-1">
          <Text className="text-sm font-medium text-primary-900">
            Syncing your settings...
          </Text>
          <Text className="text-xs text-primary-700">
            {stats.syncing} {stats.syncing === 1 ? 'change' : 'changes'} in
            progress
          </Text>
        </View>
      </View>
    );
  }

  // Show error state with retry
  if (stats.error > 0 || permanentErrors > 0) {
    return (
      <View className="gap-3 bg-danger-50 px-4 py-3" testID={testID}>
        <View className="flex-row items-start gap-3">
          <View className="flex-1">
            <Text className="text-sm font-medium text-danger-900">
              Sync failed
            </Text>
            <Text className="text-xs text-danger-700">
              {stats.error} {stats.error === 1 ? 'change' : 'changes'} failed to
              sync. Your changes are saved locally.
            </Text>
            {permanentErrors > 0 && (
              <Text className="mt-1 text-xs text-danger-700">
                {permanentErrors}{' '}
                {permanentErrors === 1 ? 'change has' : 'changes have'} exceeded
                retry limit.
              </Text>
            )}
          </View>
        </View>
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
        <View className="flex-1">
          <Text className="text-sm font-medium text-warning-900">
            You&apos;re offline
          </Text>
          <Text className="text-xs text-warning-700">
            {stats.pending} {stats.pending === 1 ? 'change' : 'changes'} will
            sync when online
          </Text>
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
}

export function SyncStatusIndicator({
  status,
  testID = 'sync-status-indicator',
}: SyncStatusIndicatorProps): React.ReactElement | null {
  switch (status) {
    case 'synced':
      return null; // Don't show anything when synced

    case 'pending':
      return (
        <View className="flex-row items-center gap-1" testID={testID}>
          <ActivityIndicator size="small" color="#D97706" />
          <Text className="text-xs text-warning-700">Syncing...</Text>
        </View>
      );

    case 'error':
      return (
        <View className="flex-row items-center gap-1" testID={testID}>
          <Text className="text-xs text-danger-700">Sync failed</Text>
        </View>
      );

    default:
      return null;
  }
}
