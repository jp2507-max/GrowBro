import React from 'react';

import { Text, View } from '@/components/ui';

type ErrorDisplayProps = {
  error: string | null;
};

export function ErrorDisplay({ error }: ErrorDisplayProps) {
  if (!error) return null;

  return (
    <View
      testID="moderation-error-container"
      className="mb-4 rounded-lg bg-danger-100 p-3 dark:bg-danger-900"
    >
      <Text
        testID="moderation-error-text"
        className="text-sm text-danger-900 dark:text-danger-100"
      >
        {error}
      </Text>
    </View>
  );
}
