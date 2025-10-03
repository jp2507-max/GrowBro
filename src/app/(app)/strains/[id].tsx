import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { useStrain } from '@/api';
import {
  ComplianceBanner,
  ExpandableSection,
  FavoriteButtonConnected,
  GrowingInfo,
  PlaybookCTA,
  QuickFacts,
  StrainBanner,
  TerpeneSection,
} from '@/components/strains';
import { FocusAwareStatusBar, Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';

const CONTENT_PADDING_BOTTOM = 32;

function LoadingSkeleton(): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" testID="strain-detail-loading" />
      <Text className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        {translate('strains.detail.loading')}
      </Text>
    </View>
  );
}

type ErrorStateProps = {
  onRetry: () => void;
};

function ErrorState({ onRetry }: ErrorStateProps): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="mb-4 text-center text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {translate('strains.detail.error_title')}
      </Text>
      <Text className="mb-6 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {translate('strains.detail.error_message')}
      </Text>
      <Pressable
        onPress={onRetry}
        className="rounded-xl bg-primary-600 px-6 py-3"
        accessibilityRole="button"
        accessibilityLabel={translate('strains.retry')}
        accessibilityHint={translate('accessibility.strains.retry_load_hint')}
        testID="strain-detail-retry-button"
      >
        <Text className="font-semibold text-white">
          {translate('strains.retry')}
        </Text>
      </Pressable>
    </View>
  );
}

// eslint-disable-next-line max-lines-per-function
export default function StrainDetailScreen(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { grossHeight } = useBottomTabBarHeight();

  const {
    data: strain,
    isLoading,
    isError,
    refetch,
  } = useStrain({ variables: { strainId: id as string } });

  const handleBack = React.useCallback(() => {
    router.back();
  }, [router]);

  const handleRetry = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  const contentPadding = React.useMemo(
    () => ({ paddingBottom: grossHeight + CONTENT_PADDING_BOTTOM }),
    [grossHeight]
  );

  if (isLoading) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-950">
        <FocusAwareStatusBar />
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: translate('strains.detail.title'),
            headerLeft: () => (
              <Pressable
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel={translate('accessibility.common.go_back')}
                accessibilityHint="Returns to strains list"
                className="px-2"
              >
                <Text className="text-lg">←</Text>
              </Pressable>
            ),
          }}
        />
        <LoadingSkeleton />
      </View>
    );
  }

  if (isError || !strain) {
    return (
      <View className="flex-1 bg-neutral-50 dark:bg-neutral-950">
        <FocusAwareStatusBar />
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: translate('strains.detail.title'),
            headerLeft: () => (
              <Pressable
                onPress={handleBack}
                accessibilityRole="button"
                accessibilityLabel={translate('accessibility.common.go_back')}
                accessibilityHint="Returns to the strains list"
                className="px-2"
              >
                <Text className="text-lg">←</Text>
              </Pressable>
            ),
          }}
        />
        <ErrorState onRetry={handleRetry} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-950">
      <FocusAwareStatusBar />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: strain.name,
          headerLeft: () => (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel={translate('accessibility.common.go_back')}
              accessibilityHint="Returns to the strains list"
              className="px-2"
              testID="strain-detail-back-button"
            >
              <Text className="text-lg">←</Text>
            </Pressable>
          ),
          headerRight: () => (
            <View className="pr-2">
              <FavoriteButtonConnected strainId={strain.id} />
            </View>
          ),
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={contentPadding}
        testID="strain-detail-scroll"
      >
        {/* Compliance banner for restricted regions */}
        <ComplianceBanner />

        {/* Banner with image and at-a-glance info */}
        <StrainBanner strain={strain} />

        {/* Quick facts */}
        <QuickFacts strain={strain} />

        {/* Terpene visualization */}
        {strain.terpenes && strain.terpenes.length > 0 ? (
          <TerpeneSection terpenes={strain.terpenes} />
        ) : (
          <View className="mx-4 mb-4 rounded-2xl bg-white p-4 dark:bg-neutral-900">
            <Text className="mb-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {translate('strains.detail.terpenes_title')}
            </Text>
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {translate('strains.detail.not_reported')}
            </Text>
          </View>
        )}

        {/* Description */}
        <ExpandableSection
          title={translate('strains.detail.description_title')}
          defaultExpanded={true}
        >
          {strain.description && strain.description.length > 0 ? (
            strain.description.map((paragraph, index) => (
              <Text
                key={index}
                className="mb-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300"
              >
                {paragraph}
              </Text>
            ))
          ) : (
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
              {translate('strains.detail.no_description')}
            </Text>
          )}
        </ExpandableSection>

        {/* Growing information */}
        <GrowingInfo grow={strain.grow} />

        {/* Playbook CTA */}
        <PlaybookCTA strain={strain} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
});
