/**
 * Template Detail/Edit Screen
 *
 * View and edit individual feeding templates with strain adjustments.
 * Supports both existing templates and new template creation.
 *
 * Requirements: 1.1, 1.2, 4.7
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { FeedingTemplateForm } from '@/components/nutrient-engine/feeding-template-form';
import { SafeAreaView, Text, View } from '@/components/ui';
import type { FeedingTemplateFormData } from '@/lib/nutrient-engine/schemas/feeding-template-schema';
import {
  createTemplate,
  getTemplate,
  updateTemplate,
} from '@/lib/nutrient-engine/services/template-service';
import { database } from '@/lib/watermelon';

export default function TemplateDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [template, setTemplate] =
    React.useState<FeedingTemplateFormData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const isNew = id === 'new';

  React.useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }

    async function loadTemplate() {
      try {
        const loaded = await getTemplate(database, id);
        if (loaded) {
          setTemplate({
            name: loaded.name,
            medium: loaded.medium,
            phases: loaded.phases.map((phase) => ({
              phase: phase.phase,
              durationDays: phase.durationDays,
              nutrients: phase.nutrients.map((n) => ({
                nutrient: n.nutrient,
                value: n.value,
                unit: n.unit as 'ml/L' | 'ppm' | 'g/L',
              })),
              phRange: phase.phRange,
              ecRange25c: phase.ecRange25c,
            })),
            isCustom: loaded.isCustom ?? false,
          });
        }
      } catch (error) {
        console.error('Failed to load template:', error);
        showMessage({
          message: t('nutrient.templateLoadError'),
          type: 'danger',
        });
        router.back();
      } finally {
        setLoading(false);
      }
    }

    loadTemplate();
  }, [id, isNew, router, t]);

  const handleSubmit = React.useCallback(
    async (data: FeedingTemplateFormData) => {
      try {
        if (isNew) {
          await createTemplate(database, {
            name: data.name,
            medium: data.medium,
            phases: data.phases,
            isCustom: data.isCustom,
          });
          showMessage({
            message: t('nutrient.templateCreated'),
            type: 'success',
          });
        } else {
          await updateTemplate(database, id, {
            name: data.name,
            medium: data.medium,
            phases: data.phases,
          });
          showMessage({
            message: t('nutrient.templateUpdated'),
            type: 'success',
          });
        }
        router.back();
      } catch (error) {
        console.error('Failed to save template:', error);
        showMessage({
          message: t('nutrient.templateSaveError'),
          type: 'danger',
        });
      }
    },
    [id, isNew, router, t]
  );

  const handleCancel = React.useCallback(() => {
    router.back();
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-charcoal-950">
        <View className="flex-1 items-center justify-center">
          <Text className="text-neutral-600 dark:text-neutral-400">
            {t('common.loading')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-charcoal-950">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        keyboardShouldPersistTaps="handled"
      >
        <FeedingTemplateForm
          initialData={template ?? undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
