/**
 * PostDetailLoadingState - Loading spinner for post detail screen
 */

import { Stack } from 'expo-router';
import * as React from 'react';

import { ActivityIndicator, FocusAwareStatusBar, View } from '@/components/ui';

export function PostDetailLoadingState(): React.ReactElement {
  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar />
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    </View>
  );
}
