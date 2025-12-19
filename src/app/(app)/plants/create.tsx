import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { DateTime } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { showMessage } from 'react-native-flash-message';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Plant } from '@/api/plants/types';
import {
  PlantForm,
  type PlantFormValues,
} from '@/components/plants/plant-form';
import {
  Button,
  FocusAwareStatusBar,
  Modal,
  Pressable,
  Text,
  View,
} from '@/components/ui';
import { ArrowLeft } from '@/components/ui/icons';
import { useModal } from '@/components/ui/modal';
import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { haptics } from '@/lib/haptics';
import { createPlantFromForm, toPlant } from '@/lib/plants/plant-service';
import { syncPlantsToCloud } from '@/lib/plants/plants-sync';
import { createTask } from '@/lib/task-manager';

type SubmitHookParams = {
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setCreatedPlant: React.Dispatch<React.SetStateAction<Plant | null>>;
  successModal: ReturnType<typeof useModal>;
  queryClient: ReturnType<typeof useQueryClient>;
  t: (key: string) => string;
};

function usePlantSubmit({
  setIsSaving,
  setCreatedPlant,
  successModal,
  queryClient,
  t,
}: SubmitHookParams) {
  return React.useCallback(
    async (values: PlantFormValues) => {
      try {
        setIsSaving(true);
        const userId = await getOptionalAuthenticatedUserId();
        const model = await createPlantFromForm(
          {
            name: values.name,
            stage: values.stage,
            strain: values.strain,
            strainId: values.strainId,
            strainSlug: values.strainSlug,
            strainSource: values.strainSource,
            strainRace: values.strainRace,
            plantedAt: values.plantedAt,
            photoperiodType: values.photoperiodType,
            environment: values.environment,
            geneticLean: values.geneticLean,
            medium: values.medium,
            potSize: values.potSize,
            lightSchedule: values.lightSchedule,
            lightHours: values.lightHours,
            height: values.height,
            notes: values.notes,
            imageUrl: values.imageUrl,
          },
          { userId: userId ?? undefined }
        );
        const plant = toPlant(model);
        setCreatedPlant(plant);
        successModal.present();
        syncPlantsToCloud().catch(() => {
          /* non-blocking */
        });
        queryClient
          .invalidateQueries({ queryKey: ['plants-infinite'] })
          .catch(() => {
            /* non-blocking */
          });
        showMessage({
          message: t('plants.form.success_title'),
          description: t('plants.form.success_body'),
          type: 'success',
          duration: 2200,
        });
      } catch (error) {
        console.error('[CreatePlant] failed', error);
        showMessage({
          message: t('plants.form.error_title'),
          description: t('plants.form.error_body'),
          type: 'danger',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [queryClient, setCreatedPlant, setIsSaving, successModal, t]
  );
}

type StarterTasksParams = {
  createdPlantId?: string;
  t: (key: string) => string;
};

function useStarterTasks({ createdPlantId, t }: StarterTasksParams) {
  return React.useCallback(async () => {
    if (!createdPlantId) return;
    try {
      const timezone = DateTime.local().zoneName;
      const dueAtLocal = DateTime.local().plus({ days: 1 }).toISO();
      await createTask({
        title: t('plants.form.default_water_title'),
        description: t('plants.form.default_water_desc'),
        timezone,
        dueAtLocal,
        plantId: createdPlantId,
        metadata: { category: 'water' },
      });
      showMessage({
        message: t('plants.form.starter_tasks_created'),
        type: 'success',
      });
    } catch (error) {
      console.error('[CreatePlant] starter tasks failed', error);
      showMessage({
        message: t('plants.form.error_title'),
        description: t('plants.form.error_body'),
        type: 'danger',
      });
    }
  }, [createdPlantId, t]);
}

type AddedModalProps = {
  modal: ReturnType<typeof useModal>;
  t: (key: string) => string;
  onGoToSchedule: () => void;
  onAddStarter: () => void;
  onViewPlant: () => void;
  onAddAnother: () => void;
};

function PlantAddedModal({
  modal,
  t,
  onGoToSchedule,
  onAddStarter,
  onViewPlant,
  onAddAnother,
}: AddedModalProps) {
  return (
    <Modal
      ref={modal.ref}
      snapPoints={['45%']}
      title={t('plants.form.added_title')}
      testID="plant-added-sheet"
    >
      <View className="gap-4 px-4 pb-6">
        <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
          {t('plants.form.added_title')}
        </Text>
        <Text className="text-base text-neutral-700 dark:text-neutral-200">
          {t('plants.form.added_body')}
        </Text>
        <View className="gap-3">
          <Button
            onPress={onGoToSchedule}
            className="w-full"
            testID="plant-added-schedule"
            label={t('plants.form.go_to_schedule')}
          />
          <Button
            onPress={onAddStarter}
            variant="secondary"
            className="w-full"
            testID="plant-added-starter-tasks"
            label={t('plants.form.add_starter_tasks')}
          />
          <Button
            onPress={onViewPlant}
            variant="outline"
            className="w-full"
            testID="plant-added-view"
            label={t('plants.form.view_plant')}
          />
          <Button
            onPress={onAddAnother}
            variant="ghost"
            className="w-full"
            testID="plant-added-keep-adding"
            label={t('plants.form.keep_adding')}
          />
        </View>
      </View>
    </Modal>
  );
}

export default function CreatePlantScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    returnTo?: string;
    playbookId?: string;
  }>();
  const queryClient = useQueryClient();
  const successModal = useModal();
  const [createdPlant, setCreatedPlant] = React.useState<Plant | null>(null);
  const [formKey, setFormKey] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const submitHandlerRef = React.useRef<(() => void) | null>(null);

  const handleSubmit = usePlantSubmit({
    setIsSaving,
    setCreatedPlant,
    successModal,
    queryClient,
    t,
  });

  const handleViewPlant = React.useCallback(() => {
    successModal.dismiss();
    if (createdPlant?.id) {
      router.replace(`/plants/${createdPlant.id}`);
    }
  }, [createdPlant?.id, router, successModal]);

  const handleGoToSchedule = React.useCallback(() => {
    successModal.dismiss();
    router.push('/calendar');
  }, [router, successModal]);

  const handleAddAnother = React.useCallback(() => {
    successModal.dismiss();
    setCreatedPlant(null);
    setFormKey((key) => key + 1);
  }, [successModal]);

  const handleCreateStarterTasks = useStarterTasks({
    createdPlantId: createdPlant?.id,
    t,
  });

  const handleComplete = React.useCallback(() => {
    haptics.selection();
    if (params?.returnTo) {
      router.replace(params.returnTo);
    } else {
      router.back();
    }
  }, [params?.returnTo, router]);

  const handleSubmitReady = React.useCallback((submit: () => void) => {
    submitHandlerRef.current = submit;
  }, []);

  const handleHeaderSave = React.useCallback(() => {
    haptics.selection();
    submitHandlerRef.current?.();
  }, []);

  const insets = useSafeAreaInsets();
  const [completion, setCompletion] = React.useState(0);

  const handleProgressChange = React.useCallback((progress: number) => {
    setCompletion(progress);
  }, []);

  return (
    <View className="flex-1 bg-primary-900 dark:bg-primary-800">
      <Stack.Screen options={{ headerShown: false }} />
      <FocusAwareStatusBar style="light" />

      {/* Premium Organic Header */}
      <View
        className="bg-primary-900 px-6 pb-20 dark:bg-primary-800"
        style={{ paddingTop: insets.top + 12 }}
      >
        {/* Back Button */}
        <Pressable
          onPress={handleComplete}
          className="mb-4 size-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          accessibilityHint={t('accessibility.common.return_to_previous')}
          testID="header-back-button"
        >
          <ArrowLeft color="#fff" width={22} height={22} />
        </Pressable>

        {/* Title */}
        <Text className="text-3xl font-bold tracking-tight text-white">
          {t('plants.form.create_title')}
        </Text>

        {/* Completion subtext */}
        <Text className="mt-1 text-sm font-medium uppercase tracking-widest text-primary-200">
          {t('plants.form.completion', { percent: completion })}
        </Text>

        {/* Progress bar with terracotta color */}
        <View className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/20">
          <View
            className="h-full rounded-full bg-terracotta-500"
            style={{ width: `${Math.min(100, Math.max(0, completion))}%` }}
          />
        </View>
      </View>

      {/* Overlapping White Content Sheet */}
      <View className="z-10 -mt-10 flex-1">
        <View className="flex-1 rounded-t-[35px] bg-white shadow-xl dark:bg-charcoal-900">
          {/* Handle Bar */}
          <View className="mb-2 mt-4 h-1.5 w-12 self-center rounded-full bg-neutral-200" />

          <PlantForm
            key={formKey}
            onSubmit={handleSubmit}
            isSubmitting={isSaving}
            onSubmitReady={handleSubmitReady}
            onProgressChange={handleProgressChange}
          />

          {/* Floating CTA Button */}
          <View
            className="absolute inset-x-0 bottom-0 bg-white/95 px-4 pt-3 dark:bg-charcoal-900/95"
            style={{ paddingBottom: insets.bottom + 8 }}
          >
            <Button
              variant="default"
              className="w-full rounded-2xl bg-terracotta-500 py-4 active:bg-terracotta-600"
              textClassName="text-white text-lg font-semibold"
              onPress={handleHeaderSave}
              disabled={isSaving}
              loading={isSaving}
              label={t('plants.form.create_cta')}
              testID="create-plant-cta"
            />
          </View>
        </View>
      </View>

      <PlantAddedModal
        modal={successModal}
        t={t}
        onGoToSchedule={handleGoToSchedule}
        onAddStarter={handleCreateStarterTasks}
        onViewPlant={handleViewPlant}
        onAddAnother={handleAddAnother}
      />
    </View>
  );
}
