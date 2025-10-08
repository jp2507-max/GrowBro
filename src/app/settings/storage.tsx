/**
 * Storage Management Settings Screen
 *
 * Allows users to view storage stats and manually trigger cleanup
 * Requirements: 13.4 (Free up space action)
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { Button, Text, View } from '@/components/ui';
import { cleanupLRU } from '@/lib/media/photo-janitor';
import { getReferencedPhotoUris } from '@/lib/media/photo-storage-helpers';
import { getStorageInfo } from '@/lib/media/photo-storage-service';
import type { CleanupResult, StorageInfo } from '@/types/photo-storage';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function StorageStats({ storageInfo }: { storageInfo: StorageInfo }) {
  const { t } = useTranslation();

  return (
    <View className="rounded-lg bg-white p-4 dark:bg-charcoal-900">
      <Text className="mb-4 text-lg font-semibold text-charcoal-950 dark:text-neutral-100">
        {t('harvest.photo.storage.title')}
      </Text>

      <View className="mb-3">
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('harvest.photo.storage.used')}
        </Text>
        <Text className="text-2xl font-bold text-charcoal-950 dark:text-neutral-100">
          {formatBytes(storageInfo.usedBytes)}
        </Text>
      </View>

      <View className="mb-3">
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('harvest.photo.storage.available')}
        </Text>
        <Text className="text-lg text-neutral-700 dark:text-neutral-300">
          {formatBytes(storageInfo.availableBytes)}
        </Text>
      </View>

      <View className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <View
          className="h-full bg-primary-600"
          style={{
            width: `${(storageInfo.usedBytes / storageInfo.totalBytes) * 100}%`,
          }}
        />
      </View>

      <Text className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
        {t('harvest.photo.storage.used_of_total', {
          used: formatBytes(storageInfo.usedBytes),
          total: formatBytes(storageInfo.totalBytes),
        })}
      </Text>
    </View>
  );
}

function CleanupResults({ result }: { result: CleanupResult }) {
  const { t } = useTranslation();

  return (
    <View className="mt-4 rounded-lg bg-success-50 p-4 dark:bg-success-900">
      <Text className="mb-2 text-base font-semibold text-success-700 dark:text-success-300">
        {t('harvest.photo.storage.cleanup_complete')}
      </Text>

      <Text className="text-sm text-success-700 dark:text-success-300">
        •{' '}
        {t('harvest.photo.storage.files_deleted', {
          count: result.filesDeleted,
        })}
      </Text>
      <Text className="text-sm text-success-700 dark:text-success-300">
        •{' '}
        {t('harvest.photo.storage.space_freed', {
          amount: formatBytes(result.bytesFreed),
        })}
      </Text>
      {result.orphansRemoved > 0 && (
        <Text className="text-sm text-success-700 dark:text-success-300">
          •{' '}
          {t('harvest.photo.storage.orphans_removed', {
            count: result.orphansRemoved,
          })}
        </Text>
      )}
      <Text className="mt-2 text-xs text-success-600 dark:text-success-400">
        {t('harvest.photo.storage.duration', { ms: result.durationMs })}
      </Text>
    </View>
  );
}

function useStorageState() {
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(
    null
  );

  return {
    loading,
    setLoading,
    cleaning,
    setCleaning,
    storageInfo,
    setStorageInfo,
    cleanupResult,
    setCleanupResult,
  };
}

function useLoadStorageInfo(
  setLoading: (v: boolean) => void,
  setStorageInfo: (v: StorageInfo | null) => void,
  t: (key: string) => string
) {
  return React.useCallback(async () => {
    setLoading(true);
    try {
      const info = await getStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('[StorageSettings] Failed to load storage info:', error);
      showMessage({
        message: t('harvest.photo.errors.storage_failed'),
        type: 'danger',
      });
    } finally {
      setLoading(false);
    }
  }, [setLoading, setStorageInfo, t]);
}

function ScreenContent({
  loading,
  storageInfo,
  cleaning,
  cleanupResult,
  onCleanup,
  t,
}: {
  loading: boolean;
  storageInfo: StorageInfo | null;
  cleaning: boolean;
  cleanupResult: CleanupResult | null;
  onCleanup: () => void;
  t: (key: string, options?: any) => string;
}) {
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <ActivityIndicator size="large" />
        <Text className="mt-4 text-neutral-600 dark:text-neutral-400">
          {t('common.loading')}
        </Text>
      </View>
    );
  }

  if (!storageInfo) {
    return (
      <View className="flex-1 items-center justify-center py-12">
        <Text className="text-neutral-600 dark:text-neutral-400">
          {t('settings.storage.unavailable')}
        </Text>
      </View>
    );
  }

  return (
    <>
      <StorageStats storageInfo={storageInfo} />
      <View className="mt-6">
        <Text className="mb-3 text-base text-neutral-700 dark:text-neutral-300">
          {t('settings.storage.description')}
        </Text>
        <Button
          label={t('harvest.photo.actions.free_up_space')}
          onPress={onCleanup}
          loading={cleaning}
          disabled={cleaning}
          variant="default"
          testID="cleanup-button"
          accessibilityLabel={t('harvest.photo.actions.free_up_space')}
          accessibilityHint={t('settings.storage.cleanup_hint')}
        />
      </View>
      {cleanupResult && <CleanupResults result={cleanupResult} />}
    </>
  );
}

function useCleanupHandler({
  setCleaning,
  setCleanupResult,
  loadStorageInfo,
  t,
}: {
  setCleaning: (v: boolean) => void;
  setCleanupResult: (v: CleanupResult | null) => void;
  loadStorageInfo: () => Promise<void>;
  t: (key: string) => string;
}) {
  return async () => {
    setCleaning(true);
    setCleanupResult(null);

    try {
      const referencedUris = await getReferencedPhotoUris();
      const result = await cleanupLRU(undefined, referencedUris, true);

      setCleanupResult(result);

      if (result.filesDeleted > 0 || result.orphansRemoved > 0) {
        await loadStorageInfo();
      }

      showMessage({
        message: t('harvest.photo.storage.cleanup_success'),
        type: 'success',
      });
    } catch (error) {
      console.error('[StorageSettings] Cleanup failed:', error);
      showMessage({
        message: t('harvest.photo.errors.cleanup_failed'),
        type: 'danger',
      });
    } finally {
      setCleaning(false);
    }
  };
}

export default function StorageSettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    loading,
    setLoading,
    cleaning,
    setCleaning,
    storageInfo,
    setStorageInfo,
    cleanupResult,
    setCleanupResult,
  } = useStorageState();

  const loadStorageInfo = useLoadStorageInfo(setLoading, setStorageInfo, t);
  const handleCleanup = useCleanupHandler({
    setCleaning,
    setCleanupResult,
    loadStorageInfo,
    t,
  });

  useEffect(() => {
    loadStorageInfo();
  }, [loadStorageInfo]);

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <View className="border-b border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900">
        <Button
          label={t('common.back')}
          variant="link"
          onPress={() => router.back()}
          className="mb-2"
        />
        <Text className="text-2xl font-semibold text-charcoal-950 dark:text-neutral-100">
          {t('settings.storage.title')}
        </Text>
      </View>
      <ScrollView className="flex-1 p-4">
        <ScreenContent
          loading={loading}
          storageInfo={storageInfo}
          cleaning={cleaning}
          cleanupResult={cleanupResult}
          onCleanup={handleCleanup}
          t={t}
        />
      </ScrollView>
    </View>
  );
}
