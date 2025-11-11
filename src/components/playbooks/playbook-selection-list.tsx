/**
 * Playbook Selection List
 *
 * FlashList v2-backed list of playbook options with automatic sizing
 * Targets 60 FPS performance
 *
 * Requirements: 8.5, UI/UX implementation
 */

import { FlashList } from '@shopify/flash-list';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { PlaybookSelectionCard } from '@/components/playbooks/playbook-selection-card';
import { Button, Text, View } from '@/components/ui';
import type { PlaybookPreview } from '@/types/playbook';

type PlaybookSelectionListProps = {
  playbooks: PlaybookPreview[];
  onSelectPlaybook: (playbookId: string) => void;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  className?: string;
};

function LoadingSkeleton() {
  return (
    <View
      className="mb-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900"
      testID="loading-skeleton"
    >
      <View className="mb-3 flex-row items-center justify-between">
        <View className="h-6 w-32 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-6 w-24 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
      </View>
      <View className="mb-3 flex-row gap-4">
        <View className="h-5 w-20 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-5 w-20 rounded-full bg-neutral-200 dark:bg-charcoal-700" />
      </View>
      <View className="gap-2">
        <View className="h-4 w-full rounded-full bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-10 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
        <View className="h-10 w-full rounded-lg bg-neutral-200 dark:bg-charcoal-700" />
      </View>
    </View>
  );
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-center text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {t('playbooks.empty.title', { defaultValue: 'No Playbooks Available' })}
      </Text>
      <Text className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {t('playbooks.empty.subtitle', {
          defaultValue: 'Check back later for cultivation guides',
        })}
      </Text>
    </View>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-center text-lg font-semibold text-danger-600 dark:text-danger-400">
        Failed to Load Playbooks
      </Text>
      <Text className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {error.message}
      </Text>
      {onRetry && (
        <View className="mt-4">
          <Button
            label={t('retry')}
            variant="ghost"
            size="sm"
            onPress={onRetry}
            textClassName="text-primary-600 dark:text-primary-400"
            testID="playbook-selection-retry"
            accessibilityRole="button"
          />
        </View>
      )}
    </View>
  );
}

export function PlaybookSelectionList({
  playbooks,
  onSelectPlaybook,
  isLoading = false,
  error = null,
  onRetry,
  className = '',
}: PlaybookSelectionListProps) {
  const renderItem = useCallback(
    ({ item }: { item: PlaybookPreview }) => (
      <PlaybookSelectionCard preview={item} onPress={onSelectPlaybook} />
    ),
    [onSelectPlaybook]
  );

  const keyExtractor = useCallback(
    (item: PlaybookPreview) => item.playbookId,
    []
  );
  const getItemType = useCallback(
    (item: PlaybookPreview) => `playbook-${item.setup}`,
    []
  );

  if (isLoading) {
    return (
      <View className={`flex-1 p-4 ${className}`}>
        <LoadingSkeleton />
        <LoadingSkeleton />
        <LoadingSkeleton />
      </View>
    );
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (playbooks.length === 0) {
    return <EmptyState />;
  }

  return (
    <View className={`flex-1 ${className}`} testID="playbook-selection-list">
      <FlashList
        data={playbooks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        contentContainerClassName="p-4"
      />
    </View>
  );
}
