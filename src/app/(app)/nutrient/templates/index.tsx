/**
 * Template List Screen
 *
 * Browse and manage feeding templates with medium filtering.
 * Displays custom and default templates in a FlashList.
 *
 * Requirements: 1.1, 1.2
 */

import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { TemplateFilterBar } from '@/components/nutrient/template-filter-bar';
import { TemplateListItem } from '@/components/nutrient/template-list-item';
import { Button, SafeAreaView, Text, View } from '@/components/ui';
import { listTemplates } from '@/lib/nutrient-engine/services/template-service';
import type {
  FeedingTemplate,
  GrowingMedium,
} from '@/lib/nutrient-engine/types';
import { database } from '@/lib/watermelon';

function EmptyState({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-center text-neutral-600 dark:text-neutral-400">
        {message}
      </Text>
    </View>
  );
}

// eslint-disable-next-line max-lines-per-function
export default function TemplateListScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [templates, setTemplates] = React.useState<FeedingTemplate[]>([]);
  const [selectedMedium, setSelectedMedium] =
    React.useState<GrowingMedium | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadTemplates() {
      setLoading(true);
      try {
        const loaded = await listTemplates(
          database,
          selectedMedium ?? undefined
        );
        setTemplates(loaded);
      } catch (error) {
        console.error('Failed to load templates:', error);
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, [database, selectedMedium]);

  const handleTemplatePress = React.useCallback(
    (template: FeedingTemplate) => {
      router.push(`/nutrient/templates/${template.id}`);
    },
    [router]
  );

  const handleCreateNew = React.useCallback(() => {
    router.push('/nutrient/templates/new');
  }, [router]);

  const renderTemplate = React.useCallback(
    ({ item }: { item: FeedingTemplate }) => (
      <TemplateListItem template={item} onPress={handleTemplatePress} />
    ),
    [handleTemplatePress]
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <View className="flex-1">
        <View className="px-4 py-3">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            {t('nutrient.feedingTemplates')}
          </Text>
          <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {t('nutrient.templatesDescription')}
          </Text>
        </View>

        <TemplateFilterBar
          selectedMedium={selectedMedium}
          onSelectMedium={setSelectedMedium}
        />

        {loading ? (
          <EmptyState message={t('common.loading')} />
        ) : templates.length === 0 ? (
          <EmptyState message={t('nutrient.noTemplatesFound')} />
        ) : (
          <FlashList
            data={templates}
            renderItem={renderTemplate}
            contentContainerClassName="p-4"
          />
        )}

        <View className="border-t border-neutral-200 p-4 dark:border-charcoal-800">
          <Button
            label={t('nutrient.createTemplate')}
            onPress={handleCreateNew}
            testID="create-template-btn"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
