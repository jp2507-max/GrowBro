/**
 * Playbook Detail Screen
 *
 * Shows detailed preview of a playbook with option to apply to a plant
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getSetupDisplayLabel } from '@/components/playbooks/playbook-selection-card';
import { Button, Text, View } from '@/components/ui';
import { usePlaybookService } from '@/lib/playbooks';
import type { PlaybookPreview } from '@/types/playbook';

function LoadingState() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center bg-neutral-50 dark:bg-charcoal-950">
      <Text className="text-neutral-600 dark:text-neutral-400">
        {t('list.loading')}
      </Text>
    </View>
  );
}

function NotFoundState({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-50 px-4 dark:bg-charcoal-950">
      <Text className="text-center text-neutral-600 dark:text-neutral-400">
        {message}
      </Text>
    </View>
  );
}

function PlaybookContent({
  preview,
  onApply,
}: {
  preview: PlaybookPreview;
  onApply: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <ScrollView className="flex-1" contentInsetAdjustmentBehavior="automatic">
        <View className="p-4">
          <View className="rounded-xl bg-white p-4 dark:bg-charcoal-900">
            <Text className="mb-2 text-2xl font-bold text-charcoal-900 dark:text-neutral-100">
              {preview.name}
            </Text>
            <Text className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
              {getSetupDisplayLabel(preview.setup)(t)}
            </Text>
            <Text className="text-base text-neutral-500 dark:text-neutral-400">
              {preview.totalWeeks} weeks • {preview.totalTasks} tasks
            </Text>
          </View>

          <View className="mt-6">
            <Text className="mb-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              {t('playbooks.whatYouGet')}
            </Text>
            <Text className="text-base text-neutral-500 dark:text-neutral-400">
              {t('playbooks.detailDescription')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        className="border-t border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <Button
          label={t('playbooks.applyToPlant')}
          onPress={onApply}
          className="w-full"
        />
      </View>
    </View>
  );
}

export default function PlaybookDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const playbookService = usePlaybookService();

  const [preview, setPreview] = React.useState<PlaybookPreview | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadPlaybook = async () => {
      try {
        setLoading(true);
        const playbookPreview = await playbookService.getPlaybookPreview(
          params.id
        );
        setPreview(playbookPreview);
      } catch (error) {
        console.error('Failed to load playbook:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlaybook();
  }, [params.id, playbookService]);

  const handleApply = React.useCallback(() => {
    router.push({
      pathname: '/playbooks/apply',
      params: { playbookId: params.id },
    });
  }, [params.id, router]);

  if (loading) return <LoadingState />;
  if (!preview) return <NotFoundState message={t('playbooks.notFound')} />;

  return <PlaybookContent preview={preview} onApply={handleApply} />;
}
