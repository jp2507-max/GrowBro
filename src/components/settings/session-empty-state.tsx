import * as React from 'react';

import { ActivityIndicator, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type SessionEmptyStateProps = {
  isLoading: boolean;
  error: Error | null;
};

/**
 * Empty state component for the sessions list.
 * Shows loading, error, or empty message based on state.
 */
export function SessionEmptyState({
  isLoading,
  error,
}: SessionEmptyStateProps): React.ReactElement {
  if (isLoading) {
    return (
      <View className="py-8">
        <ActivityIndicator size="large" testID="activity-indicator" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="rounded-lg bg-danger-100 p-4 dark:bg-danger-900">
        <Text className="text-danger-900 dark:text-danger-100">
          {translate('auth.sessions.error_loading')}
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-lg bg-white p-4 dark:bg-charcoal-900">
      <Text className="text-neutral-600 dark:text-neutral-400">
        {translate('auth.sessions.no_sessions')}
      </Text>
    </View>
  );
}
