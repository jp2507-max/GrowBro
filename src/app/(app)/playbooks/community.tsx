/**
 * Community Playbook Templates Screen
 *
 * Browse and adopt community-shared playbook templates
 */

import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import type { CommunityTemplate } from '@/api/templates';
import { TemplateListItem } from '@/components/playbooks';
import { SafeAreaView, Text, View } from '@/components/ui';
import { useAnalytics } from '@/lib/use-analytics';

function TemplateHeader() {
  const { t } = useTranslation();
  return (
    <View className="px-4 py-6">
      <Text className="text-3xl font-bold text-charcoal-900 dark:text-neutral-100">
        {t('playbooks.communityTemplates')}
      </Text>
      <Text className="mt-2 text-base text-neutral-600 dark:text-neutral-400">
        {t('playbooks.communityDescription')}
      </Text>
    </View>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center px-4">
      <Text className="text-text-secondary text-center">{message}</Text>
    </View>
  );
}

function LoadingState({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-text-secondary">{message}</Text>
    </View>
  );
}

function useCommunityTemplates() {
  const { track } = useAnalytics();
  const router = useRouter();
  const [templates, setTemplates] = React.useState<CommunityTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const mockTemplates: CommunityTemplate[] = [
      {
        id: '1',
        authorId: 'user1',
        name: 'Fast Auto Indoor',
        authorHandle: 'grower123',
        description: 'Quick 8-week auto grow optimized for small spaces',
        setup: 'auto_indoor',
        locale: 'en',
        license: 'CC-BY-SA',
        steps: [],
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        totalWeeks: 8,
        taskCount: 24,
        ratingAverage: 4.5,
        ratingCount: 15,
        adoptionCount: 42,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        authorId: 'user2',
        name: 'Outdoor Photo Extended',
        authorHandle: 'sungrower',
        description: 'Full season outdoor photoperiod with extended veg',
        setup: 'photo_outdoor',
        locale: 'en',
        license: 'CC-BY-SA',
        steps: [],
        phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
        totalWeeks: 16,
        taskCount: 48,
        ratingAverage: 4.8,
        ratingCount: 20,
        adoptionCount: 28,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    track('community_templates_viewed', {
      templateCount: mockTemplates.length,
    });
    setTemplates(mockTemplates);
    setLoading(false);
  }, [track]);

  const handleTemplatePress = React.useCallback(
    (template: CommunityTemplate) => {
      track('community_template_selected', { templateId: template.id });
      router.push(`/playbooks/community/${template.id}`);
    },
    [router, track]
  );

  return { templates, loading, handleTemplatePress };
}

export default function CommunityTemplatesScreen() {
  const { t } = useTranslation();
  const { templates, loading, handleTemplatePress } = useCommunityTemplates();

  const renderTemplate = React.useCallback(
    ({ item }: { item: CommunityTemplate }) => (
      <TemplateListItem template={item} onPress={handleTemplatePress} />
    ),
    [handleTemplatePress]
  );
  const keyExtractor = React.useCallback(
    (item: CommunityTemplate) => item.id,
    []
  );
  const getItemType = React.useCallback(
    (item: CommunityTemplate) => `template-${item.setup}`,
    []
  );

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <View className="flex-1">
        <TemplateHeader />
        {loading ? (
          <LoadingState message={t('common.loading')} />
        ) : templates.length === 0 ? (
          <EmptyState message={t('playbooks.noTemplates')} />
        ) : (
          <FlashList
            data={templates}
            renderItem={renderTemplate}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            contentContainerClassName="px-4 pb-4"
          />
        )}
      </View>
    </SafeAreaView>
  );
}
