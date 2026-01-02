import React from 'react';

import type { Plant } from '@/api';
import { PlantCard } from '@/components/plants';
import { View } from '@/components/ui';
import { usePlantsAttention } from '@/lib/hooks/use-plants-attention';

type PlantsSectionProps = {
  plants: Plant[];
  isLoading?: boolean;
  onPlantPress: (id: string) => void;
};

function PlantsSkeleton(): React.ReactElement {
  return (
    <View className="gap-3">
      {[1, 2].map((i) => (
        <View
          key={i}
          className="h-[88px] animate-pulse rounded-2xl bg-neutral-200/60 dark:bg-neutral-700/40"
        />
      ))}
    </View>
  );
}

export function PlantsSection({
  plants,
  isLoading,
  onPlantPress,
}: PlantsSectionProps): React.ReactElement {
  // Get plant IDs for attention query
  const plantIds = React.useMemo(
    () => plants.map((plant) => plant.id),
    [plants]
  );

  // Fetch attention status for all plants at once
  const { attentionMap } = usePlantsAttention(plantIds);

  if (isLoading) {
    return (
      <View testID="plants-section-loading">
        <PlantsSkeleton />
      </View>
    );
  }

  return (
    <View className="gap-3" testID="plants-section">
      {plants.map((plant) => (
        <PlantCard
          key={plant.id}
          plant={plant}
          onPress={() => onPlantPress(plant.id)}
          needsAttention={attentionMap[plant.id]?.needsAttention ?? false}
        />
      ))}
    </View>
  );
}
