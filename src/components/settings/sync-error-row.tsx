/**
 * SyncErrorRow component
 *
 * Displays non-blocking inline error surface for sync failures
 * Requirements: 2.8
 */

import React from 'react';

import type { SyncError } from '@/types/settings';

import { Button, Text, View } from '../ui';

interface SyncErrorRowProps {
  error: SyncError;
  onRetry?: () => void;
  lastSyncAttempt?: string;
  testID?: string;
}

export function SyncErrorRow({
  error,
  onRetry,
  lastSyncAttempt,
  testID = 'sync-error-row',
}: SyncErrorRowProps): React.ReactElement {
  return (
    <View
      className="dark:bg-danger-950 mb-2 rounded-lg border border-danger-300 bg-danger-50 p-3 dark:border-danger-700"
      testID={testID}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-sm font-medium text-danger-800 dark:text-danger-200">
            Sync Failed
          </Text>
          <Text className="mt-1 text-xs text-danger-700 dark:text-danger-300">
            {error.message}
          </Text>
          {lastSyncAttempt && (
            <Text className="mt-1 text-xs text-danger-600 dark:text-danger-400">
              Last attempt: {lastSyncAttempt}
            </Text>
          )}
        </View>

        {error.canRetry && onRetry && (
          <Button
            label="Retry"
            onPress={onRetry}
            size="sm"
            variant="outline"
            className="ml-2"
            testID={`${testID}-retry-button`}
          />
        )}
      </View>
    </View>
  );
}
