/**
 * Playbooks Home Screen
 *
 * Main entry point for the Guided Grow Playbooks feature.
 * Displays available playbooks and allows users to select and apply them to plants.
 */

import { useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import {
  PlaybookOnboarding,
  PlaybookSelectionList,
  usePlaybookOnboarding,
} from '@/components/playbooks';
import { Text, View } from '@/components/ui';
import { usePlaybookService } from '@/lib/playbooks';
import type { PlaybookPreview } from '@/types/playbook';

function PlaybooksHeader() {
  const { t } = useTranslation();
  return (
    <View className="px-4 py-6">
      <Text className="text-3xl font-bold text-charcoal-900 dark:text-neutral-100">
        {t('playbooks.title')}
      </Text>
      <Text className="mt-2 text-base text-neutral-600 dark:text-neutral-400">
        {t('playbooks.subtitle')}
      </Text>
    </View>
  );
}

function CenteredMessage({ message }: { message: string }) {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-neutral-600 dark:text-neutral-400">{message}</Text>
    </View>
  );
}

function usePlaybooksData() {
  const playbookService = usePlaybookService();
  const [playbooks, setPlaybooks] = React.useState<PlaybookPreview[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  return {
    playbooks,
    loading,
    error,
    setPlaybooks,
    setLoading,
    setError,
    playbookService,
  };
}

function useLoadPlaybooks({
  onboardingLoading,
  showOnboarding,
  playbookService,
  setPlaybooks,
  setLoading,
  setError,
}: {
  onboardingLoading: boolean;
  showOnboarding: boolean;
  playbookService: ReturnType<typeof usePlaybookService>;
  setPlaybooks: (playbooks: PlaybookPreview[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}) {
  React.useEffect(() => {
    const loadPlaybooks = async () => {
      try {
        setLoading(true);
        const availablePlaybooks =
          await playbookService.getAvailablePlaybooks();

        const previews = await Promise.all(
          availablePlaybooks.map((pb) =>
            playbookService.getPlaybookPreview(pb.id)
          )
        );
        setPlaybooks(previews);
      } catch (err) {
        console.error('Failed to load playbooks:', err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    if (!onboardingLoading && !showOnboarding) {
      loadPlaybooks();
    }
  }, [
    playbookService,
    onboardingLoading,
    showOnboarding,
    setPlaybooks,
    setLoading,
    setError,
  ]);
}

export default function PlaybooksScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    showOnboarding,
    loading: onboardingLoading,
    completeOnboarding,
  } = usePlaybookOnboarding();

  const {
    playbooks,
    loading,
    error,
    setPlaybooks,
    setLoading,
    setError,
    playbookService,
  } = usePlaybooksData();

  useLoadPlaybooks({
    onboardingLoading,
    showOnboarding,
    playbookService,
    setPlaybooks,
    setLoading,
    setError,
  });

  const handlePlaybookSelect = React.useCallback(
    (playbookId: string) => {
      router.push(`/playbooks/${playbookId}`);
    },
    [router]
  );

  if (onboardingLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-neutral-50 dark:bg-charcoal-950">
        <CenteredMessage message={t('common.loading')} />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <PlaybookOnboarding
        onComplete={completeOnboarding}
        onSkip={completeOnboarding}
      />
    );
  }

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <View className="flex-1">
        <PlaybooksHeader />
        {loading ? (
          <CenteredMessage message={t('common.loading')} />
        ) : error ? (
          <CenteredMessage message={t('playbooks.load_error')} />
        ) : (
          <PlaybookSelectionList
            playbooks={playbooks}
            onSelectPlaybook={handlePlaybookSelect}
          />
        )}
      </View>
    </View>
  );
}
