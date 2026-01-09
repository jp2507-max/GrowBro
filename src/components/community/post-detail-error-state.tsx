/**
 * PostDetailErrorState - Error message for post detail screen
 */

import { Stack } from 'expo-router';
import * as React from 'react';

import { FocusAwareStatusBar, Text, View } from '@/components/ui';
import { translate, type TxKeyPath } from '@/lib/i18n';

export function PostDetailErrorState(): React.ReactElement {
  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar />
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center text-neutral-600 dark:text-neutral-400">
          {translate('errors.post_load' as TxKeyPath)}
        </Text>
      </View>
    </View>
  );
}
