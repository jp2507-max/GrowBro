/* eslint-disable max-lines-per-function */
import React from 'react';
import { ScrollView } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import type { Conflict } from '@/lib/sync/conflict-resolver';

type ConflictResolutionModalProps = {
  conflict: Conflict;
  onResolve: (strategy: 'keep-local' | 'accept-server') => void;
  onDismiss: () => void;
};

export function ConflictResolutionModal({
  conflict,
  onResolve,
  onDismiss,
}: ConflictResolutionModalProps) {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    if (value instanceof Date) return value.toLocaleString();
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <View className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-charcoal-800 dark:bg-charcoal-900">
        <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Sync Conflict Detected
        </Text>
        <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          This {conflict.tableName} was modified on another device. Choose which
          version to keep.
        </Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="mb-4">
          <Text className="mb-2 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
            Conflicting Fields
          </Text>
          {conflict.conflictFields.map((field) => (
            <View
              key={field}
              className="mb-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-charcoal-800 dark:bg-charcoal-900"
            >
              <Text className="mb-2 font-medium text-neutral-900 dark:text-neutral-100">
                {field}
              </Text>

              <View className="mb-2">
                <Text className="mb-1 text-xs font-medium text-primary-600 dark:text-primary-400">
                  Your Version (Local)
                </Text>
                <View className="dark:bg-primary-950 rounded bg-primary-50 p-2">
                  <Text className="font-mono text-xs text-neutral-800 dark:text-neutral-200">
                    {formatValue(conflict.localRecord?.[field])}
                  </Text>
                </View>
              </View>

              <View>
                <Text className="mb-1 text-xs font-medium text-success-600 dark:text-success-400">
                  Server Version
                </Text>
                <View className="dark:bg-success-950 rounded bg-success-50 p-2">
                  <Text className="font-mono text-xs text-neutral-800 dark:text-neutral-200">
                    {formatValue(conflict.remoteRecord?.[field])}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View className="dark:bg-warning-950 mb-2 rounded-lg border border-warning-200 bg-warning-50 p-3 dark:border-warning-800">
          <Text className="text-xs text-warning-800 dark:text-warning-200">
            <Text className="font-semibold">Note:</Text> By default, the server
            version will be used (Last-Write-Wins). You can restore your local
            version if needed.
          </Text>
        </View>
      </ScrollView>

      <View className="border-t border-neutral-200 bg-white px-4 py-3 dark:border-charcoal-800 dark:bg-charcoal-900">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              variant="outline"
              onPress={() => onResolve('keep-local')}
              label="Restore My Version"
            />
          </View>
          <View className="flex-1">
            <Button
              onPress={() => onResolve('accept-server')}
              label="Accept Server"
            />
          </View>
        </View>
        <View className="mt-2">
          <Button variant="ghost" onPress={onDismiss} label="Dismiss" />
        </View>
      </View>
    </View>
  );
}
