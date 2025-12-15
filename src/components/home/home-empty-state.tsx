import { useRouter } from 'expo-router';
import React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';

export function HomeEmptyState(): React.ReactElement {
  const router = useRouter();

  const handleAddPlant = React.useCallback(() => {
    router.push('/plants/create');
  }, [router]);

  return (
    <View
      className="flex-1 items-center justify-center gap-6 px-8 py-16"
      testID="home-empty-state"
    >
      <Text className="text-6xl">🌱</Text>
      <View className="gap-2">
        <Text className="text-center text-2xl font-bold text-text-primary">
          {translate('home.empty_state.title' as TxKeyPath)}
        </Text>
        <Text className="text-center text-base text-text-secondary">
          {translate('home.empty_state.body' as TxKeyPath)}
        </Text>
      </View>
      <Pressable
        className="rounded-full bg-primary-600 px-8 py-4 active:bg-primary-700"
        onPress={handleAddPlant}
        accessibilityRole="button"
        accessibilityLabel={translate('home.empty_state.cta' as TxKeyPath)}
        accessibilityHint={translate('home.fab.hint' as TxKeyPath)}
        testID="home-empty-state-cta"
      >
        <Text className="text-base font-semibold text-white">
          {translate('home.empty_state.cta' as TxKeyPath)}
        </Text>
      </Pressable>
    </View>
  );
}
