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
  return (
    <View className="space-y-3">
      {plants.map((plant) => (
        <Pressable
          key={plant.id}
          className={`rounded-xl border-2 p-4 ${
            selectedId === plant.id
              ? 'dark:bg-primary-950 border-primary-600 bg-primary-50 dark:border-primary-500'
              : 'border-neutral-200 bg-white dark:border-charcoal-800 dark:bg-charcoal-900'
          }`}
          onPress={() => onSelect(plant.id)}
          accessibilityRole="button"
          accessibilityLabel={
            plant.strain ? `${plant.name}, ${plant.strain}` : plant.name
          }
          accessibilityHint="Double tap to select this plant"
          testID={`plant-option-${plant.id}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
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

function useApplyHandlers({
  selectedPlantId,
  params,
  playbookService,
  router,
  setApplying,
}: {
  selectedPlantId: string | null;
  params: { playbookId: string };
  playbookService: ReturnType<typeof usePlaybookService>;
  router: ReturnType<typeof useRouter>;
  setApplying: (value: boolean) => void;
}) {
  const { t } = useTranslation();

  const handleApply = React.useCallback(async () => {
    if (!selectedPlantId) return;

    try {
      setApplying(true);

      const result = await playbookService.applyPlaybookToPlant(
        params.playbookId,
        selectedPlantId,
        {
          idempotencyKey: `${params.playbookId}-${selectedPlantId}-${Date.now()}`,
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
  ]);

  const handleCreatePlant = React.useCallback(() => {
    router.push({
      pathname: '/plants/create',
      params: { returnTo: '/playbooks/apply', playbookId: params.playbookId },
    });
  }, [params.playbookId, router]);

  return { handleApply, handleCreatePlant };
}

function EmptyPlantState({ onCreatePlant }: { onCreatePlant: () => void }) {
  const { t } = useTranslation();
  return (
    <View className="items-center py-12">
      <Text className="mb-4 text-center text-neutral-600 dark:text-neutral-400">
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
          <Text className="mb-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {t('playbooks.selectPlant')}
          </Text>
          <Text className="mb-6 text-base text-neutral-600 dark:text-neutral-400">
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
        <View className="border-t border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
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

  const [plants, setPlants] = React.useState<Plant[]>([]);
  const [selectedPlantId, setSelectedPlantId] = React.useState<string | null>(
    null
  );
  const [loading, setLoading] = React.useState(true);
  const [applying, setApplying] = React.useState(false);

  const { handleApply, handleCreatePlant } = useApplyHandlers({
    selectedPlantId,
    params,
    playbookService,
    router,
    setApplying,
  });

  React.useEffect(() => {
    const loadPlants = async () => {
      try {
        setLoading(true);
        setPlants([
          {
            id: '1',
            name: 'Northern Lights #1',
            strain: 'Northern Lights',
            startDate: new Date().toISOString(),
          },
        ]);
      } catch (error) {
        console.error('Failed to load plants:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlants();
  }, []);

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
