import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { usePlant } from '@/api/plants';
import { PlantDetailDashboard } from '@/components/plants/plant-detail-dashboard';
import {
  ActivityIndicator,
  FocusAwareStatusBar,
  Pressable,
  Text,
} from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useNextFeed } from '@/lib/hooks/use-next-feed';
import { usePlantPhotoEditor } from '@/lib/hooks/use-plant-photo-editor';
import { usePlantTasks } from '@/lib/hooks/use-plant-tasks';

function PlantLoadingView(): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-950">
      <ActivityIndicator color="white" />
    </View>
  );
}

type PlantErrorViewProps = {
  errorMessage: string;
  retryLabel: string;
  onRetry: () => void;
};

function PlantErrorView({
  errorMessage,
  retryLabel,
  onRetry,
}: PlantErrorViewProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-neutral-950">
      <Text className="mb-3 text-base text-neutral-200">{errorMessage}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityHint={t('accessibility.common.retry_hint')}
        testID="plant-error-retry"
        className="active:opacity-70"
      >
        <Text className="font-bold text-primary-400">{retryLabel}</Text>
      </Pressable>
    </View>
  );
}

export default function PlantDetailScreen(): React.ReactElement | null {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();

  const plantId = React.useMemo(() => (id ? String(id) : null), [id]);

  const {
    data: plant,
    isLoading,
    isError,
    refetch,
  } = usePlant({ id: plantId ?? '' }, { enabled: Boolean(plantId) });

  // Fetch today's tasks
  const { tasks } = usePlantTasks(plantId ?? '', { enabled: Boolean(plantId) });

  // Fetch next feed time
  const { hoursUntil } = useNextFeed(plantId ?? '');

  // Photo editing
  const { photoInfo, handleEditPhoto } = usePlantPhotoEditor({
    plantId,
  });

  const handleBack = React.useCallback(() => {
    haptics.selection();
    router.replace('/');
  }, [router]);

  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  const handleTaskPress = React.useCallback(
    (taskId: string) => {
      haptics.selection();
      router.push(`/calendar?taskId=${taskId}`);
    },
    [router]
  );

  const handleHarvestPress = React.useCallback(() => {
    if (!plantId) return;
    haptics.selection();
    router.push({
      pathname: '/(modals)/harvest',
      params: { plantId },
    });
  }, [plantId, router]);

  const handleAdvancedSettings = React.useCallback(() => {
    if (!plantId) return;
    haptics.selection();
    router.push({
      pathname: '/(modals)/plant-settings',
      params: { id: plantId },
    });
  }, [plantId, router]);

  if (!plantId) {
    return (
      <PlantErrorView
        errorMessage={t('plants.form.invalid_id')}
        retryLabel={t('common.go_back')}
        onRetry={() => router.replace('/')}
      />
    );
  }

  if (isLoading) {
    return <PlantLoadingView />;
  }

  if (isError || !plant) {
    return (
      <PlantErrorView
        errorMessage={t('plants.form.load_error')}
        retryLabel={t('list.retry')}
        onRetry={handleRefresh}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar style="light" />

      <PlantDetailDashboard
        plant={plant}
        nextFeedHours={hoursUntil}
        tasks={tasks}
        onBack={handleBack}
        onTaskPress={handleTaskPress}
        onHarvestPress={handleHarvestPress}
        onAdvancedSettings={handleAdvancedSettings}
        onEditPhoto={photoInfo ? handleEditPhoto : undefined}
      />
    </>
  );
}
