/**
 * Apply Playbook Screen
 *
 * Allows user to select a plant and apply a playbook to it
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { client } from '@/api/common';
import type { Plant as ApiPlant } from '@/api/plants/types';
import { Button, SafeAreaView, Text, View } from '@/components/ui';
import { usePlaybookService } from '@/lib/playbooks';

type Plant = {
  id: string;
  name: string;
  strain?: string;
  startDate: string;
};

function PlantSelectionList({
  plants,
  selectedId,
  onSelect,
}: {
  plants: Plant[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View className="space-y-3">
      {plants.map((plant) => (
        <Pressable
          key={plant.id}
          className={`rounded-xl border-2 p-4 ${
            selectedId === plant.id
              ? 'border-primary-600 bg-primary-50 dark:border-primary-500 dark:bg-primary-950'
              : 'bg-card border-neutral-200 dark:border-charcoal-700'
          }`}
          onPress={() => onSelect(plant.id)}
          accessibilityRole="button"
          accessibilityLabel={
            plant.strain ? `${plant.name}, ${plant.strain}` : plant.name
          }
          accessibilityHint={t('playbooks.accessibility.selectPlantHint')}
          testID={`plant-option-${plant.id}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-lg font-semibold text-charcoal-900 dark:text-neutral-100">
            {plant.name}
          </Text>
          {plant.strain && (
            <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {plant.strain}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function useCreatePlantHandler({
  params,
  router,
}: {
  params: { playbookId: string };
  router: ReturnType<typeof useRouter>;
}): () => void {
  const handleCreatePlant = React.useCallback(() => {
    router.push({
      pathname: '/plants/create',
      params: { returnTo: '/playbooks/apply', playbookId: params.playbookId },
    });
  }, [params.playbookId, router]);

  return handleCreatePlant;
}

function usePlantLoader(): {
  plants: Plant[];
  loading: boolean;
} {
  const [plants, setPlants] = React.useState<Plant[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;

    const loadPlants = async () => {
      try {
        setLoading(true);
        const response = await client.get<ApiPlant[]>('plants');
        const apiPlants = response.data;

        if (!isMounted) return;

        // Transform API plants to component Plant shape
        const transformedPlants: Plant[] = apiPlants
          .filter((plant) => plant.id && plant.name) // Ensure required fields are present
          .map((plant) => ({
            id: plant.id,
            name: plant.name,
            strain: plant.strain,
            startDate: plant.plantedAt || new Date().toISOString(), // Use plantedAt as startDate, fallback to now
          }));

        setPlants(transformedPlants);
      } catch (error) {
        console.error('Failed to load plants:', error);
        // Optionally show user-friendly error message
        if (isMounted) {
          showMessage({
            message: 'Failed to load plants',
            description: 'Please check your connection and try again',
            type: 'danger',
          });
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPlants();

    return () => {
      isMounted = false;
    };
  }, []);

  return { plants, loading };
}

function useApplyHandlers({
  selectedPlantId,
  params,
  playbookService,
  router,
  setApplying,
  idempotencyKey,
}: {
  selectedPlantId: string | null;
  params: { playbookId: string };
  playbookService: ReturnType<typeof usePlaybookService>;
  router: ReturnType<typeof useRouter>;
  setApplying: (value: boolean) => void;
  idempotencyKey: string;
}): {
  handleApply: () => Promise<void>;
} {
  const { t } = useTranslation();

  const handleApply = React.useCallback(async () => {
    if (!selectedPlantId) return;

    try {
      setApplying(true);

      const result = await playbookService.applyPlaybookToPlant(
        params.playbookId,
        selectedPlantId,
        {
          idempotencyKey,
        }
      );

      showMessage({
        message: t('playbooks.applySuccess'),
        description: t('playbooks.applySuccessDescription', {
          count: result.appliedTaskCount,
        }),
        type: 'success',
        duration: 3000,
      });

      router.back();
    } catch (error) {
      console.error('Failed to apply playbook:', error);
      showMessage({
        message: t('playbooks.applyError'),
        description: t('playbooks.applyErrorDescription'),
        type: 'danger',
        duration: 4000,
      });
    } finally {
      setApplying(false);
    }
  }, [
    selectedPlantId,
    params.playbookId,
    playbookService,
    router,
    t,
    setApplying,
    idempotencyKey,
  ]);

  return { handleApply };
}

function EmptyPlantState({ onCreatePlant }: { onCreatePlant: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="items-center py-12">
      <Text className="text-text-secondary mb-4 text-center">
        {t('playbooks.noPlants')}
      </Text>
      <Button label={t('playbooks.createPlant')} onPress={onCreatePlant} />
    </View>
  );
}

function ApplyContent({
  plants,
  selectedPlantId,
  applying,
  onSelectPlant,
  onApply,
  onCreatePlant,
}: {
  plants: Plant[];
  selectedPlantId: string | null;
  applying: boolean;
  onSelectPlant: (id: string) => void;
  onApply: () => void;
  onCreatePlant: () => void;
}) {
  const { t } = useTranslation();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text className="text-text-primary mb-2 text-2xl font-bold">
            {t('playbooks.selectPlant')}
          </Text>
          <Text className="text-text-secondary mb-6 text-base">
            {t('playbooks.selectPlantDescription')}
          </Text>

          {plants.length === 0 ? (
            <EmptyPlantState onCreatePlant={onCreatePlant} />
          ) : (
            <PlantSelectionList
              plants={plants}
              selectedId={selectedPlantId}
              onSelect={onSelectPlant}
            />
          )}
        </View>
      </ScrollView>

      {plants.length > 0 && (
        <View className="border-border bg-card border-t p-4">
          <Button
            label={
              applying ? t('playbooks.applying') : t('playbooks.applyPlaybook')
            }
            onPress={onApply}
            disabled={!selectedPlantId || applying}
            className="w-full"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

function ApplyPlaybookScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ playbookId: string }>();
  const playbookService = usePlaybookService();

  const [selectedPlantId, setSelectedPlantId] = React.useState<string | null>(
    null
  );
  const [applying, setApplying] = React.useState(false);
  const { plants, loading } = usePlantLoader();

  // Generate stable idempotency key once on mount for retries
  const idempotencyKeyRef = React.useRef<string>(
    `${params.playbookId}-${Date.now()}`
  );

  const { handleApply } = useApplyHandlers({
    selectedPlantId,
    params,
    playbookService,
    router,
    setApplying,
    idempotencyKey: idempotencyKeyRef.current,
  });

  const handleCreatePlant = useCreatePlantHandler({
    params,
    router,
  });

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <ApplyContent
      plants={plants}
      selectedPlantId={selectedPlantId}
      applying={applying}
      onSelectPlant={setSelectedPlantId}
      onApply={handleApply}
      onCreatePlant={handleCreatePlant}
    />
  );
}

export default ApplyPlaybookScreen;
