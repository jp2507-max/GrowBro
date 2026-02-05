import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlant } from '@/api/plants';
import {
  ActivityIndicator,
  Button,
  Input,
  type OptionType,
  ScrollView,
  Select,
  Text,
  View,
} from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowLeft } from '@/components/ui/icons';
import { DigitalTwinTaskEngine } from '@/lib/digital-twin';
import { haptics } from '@/lib/haptics';
import { PlantEventKind, recordPlantEvent } from '@/lib/plants/plant-events';

type TriState = 'yes' | 'no' | 'unsure';
type DrynessSeverity = 'mild' | 'moderate' | 'severe';
type CheckInSource = 'checkin' | 'task_outcome';

type DrynessCheckInPayloadV1 = {
  version: 1;
  source: CheckInSource;
  symptom: 'dryness';
  severity: DrynessSeverity;
  topDry: TriState;
  wateredLast12h: TriState;
  medium?: string;
  note?: string;
  symptomCaseId: string;
  sourceTaskId?: string;
  sourceTaskEngineKey?: string;
};

const styles = StyleSheet.create({
  flex1: { flex: 1 },
});

function buildTriStateOptions(t: (key: string) => string): OptionType[] {
  return [
    { value: 'yes', label: t('common.yes'), icon: '✅' },
    { value: 'no', label: t('common.no'), icon: '❌' },
    { value: 'unsure', label: t('common.unsure'), icon: '❓' },
  ];
}

function buildSeverityOptions(t: (key: string) => string): OptionType[] {
  return [
    {
      value: 'mild',
      label: t('plants.detail.check_in.severity.mild'),
      icon: '🙂',
    },
    {
      value: 'moderate',
      label: t('plants.detail.check_in.severity.moderate'),
      icon: '😕',
    },
    {
      value: 'severe',
      label: t('plants.detail.check_in.severity.severe'),
      icon: '😟',
    },
  ];
}

function getParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseCheckInSource(
  value: string | string[] | undefined
): CheckInSource {
  const raw = getParam(value);
  return raw === 'task_outcome' ? 'task_outcome' : 'checkin';
}

function PlantCheckInHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-row items-center justify-between border-b border-white/10 bg-charcoal-950 px-4 pb-3"
      style={{ paddingTop: insets.top + 8 }}
    >
      <Pressable
        onPress={onBack}
        className="size-12 items-center justify-center rounded-full active:bg-white/10"
        accessibilityRole="button"
        accessibilityLabel={title}
        testID="plant-check-in-back"
      >
        <ArrowLeft color={colors.white} width={24} height={24} />
      </Pressable>

      <Text className="text-lg font-bold text-white">{title}</Text>

      {/* Spacer for symmetry */}
      <View className="size-12" />
    </View>
  );
}

