import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, useWindowDimensions } from 'react-native';

import type { Plant } from '@/api';
import {
  CARD_GAP,
  CARD_WIDTH_RATIO,
  CockpitPlantCard,
} from '@/components/home/cockpit-plant-card';
import { Pressable, Text, View } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import type { PlantsAttentionMap } from '@/lib/hooks/use-plants-attention';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';

type MyGardenSectionProps = {
  plants: Plant[];
  onPlantPress: (id: string) => void;
  attentionMap?: PlantsAttentionMap;
  isLoading?: boolean;
};

function SectionHeader(): React.ReactElement {
  const router = useRouter();

  const handleViewAll = React.useCallback(() => {
    haptics.selection();
    router.push('/plants');
  }, [router]);

  return (
    <View className="mb-4 flex-row items-center justify-between px-4">
      <Text className="text-lg font-bold text-white">
        {translate('home.cockpit.my_garden' as TxKeyPath)}
      </Text>
      <Pressable
        onPress={handleViewAll}
        accessibilityRole="button"
        accessibilityLabel={translate('home.cockpit.view_all' as TxKeyPath)}
        accessibilityHint={translate(
          'accessibility.plants.view_all_hint' as TxKeyPath
        )}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        className="active:opacity-70"
      >
        <Text className="text-sm font-medium text-primary-400">
          {translate('home.cockpit.view_all' as TxKeyPath)}
        </Text>
      </Pressable>
    </View>
  );
}

function LoadingSkeleton(): React.ReactElement {
  return (
    <View className="px-4" testID="my-garden-loading">
      <View className="h-[320px] w-[85%] animate-pulse rounded-3xl bg-white/5" />
    </View>
  );
}

export function MyGardenSection({
  plants,
  onPlantPress,
  attentionMap = {},
  isLoading = false,
}: MyGardenSectionProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const cardWidth = width * CARD_WIDTH_RATIO;

  return (
    <View testID="my-garden-section">
      <SectionHeader />

      {isLoading ? (
        <LoadingSkeleton />
      ) : plants.length === 0 ? (
        <View className="mx-4 rounded-2xl border border-dashed border-white/20 bg-white/5 p-6">
          <Text className="text-center text-sm text-white/50">
            {translate('home.cockpit.no_plants' as TxKeyPath)}
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + CARD_GAP}
          decelerationRate="fast"
          contentContainerStyle={styles.carouselContent}
          testID="my-garden-carousel"
        >
          {plants.map((plant) => (
            <CockpitPlantCard
              key={plant.id}
              plant={plant}
              onPress={onPlantPress}
              needsAttention={attentionMap[plant.id]?.needsAttention ?? false}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carouselContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
});
