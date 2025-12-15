import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Plant, usePlant } from '@/api/plants';
import { useDeletePlant } from '@/api/plants/use-delete-plant';
import {
  PlantForm,
  type PlantFormValues,
} from '@/components/plants/plant-form';
import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  Text,
  View,
} from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowLeft, ArrowRight } from '@/components/ui/icons';
import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { updatePlantFromForm } from '@/lib/plants/plant-service';
import { syncPlantsToCloud } from '@/lib/plants/plants-sync';

type HeaderBarProps = {
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
  saveLabel: string;
};

function HeaderBar({ onBack, onSave, isSaving, saveLabel }: HeaderBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <View
      className="absolute inset-x-0 top-0 z-10 flex-row items-center justify-between px-4"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Back Button */}
      <Button
        variant="outline"
        size="circle"
        fullWidth={false}
        onPress={onBack}
        className="border-0 bg-white/90 shadow-sm dark:bg-charcoal-800/90"
        accessibilityLabel={t('accessibility.common.go_back')}
        accessibilityHint={t('accessibility.common.return_to_previous')}
        testID="header-back-button"
      >
        <ArrowLeft color={colors.neutral[900]} width={22} height={22} />
      </Button>

      {/* Done Button - Things 3 style pill */}
      <Button
        variant="pill"
        size="sm"
        fullWidth={false}
        onPress={onSave}
        disabled={isSaving}
        loading={isSaving}
        label={saveLabel}
        className="min-w-[72px] px-5 shadow-sm"
        accessibilityHint={t('accessibility.common.saves_changes')}
        testID="header-save-button"
      />
    </View>
  );
}

function PlantLoadingView(): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center bg-background">
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
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="mb-3 text-base text-neutral-700 dark:text-neutral-200">
        {errorMessage}
      </Text>
      <Text
        className="text-primary-700 dark:text-primary-300"
        accessibilityRole="button"
        onPress={onRetry}
      >
        {retryLabel}
      </Text>
    </View>
  );
}

type StrainProfileButtonProps = {
  topOffset: number;
  label: string;
  hint: string;
  onPress: () => void;
};

function StrainProfileButton({
  topOffset,
  label,
  hint,
  onPress,
}: StrainProfileButtonProps): React.ReactElement {
  return (
    <View className="px-4 pb-2" style={{ marginTop: topOffset }}>
      <Button
        variant="outline"
        onPress={onPress}
        className="h-auto flex-row items-center justify-between rounded-xl border-neutral-200 bg-white/80 px-4 py-3 dark:border-neutral-700 dark:bg-charcoal-900/80"
        accessibilityLabel={label}
        accessibilityHint={hint}
        testID="view-strain-profile"
      >
        <View className="flex-1 flex-row items-center justify-between">
          <Text className="text-base font-medium text-primary-700 dark:text-primary-400">
            {label}
          </Text>
          <ArrowRight color={colors.primary[600]} width={16} height={16} />
        </View>
      </Button>
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
    notes: plant.notes ?? metadata.notes,
    imageUrl: plant.imageUrl,
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
        await syncPlantsToCloud().catch(() => {});
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
  const { id } = useLocalSearchParams<{ id: string }>();
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
    onSuccess: () => router.back(),
    onError: (error: Error) => {
      console.error('[DeletePlant] failed', error);
      showMessage({
        message: t('plants.form.error_title'),
        description: t('plants.form.error_body'),
        type: 'danger',
      });
    },
  });

  const defaultValues = React.useMemo(
    () => (plant ? buildDefaultValues(plant) : undefined),
    [plant]
  );
  const linkedStrainSlug = React.useMemo(() => {
    if (!plant) return null;
    return plant.metadata?.strainSlug ?? plant.metadata?.strainId ?? null;
  }, [plant]);

  const handleRefresh = React.useCallback(() => {
    refetch();
  }, [refetch]);

  const handleBack = React.useCallback(() => {
    haptics.selection();
    router.back();
  }, [router]);

  const handleOpenStrain = React.useCallback(() => {
    if (!linkedStrainSlug) return;
    haptics.selection();
    router.push(`/strains/${linkedStrainSlug}`);
  }, [linkedStrainSlug, router]);

  // Store submit handler from form
  const submitHandlerRef = React.useRef<(() => void) | null>(null);

  const handleSubmitReady = React.useCallback((submit: () => void) => {
    submitHandlerRef.current = submit;
  }, []);

  const handleHeaderSave = React.useCallback(() => {
    haptics.selection();
    submitHandlerRef.current?.();
  }, []);

  const handleDelete = React.useCallback(() => {
    if (!plantId) return;

    Alert.alert(
      t('plants.form.delete_confirm_title'),
      t('plants.form.delete_confirm_body'),
      [
        {
          text: t('plants.form.cancel'),
          style: 'cancel',
        },
        {
          text: t('plants.form.delete_confirm_action'),
          style: 'destructive',
          onPress: () => deletePlant(plantId),
        },
      ]
    );
  }, [deletePlant, plantId, t]);

  if (!plantId) {
    return null;
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
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar />
      <HeaderBar
        onBack={handleBack}
        onSave={handleHeaderSave}
        isSaving={isSaving}
        saveLabel={t('common.done')}
      />
      {linkedStrainSlug ? (
        <StrainProfileButton
          topOffset={insets.top + 56}
          label={t('plants.form.view_strain_profile')}
          hint={t('plants.form.view_strain_profile_hint')}
          onPress={handleOpenStrain}
        />
      ) : null}
      <PlantForm
        key={plantId}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        onSubmitReady={handleSubmitReady}
        onDelete={handleDelete}
      />
    </View>
  );
}
