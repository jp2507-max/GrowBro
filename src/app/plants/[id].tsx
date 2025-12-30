import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Plant, usePlant } from '@/api/plants';
import { useDeletePlant } from '@/api/plants/use-delete-plant';
import { PlantActionHub } from '@/components/plants/plant-action-hub';
import { PlantAssessmentHistorySection } from '@/components/plants/plant-assessment-history-section';
import { PlantDetailHeader } from '@/components/plants/plant-detail-header';
import {
  PlantForm,
  type PlantFormValues,
  type PlantPhotoInfo,
} from '@/components/plants/plant-form';
import { PlantStatsGrid } from '@/components/plants/plant-stats-grid';
import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  Pressable,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowRight } from '@/components/ui/icons';
import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { usePlantPhotoEditor } from '@/lib/hooks/use-plant-photo-editor';
import { usePlantTasks } from '@/lib/hooks/use-plant-tasks';
import { updatePlantFromForm } from '@/lib/plants/plant-service';
import { syncPlantsToCloud } from '@/lib/plants/plants-sync';
import { captureExceptionIfConsented } from '@/lib/settings/privacy-runtime';

function PlantLoadingView(): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-50 dark:bg-charcoal-950">
      <ActivityIndicator />
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
    <View className="flex-1 items-center justify-center bg-neutral-50 dark:bg-charcoal-950">
      <Text className="mb-3 text-base text-neutral-700 dark:text-neutral-200">
        {errorMessage}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityHint={t('accessibility.common.retry_hint')}
        testID="plant-error-retry"
        className="active:opacity-70"
      >
        <Text className="text-primary-700 dark:text-primary-300">
          {retryLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function buildDefaultValues(plant: Plant): PlantFormValues {
  const metadata = plant.metadata ?? {};
  return {
    name: plant.name,
    strain: plant.strain,
    strainId: metadata.strainId,
    strainSlug: metadata.strainSlug,
    strainSource: metadata.strainSource,
    strainRace: metadata.strainRace,
    stage: plant.stage,
    photoperiodType: plant.photoperiodType ?? metadata.photoperiodType,
    environment: plant.environment ?? metadata.environment,
    geneticLean: plant.geneticLean ?? metadata.geneticLean,
    plantedAt: plant.plantedAt,
    medium: metadata.medium,
    potSize: metadata.potSize,
    lightSchedule: metadata.lightSchedule,
    lightHours: metadata.lightHours,
    height: metadata.height,
    notes: plant.notes ?? metadata.notes,
    imageUrl: plant.imageUrl,
  };
}

type PlantContentSheetProps = {
  plant: Plant;
  plantId: string;
  linkedStrainSlug: string | null;
  showAssessmentHistory: boolean;
  isSaving: boolean;
  defaultValues: PlantFormValues | undefined;
  tasks: { id: string; title: string; type?: 'water' | 'feed' | 'other' }[];
  handleSubmit: (values: PlantFormValues) => Promise<void>;
  handleSubmitReady: (submit: () => void) => void;
  handleDelete: () => void;
  handleOpenStrain: () => void;
  handleHeaderSave: () => void;
  handleTaskPress: (taskId: string) => void;
  handleHarvestPress: () => void;
  handlePhotoInfo: (info: PlantPhotoInfo) => void;
  insets: ReturnType<typeof useSafeAreaInsets>;
  t: ReturnType<typeof useTranslation>['t'];
};

function PlantContentSheet({
  plant,
  plantId,
  linkedStrainSlug,
  showAssessmentHistory,
  isSaving,
  defaultValues,
  tasks,
  handleSubmit,
  handleSubmitReady,
  handleDelete,
  handleOpenStrain,
  handleHeaderSave,
  handleTaskPress,
  handleHarvestPress,
  handlePhotoInfo,
  insets,
  t,
}: PlantContentSheetProps): React.ReactElement {
  return (
    <View className="z-10 -mt-8 flex-1 rounded-t-[35px] bg-white shadow-xl dark:bg-charcoal-900">
      {/* Handle Bar */}
      <View className="my-4 h-1.5 w-12 self-center rounded-full bg-neutral-200 dark:bg-white/20" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-[72px]"
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Grid */}
        <PlantStatsGrid plant={plant} />

        {/* Action Hub */}
        <View className="mt-6">
          <PlantActionHub
            plantId={plantId}
            plantStage={plant.stage}
            tasks={tasks}
            onTaskPress={handleTaskPress}
            onHarvestPress={handleHarvestPress}
          />
        </View>

        <PlantAssessmentHistorySection
          plantId={plantId}
          initiallyExpanded={showAssessmentHistory}
          testID="plant-detail-assessment-history"
        />

        {/* Strain Profile Link - Subtle text link style */}
        {linkedStrainSlug ? (
          <Pressable
            onPress={handleOpenStrain}
            className="flex-row items-center justify-center py-4 active:opacity-70"
            accessibilityLabel={t('plants.form.view_strain_profile')}
            accessibilityHint={t('plants.form.view_strain_profile_hint')}
            accessibilityRole="button"
            testID="view-strain-profile"
          >
            <Text className="mr-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">
              {t('plants.detail.strain_profile_link')}
            </Text>
            <ArrowRight color={colors.neutral[400]} width={14} height={14} />
          </Pressable>
        ) : null}

        {/* Divider */}
        <View className="mx-4 my-6 h-px bg-neutral-200 dark:bg-white/10" />

        {/* Form Sections (fragment mode to avoid nested ScrollView) */}
        <PlantForm
          key={plantId}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isSubmitting={isSaving}
          onSubmitReady={handleSubmitReady}
          onDelete={handleDelete}
          onPhotoInfo={handlePhotoInfo}
          renderAsFragment
          plantId={plantId}
        />
      </ScrollView>

      {/* Floating Save Button */}
      <View
        className="absolute inset-x-0 bottom-0 bg-white/95 px-4 pt-3 dark:bg-charcoal-900/95"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        <Button
          variant="default"
          className="h-auto w-full rounded-2xl bg-terracotta-500 py-4 active:bg-terracotta-600"
          textClassName="text-white text-lg font-semibold"
          onPress={handleHeaderSave}
          disabled={isSaving}
          loading={isSaving}
          label={t('plants.form.save_cta')}
          testID="plant-save-cta"
        />
      </View>
    </View>
  );
}

