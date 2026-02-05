import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, StyleSheet } from 'react-native';
import { showMessage } from 'react-native-flash-message';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import {
  type EdgeInsets,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { type Plant, usePlant } from '@/api/plants';
import { useDeletePlant } from '@/api/plants/use-delete-plant';
import {
  PlantForm,
  type PlantFormValues,
} from '@/components/plants/plant-form';
import { PlantNutrientSection } from '@/components/plants/plant-nutrient-section';
import { ActivityIndicator, ScrollView, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowLeft } from '@/components/ui/icons';
import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { usePlantPhotoEditor } from '@/lib/hooks/use-plant-photo-editor';
import { updatePlantFromForm } from '@/lib/plants/plant-service';
import { syncPlantsToCloud } from '@/lib/plants/plants-sync';
import { captureExceptionIfConsented } from '@/lib/settings/privacy-runtime';

const styles = StyleSheet.create({
  flex1: { flex: 1 },
});

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
    startType: metadata.startType,
    photoperiodType: plant.photoperiodType ?? metadata.photoperiodType,
    environment: plant.environment ?? metadata.environment,
    geneticLean: plant.geneticLean ?? metadata.geneticLean,
    plantedAt: plant.plantedAt,
    medium: metadata.medium,
    potSize: metadata.potSize,
    spaceSize: metadata.spaceSize,
    advancedMode: metadata.advancedMode,
    trainingPrefs: metadata.trainingPrefs,
    lightSchedule: metadata.lightSchedule,
    lightHours: metadata.lightHours,
    height: metadata.height,
    notes: plant.notes ?? metadata.notes,
    imageUrl: plant.imageUrl,
  };
}

type PlantSettingsHeaderProps = {
  insets: EdgeInsets;
  isSaving: boolean;
  onBack: () => void;
  onSave: () => void;
  t: (key: string) => string;
};

type PlantSettingsSaveArgs = {
  plantId: string | null;
  queryClient: ReturnType<typeof useQueryClient>;
  router: ReturnType<typeof useRouter>;
  t: (key: string) => string;
};

function usePlantSettingsSave({
  plantId,
  queryClient,
  router,
  t,
}: PlantSettingsSaveArgs): {
  handleSave: (values: PlantFormValues) => Promise<void>;
  isSaving: boolean;
} {
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSave = React.useCallback(
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
        await queryClient.invalidateQueries({
          queryKey: ['plant', { id: plantId }],
        });
        showMessage({
          message: t('plants.form.update_success_title'),
          description: t('plants.form.update_success_body'),
          type: 'success',
        });
        router.back();
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
    [plantId, queryClient, router, t]
  );

  return { handleSave, isSaving };
}

function PlantSettingsHeader({
  insets,
  isSaving,
  onBack,
  onSave,
  t,
}: PlantSettingsHeaderProps): React.ReactElement {
  return (
    <View
      className="z-40 flex-row items-center justify-between border-b border-neutral-200/50 bg-neutral-50 px-4 pb-3 dark:border-white/10 dark:bg-charcoal-950"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Pressable
        onPress={onBack}
        className="size-10 items-center justify-center rounded-full bg-neutral-200/50 active:scale-95 dark:bg-white/10"
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        accessibilityHint={t('accessibility.common.back_hint')}
        testID="plant-settings-back"
      >
        <ArrowLeft color={colors.white} />
      </Pressable>

      <Text className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
        {t('plants.detail.advanced_settings_title')}
      </Text>

      <Pressable
        onPress={onSave}
        disabled={isSaving}
        className="h-10 items-center justify-center px-2 active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={t('common.save')}
        accessibilityHint={t('accessibility.common.saves_changes')}
        testID="plant-settings-save"
      >
        <Text className="text-base font-bold text-primary-800 dark:text-primary-300">
          {isSaving ? t('common.saving') : t('common.save')}
        </Text>
      </Pressable>
    </View>
  );
}

export default function PlantSettingsModal(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const plantId = React.useMemo(() => (id ? String(id) : null), [id]);

  const {
    data: plant,
    isLoading,
    isError,
  } = usePlant({ id: plantId ?? '' }, { enabled: Boolean(plantId) });

  const { handlePhotoInfo } = usePlantPhotoEditor({
    plantId,
  });

  const { mutate: deletePlant } = useDeletePlant({
    onSuccess: () => {
      router.replace('/'); // Go back to home
    },
    onError: (error: Error) => {
      console.error('[DeletePlant] failed', error);
      showMessage({
        message: t('plants.form.error_title'),
        description: t('plants.form.error_body'),
        type: 'danger',
      });
    },
  });

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

  const { handleSave, isSaving } = usePlantSettingsSave({
    plantId,
    queryClient,
    router,
    t,
  });
  const submitHandlerRef = React.useRef<() => void>(() => {});

  const handleSubmitReady = React.useCallback((submit: () => void) => {
    submitHandlerRef.current = submit;
  }, []);

  const onHeaderSave = () => {
    haptics.selection();
    submitHandlerRef.current();
  };

  const defaultValues = React.useMemo(
    () => (plant ? buildDefaultValues(plant) : undefined),
    [plant]
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50 dark:bg-charcoal-950">
        <ActivityIndicator />
      </View>
    );
  }

  if (!plantId || isError || !plant) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50 dark:bg-charcoal-950">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {t('plants.form.error_title')}
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="mt-3 rounded-full bg-neutral-200 px-4 py-2 dark:bg-white/10"
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          accessibilityHint={t('accessibility.common.back_hint')}
        >
          <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
            {t('common.back')}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Modal Header - Sticky with safe area */}
      <PlantSettingsHeader
        insets={insets}
        isSaving={isSaving}
        onBack={() => router.back()}
        onSave={onHeaderSave}
        t={t}
      />

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-6 p-4 pb-32"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stats Section (pH/EC) */}
          <PlantNutrientSection plantId={plantId} />

          {/* Form Sections */}
          <PlantForm
            key={plantId}
            defaultValues={defaultValues}
            onSubmit={handleSave}
            isSubmitting={isSaving}
            onSubmitReady={handleSubmitReady}
            onDelete={handleDelete}
            onPhotoInfo={handlePhotoInfo}
            renderAsFragment
            plantId={plantId}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