export default function PlantCheckInModal(): React.ReactElement {
  const router = useRouter();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams();

  const plantId = React.useMemo(
    () => getParam(params.plantId) ?? null,
    [params.plantId]
  );
  const source = React.useMemo(
    () => parseCheckInSource(params.source),
    [params.source]
  );
  const sourceTaskId = React.useMemo(
    () => getParam(params.sourceTaskId),
    [params.sourceTaskId]
  );
  const sourceTaskEngineKey = React.useMemo(
    () => getParam(params.sourceTaskEngineKey),
    [params.sourceTaskEngineKey]
  );

  const { data: plant, isLoading } = usePlant(
    { id: plantId ?? '' },
    { enabled: Boolean(plantId) }
  );

  const [severity, setSeverity] = React.useState<DrynessSeverity>('moderate');
  const [topDry, setTopDry] = React.useState<TriState>('unsure');
  const [wateredLast12h, setWateredLast12h] =
    React.useState<TriState>('unsure');
  const [note, setNote] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const triStateOptions = React.useMemo(() => buildTriStateOptions(t), [t]);
  const severityOptions = React.useMemo(() => buildSeverityOptions(t), [t]);

  const title = t('plants.detail.check_in.title');

  const handleBack = React.useCallback(() => {
    haptics.selection();
    router.back();
  }, [router]);

  const handleSubmit = React.useCallback(async () => {
    if (!plantId) return;

    try {
      setIsSubmitting(true);

      const symptomCaseId = randomUUID();
      const payload: DrynessCheckInPayloadV1 = {
        version: 1,
        source,
        symptom: 'dryness',
        severity,
        topDry,
        wateredLast12h,
        medium: plant?.metadata?.medium ?? undefined,
        note: note.trim() ? note.trim() : undefined,
        symptomCaseId,
        sourceTaskId: sourceTaskId ?? undefined,
        sourceTaskEngineKey: sourceTaskEngineKey ?? undefined,
      };

      await recordPlantEvent({
        plantId,
        kind: PlantEventKind.SYMPTOM_LOGGED,
        payload: payload as unknown as Record<string, unknown>,
      });

      // Make the plan feel immediate: run sync now (idempotent) and refresh queries.
      const engine = new DigitalTwinTaskEngine();
      await engine.syncForPlantId(plantId);

      await queryClient.invalidateQueries({
        queryKey: ['plant-tasks', plantId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['plant', { id: plantId }],
      });

      router.back();
    } catch (error) {
      console.warn('[PlantCheckIn] submit failed', error);
      // Keep UX simple: user can retry; no hard crash.
    } finally {
      setIsSubmitting(false);
    }
  }, [
    note,
    plant?.metadata?.medium,
    plantId,
    queryClient,
    router,
    severity,
    source,
    sourceTaskEngineKey,
    sourceTaskId,
    topDry,
    wateredLast12h,
  ]);

  if (!plantId) {
    return (
      <View className="flex-1 bg-charcoal-950">
        <Stack.Screen options={{ headerShown: false }} />
        <PlantCheckInHeader title={title} onBack={handleBack} />
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-neutral-200">
            {t('plants.form.invalid_id')}
          </Text>
        </View>
      </View>
    );
  }

  const content = (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-5 px-4 pb-10 pt-5"
      keyboardShouldPersistTaps="handled"
      testID="plant-check-in-scroll"
    >
      <View className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <Text className="text-base font-semibold text-white">
          {t('plants.detail.check_in.dryness.title')}
        </Text>
        <Text className="mt-1 text-sm text-neutral-300">
          {t('plants.detail.check_in.dryness.subtitle')}
        </Text>
      </View>

      <Select
        label={t('plants.detail.check_in.severity.label')}
        value={severity}
        onSelect={(value) => setSeverity(value as DrynessSeverity)}
        options={severityOptions}
        testID="check-in-severity"
        placeholder={t('common.select')}
      />

      <Select
        label={t('plants.detail.check_in.top_dry.label')}
        value={topDry}
        onSelect={(value) => setTopDry(value as TriState)}
        options={triStateOptions}
        testID="check-in-top-dry"
        placeholder={t('common.select')}
      />

      <Select
        label={t('plants.detail.check_in.watered_last_12h.label')}
        value={wateredLast12h}
        onSelect={(value) => setWateredLast12h(value as TriState)}
        options={triStateOptions}
        testID="check-in-watered-last-12h"
        placeholder={t('common.select')}
      />

      <Input
        label={t('plants.detail.check_in.note.label')}
        value={note}
        onChangeText={setNote}
        placeholder={t('plants.detail.check_in.note.placeholder')}
        testID="check-in-note"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <View className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <Text className="text-xs text-neutral-300">
          {t('plants.detail.check_in.disclaimer')}
        </Text>
      </View>

      <Button
        label={t('plants.detail.check_in.submit')}
        onPress={handleSubmit}
        loading={isSubmitting}
        disabled={isSubmitting || isLoading}
        testID="plant-check-in-submit"
      />
    </ScrollView>
  );

  return (
    <View className="flex-1 bg-charcoal-950">
      <Stack.Screen options={{ headerShown: false }} />
      <PlantCheckInHeader title={title} onBack={handleBack} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="white" />
        </View>
      ) : Platform.OS === 'ios' ? (
        content
      ) : (
        <KeyboardAvoidingView
          style={styles.flex1}
          behavior="padding"
          keyboardVerticalOffset={10}
        >
          {content}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