type PlantDetailHandlersDeps = {
  plantId: string | null;
  linkedStrainSlug: string | null;
  deletePlant: (id: string) => void;
  refetch: () => void;
  router: ReturnType<typeof useRouter>;
  t: ReturnType<typeof useTranslation>['t'];
};

function usePlantDetailHandlers(deps: PlantDetailHandlersDeps) {
  const { plantId, linkedStrainSlug, deletePlant, refetch, router, t } = deps;
  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  const handleBack = React.useCallback(() => {
    haptics.selection();
    router.replace('/');
  }, [router]);

  const handleOpenStrain = React.useCallback(() => {
    if (!linkedStrainSlug) return;
    haptics.selection();
    router.push(`/strains/${linkedStrainSlug}`);
  }, [linkedStrainSlug, router]);

  const submitHandlerRef = React.useRef<() => void>(() => {});

  const handleSubmitReady = React.useCallback((submit: () => void) => {
    submitHandlerRef.current = submit;
  }, []);

  const handleHeaderSave = React.useCallback(() => {
    haptics.selection();
    submitHandlerRef.current();
  }, []);

  const handleDelete = React.useCallback(() => {
    if (!plantId) return;
    Alert.alert(
      t('plants.form.delete_confirm_title'),
      t('plants.form.delete_confirm_body'),
      [
        { text: t('plants.form.cancel'), style: 'cancel' },
        {
          text: t('plants.form.delete_confirm_action'),
          style: 'destructive',
          onPress: () => deletePlant(plantId),
        },
      ]
    );
  }, [deletePlant, plantId, t]);

  const handleTaskPress = React.useCallback(
    (taskId: string) => {
      haptics.selection();
      router.push(`/calendar?taskId=${taskId}`);
    },
    [router]
  );

  return {
    handleRefresh,
    handleBack,
    handleOpenStrain,
    handleSubmitReady,
    handleHeaderSave,
    handleDelete,
    handleTaskPress,
  };
}

