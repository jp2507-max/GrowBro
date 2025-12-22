import { useRouter } from 'expo-router';
import React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';

export function FavoritesEmptyState(): React.ReactElement {
  const router = useRouter();

  const handleBrowseStrains = React.useCallback(() => {
    router.push('/strains');
  }, [router]);

  return (
    <View
      className="flex-1 items-center justify-center px-6"
      testID="favorites-empty-state"
    >
      <Text className="text-6xl">💚</Text>
      <Text
        className="mt-4 text-2xl font-semibold text-charcoal-900 dark:text-neutral-100"
        tx="strains.favorites.empty_title"
      />
      <Text
        className="mt-2 text-center text-base text-neutral-600 dark:text-neutral-400"
        tx="strains.favorites.empty_description"
      />
      <View className="mt-6">
        <Button
          onPress={handleBrowseStrains}
          label={translate('strains.favorites.empty_cta')}
          variant="default"
          testID="favorites-empty-cta"
        />
      </View>
    </View>
  );
}
