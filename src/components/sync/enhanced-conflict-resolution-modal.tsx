/**
 * Enhanced Conflict Resolution Modal
 *
 * Shows server vs local diff comparison with one-tap restore
 * Improved UI with better visual hierarchy and accessibility
 *
 * Requirements: 6.4, 6.5, UI/UX implementation
 */

/* eslint-disable max-lines-per-function */
import React from 'react';
import { ScrollView } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import type { Conflict } from '@/lib/sync/conflict-resolver';

type EnhancedConflictResolutionModalProps = {
  conflict: Conflict;
  onResolve: (strategy: 'keep-local' | 'accept-server') => void;
  onDismiss: () => void;
};

export function EnhancedConflictResolutionModal({
  conflict,
  onResolve,
  onDismiss,
}: EnhancedConflictResolutionModalProps) {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      {/* Header */}
      <View className="border-b border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
        <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
          Sync Conflict Detected
        </Text>
        <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          This {conflict.tableName} was modified on another device
        </Text>
      </View>

      <ScrollView className="flex-1 p-4">
        {/* Explanation */}
        <View className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-4 dark:border-primary-800 dark:bg-primary-900/20">
          <Text className="text-sm text-primary-800 dark:text-primary-200">
            ℹ️ The same item was changed on multiple devices. Choose which
            version to keep.
          </Text>
        </View>

        {/* Conflict Fields */}
        <View className="mb-4">
          <Text className="mb-3 text-sm font-medium uppercase text-neutral-500 dark:text-neutral-400">
            Conflicting Fields ({conflict.conflictFields.length})
          </Text>

          {conflict.conflictFields.map((field, index) => (
            <View
              key={field}
              className={`${index > 0 ? 'mt-3' : ''} rounded-xl border border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900`}
            >
              {/* Field Name */}
              <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {field}
              </Text>

              {/* Your Version */}
              <View className="mb-3">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs font-medium uppercase text-primary-600 dark:text-primary-400">
                    Your Version (Local)
                  </Text>
                  <View className="rounded-full bg-primary-100 px-2 py-0.5 dark:bg-primary-900/30">
                    <Text className="text-xs font-medium text-primary-700 dark:text-primary-300">
                      This Device
                    </Text>
                  </View>
                </View>
                <View className="min-h-[48px] rounded-lg border border-primary-200 bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-900/20">
                  <Text className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
                    {formatValue(conflict.localRecord?.[field])}
                  </Text>
                </View>
              </View>

              {/* Server Version */}
              <View>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-xs font-medium uppercase text-success-600 dark:text-success-400">
                    Server Version (Remote)
                  </Text>
                  <View className="rounded-full bg-success-100 px-2 py-0.5 dark:bg-success-900/30">
                    <Text className="text-xs font-medium text-success-700 dark:text-success-300">
                      Other Device
                    </Text>
                  </View>
                </View>
                <View className="min-h-[48px] rounded-lg border border-success-200 bg-success-50 p-3 dark:border-success-800 dark:bg-success-900/20">
                  <Text className="font-mono text-sm text-neutral-800 dark:text-neutral-200">
                    {formatValue(conflict.remoteRecord?.[field])}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Important Note */}
        <View className="rounded-lg border border-warning-200 bg-warning-50 p-4 dark:border-warning-800 dark:bg-warning-900/20">
          <Text className="text-xs text-warning-800 dark:text-warning-200">
            ⚠️ Choosing a version will overwrite the other. This action cannot
            be undone.
          </Text>
        </View>
      </ScrollView>

      {/* Actions */}
      <View className="border-t border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
        <View className="mb-3 flex-row gap-3">
          <View className="flex-1">
            <Button
              variant="outline"
              onPress={() => onResolve('keep-local')}
              testID="keep-local-button"
              className="min-h-[48px]"
            >
              <View className="items-center">
                <Text className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                  Keep My Version
                </Text>
                <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                  (This Device)
                </Text>
              </View>
            </Button>
          </View>
          <View className="flex-1">
            <Button
              onPress={() => onResolve('accept-server')}
              testID="accept-server-button"
              className="min-h-[48px]"
            >
              <View className="items-center">
                <Text className="text-sm font-semibold text-white">
                  Use Server Version
                </Text>
                <Text className="text-xs text-white/80">(Other Device)</Text>
              </View>
            </Button>
          </View>
        </View>
        <Button
          variant="ghost"
          onPress={onDismiss}
          label="Decide Later"
          testID="dismiss-conflict-button"
          className="min-h-[44px]"
        />
      </View>
    </View>
  );
}