function usePlantSubmit(
  plantId: string | null,
  queryClient: ReturnType<typeof useQueryClient>,
  t: ReturnType<typeof useTranslation>['t']
): {
  isSaving: boolean;
  handleSubmit: (values: PlantFormValues) => Promise<void>;
} {
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSubmit = React.useCallback(
    async (values: PlantFormValues) => {
      if (!plantId) return;
      try {
        setIsSaving(true);
        const userId = await getOptionalAuthenticatedUserId();
        await updatePlantFromForm(
          plantId,
          { ...values },
          { userId: userId ?? undefined }
        );
        await syncPlantsToCloud().catch((syncError) => {
          console.error('[UpdatePlant] sync to cloud failed', syncError);
          captureExceptionIfConsented(
            syncError instanceof Error
              ? syncError
              : new Error(String(syncError)),
            { context: 'plant-update-sync', plantId }
          );
        });
        await queryClient.invalidateQueries({ queryKey: ['plants-infinite'] });
        await queryClient.invalidateQueries({ queryKey: ['plant', plantId] });
        showMessage({
          message: t('plants.form.update_success_title'),
          description: t('plants.form.update_success_body'),
          type: 'success',
        });
      } catch (error) {
        console.error('[UpdatePlant] failed', error);
        showMessage({
          message: t('plants.form.error_title'),
          description: t('plants.form.error_body'),
          type: 'danger',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [plantId, queryClient, t]
  );

  return { isSaving, handleSubmit };
}

export default function PlantDetailScreen(): React.ReactElement | null {
  const { id, showAssessments } = useLocalSearchParams<{
    id: string;
    showAssessments?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const plantId = React.useMemo(() => (id ? String(id) : null), [id]);

  const {
    data: plant,
    isLoading,
    isError,
    refetch,
  } = usePlant({ id: plantId ?? '' }, { enabled: Boolean(plantId) });

  const { isSaving, handleSubmit } = usePlantSubmit(plantId, queryClient, t);

  const { mutate: deletePlant } = useDeletePlant({
    onSuccess: () => router.replace('/'),
    onError: (error: Error) => {
      console.error('[DeletePlant] failed', error);
      showMessage({
        message: t('plants.form.error_title'),
        description: t('plants.form.error_body'),
        type: 'danger',
      });
    },
  });

  // Fetch today's tasks for this plant
  const { tasks } = usePlantTasks(plantId ?? '', { enabled: Boolean(plantId) });

  // Photo editing via extracted hook
  const { photoInfo, handlePhotoInfo, handleEditPhoto } = usePlantPhotoEditor({
    plantId,
  });

  const defaultValues = React.useMemo(
    () => (plant ? buildDefaultValues(plant) : undefined),
    [plant]
  );
  const linkedStrainSlug = React.useMemo(() => {
    if (!plant) return null;
    return plant.metadata?.strainSlug ?? plant.metadata?.strainId ?? null;
  }, [plant]);

  const {
    handleRefresh,
    handleBack,
    handleOpenStrain,
    handleSubmitReady,
    handleHeaderSave,
    handleDelete,
    handleTaskPress,
  } = usePlantDetailHandlers({
    plantId,
    linkedStrainSlug,
    deletePlant,
    refetch,
    router,
    t,
  });

  const handleHarvestPress = React.useCallback(() => {
    if (!plantId) return;
    haptics.selection();
    router.push({
      pathname: '/(modals)/harvest',
      params: { plantId },
    });
  }, [plantId, router]);

  const showAssessmentHistory = showAssessments === 'true';

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
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar style="light" />

      {/* Hero Image Header */}
      <PlantDetailHeader
        plant={plant}
        onBack={handleBack}
        onEditPhoto={photoInfo ? handleEditPhoto : undefined}
      />

      {/* Overlapping White Content Sheet */}
      <PlantContentSheet
        plant={plant}
        plantId={plantId}
        linkedStrainSlug={linkedStrainSlug}
        showAssessmentHistory={showAssessmentHistory}
        isSaving={isSaving}
        defaultValues={defaultValues}
        tasks={tasks}
        handleSubmit={handleSubmit}
        handleSubmitReady={handleSubmitReady}
        handleDelete={handleDelete}
        handleOpenStrain={handleOpenStrain}
        handleHeaderSave={handleHeaderSave}
        handleTaskPress={handleTaskPress}
        handleHarvestPress={handleHarvestPress}
        handlePhotoInfo={handlePhotoInfo}
        insets={insets}
        t={t}
      />
    </View>
  );
}
