import { useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import type { Strain } from '@/api/strains/types';
import { useStrainsInfiniteWithCache } from '@/api/strains/use-strains-infinite-with-cache';
import { StrainPickerContent } from '@/components/community/strain-picker-content';
import { GlassSurface } from '@/components/shared/glass-surface';
import { Text } from '@/components/ui/text';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import {
  cancelStrainPickerRequest,
  resolveStrainPickerRequest,
} from '@/lib/strain-picker-sheet-registry';
import {
  buildCustomStrain,
  saveCustomStrainToSupabase,
} from '@/lib/strains/custom-strain-cache';

export type StrainPickerResult =
  | { strain: Strain; source: 'api' | 'custom' }
  | undefined;

function getParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseBooleanParam(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

export default function StrainPickerFormSheet(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t } = useTranslation();

  const requestId = getParam(params.requestId);
  const title = getParam(params.title);
  const value = getParam(params.value);
  const enableCustomStrain = parseBooleanParam(getParam(params.custom));

  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery.trim(), 250);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } =
    useStrainsInfiniteWithCache({
      variables: {
        searchQuery: debouncedSearchQuery || undefined,
        pageSize: 20,
      },
      enabled: Boolean(requestId),
    });

  const strains = React.useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data]
  );

  const trimmedQuery = searchQuery.trim();
  const hasExactMatch = React.useMemo(() => {
    const lower = trimmedQuery.toLowerCase();
    return strains.some((s) => s.name.toLowerCase() === lower);
  }, [strains, trimmedQuery]);

  const showCreateCustom =
    enableCustomStrain &&
    trimmedQuery.length > 0 &&
    !hasExactMatch &&
    !isFetching;

  React.useEffect(() => {
    if (!requestId) {
      console.warn('[StrainPickerFormSheet] Missing required requestId param');
    }
  }, [requestId]);

  const handleCancel = React.useCallback((): void => {
    if (requestId) {
      cancelStrainPickerRequest(requestId);
    }
    router.back();
  }, [requestId, router]);

  const handleSelect = React.useCallback(
    (strain: Strain, source: 'api' | 'custom'): void => {
      if (requestId) {
        resolveStrainPickerRequest<StrainPickerResult>(requestId, {
          strain,
          source,
        });
      }
      router.back();
    },
    [requestId, router]
  );

  const handleClear = React.useCallback((): void => {
    if (requestId) {
      resolveStrainPickerRequest<StrainPickerResult>(requestId, undefined);
    }
    router.back();
  }, [requestId, router]);

  const handleCreateCustom = React.useCallback((): void => {
    const name = trimmedQuery;
    if (!name) return;

    const customStrain = buildCustomStrain(name);
    void saveCustomStrainToSupabase(customStrain);
    handleSelect(customStrain, 'custom');
  }, [trimmedQuery, handleSelect]);

  const handleEndReached = React.useCallback((): void => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (!requestId) {
    return <View className="flex-1 bg-white dark:bg-charcoal-900" />;
  }

  const content = (
    <View style={styles.container}>
      <GlassSurface
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.glassSurface]}
      />
      <View style={styles.content}>
        <View className="mb-4 flex-row items-center justify-between px-4">
          <Pressable
            onPress={handleCancel}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            accessibilityHint={t('accessibility.modal.close_hint')}
            hitSlop={20}
          >
            <Text className="text-base font-medium text-primary-600 dark:text-primary-400">
              {t('common.cancel')}
            </Text>
          </Pressable>

          <Text className="text-base font-semibold text-charcoal-800 dark:text-neutral-100">
            {title || t('feed.add_post.select_strain')}
          </Text>

          <View className="w-[64px]" />
        </View>

        <StrainPickerContent
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          strains={strains}
          value={value}
          isFetching={isFetching}
          showCreateCustom={showCreateCustom}
          onSelect={(strain) => handleSelect(strain, 'api')}
          onClear={handleClear}
          onEndReached={handleEndReached}
          onCreateCustom={enableCustomStrain ? handleCreateCustom : undefined}
          testID="strain-picker-sheet"
        />
      </View>
    </View>
  );

  return (
    <>
      {Platform.OS === 'ios' ? (
        content
      ) : (
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior="padding"
          keyboardVerticalOffset={10}
        >
          {content}
        </KeyboardAvoidingView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  container: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  glassSurface: {
    borderRadius: 16,
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
});
