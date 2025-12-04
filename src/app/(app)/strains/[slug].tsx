import * as Sentry from '@sentry/react-native';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as React from 'react';
import { useLayoutEffect } from 'react';
import { ScrollView, Share } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStrain } from '@/api/strains/use-strain';
import { DifficultyBadge } from '@/components/strains/difficulty-badge';
import { FavoriteButtonConnected } from '@/components/strains/favorite-button-connected';
import { RaceBadge } from '@/components/strains/race-badge';
import { StrainDetailSkeleton } from '@/components/strains/strain-detail-skeleton';
import { THCBadge } from '@/components/strains/thc-badge';
import { Image, Pressable, Text, View } from '@/components/ui';
import { ArrowLeft, Share as ShareIcon } from '@/components/ui/icons';
import { ListErrorState } from '@/components/ui/list';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import { getListImageProps } from '@/lib/strains/image-optimization';
import type { Strain } from '@/types/strains';

const AnimatedImage = Animated.createAnimatedComponent(Image);

const GrowInfoSection = ({ strain }: { strain: Strain }) => {
  const floweringTime =
    strain.grow.flowering_time.label ??
    (strain.grow.flowering_time.min_weeks &&
    strain.grow.flowering_time.max_weeks
      ? `${strain.grow.flowering_time.min_weeks}-${strain.grow.flowering_time.max_weeks} weeks`
      : 'N/A');

  const yieldRating =
    strain.grow.yield.indoor?.label ??
    strain.grow.yield.outdoor?.label ??
    'N/A';
  const heightRating = strain.grow.height.label ?? 'N/A';

  return (
    <Animated.View
      entering={FadeIn.delay(500).springify()}
      className="mt-6 rounded-2xl bg-neutral-50 p-5 dark:bg-neutral-900"
      testID="grow-info"
    >
      <Text className="mb-4 text-xl font-bold text-neutral-900 dark:text-white">
        {translate('strains.detail.grow_info')}
      </Text>

      <View className="flex-row flex-wrap gap-y-4">
        <View className="w-1/2 pr-2">
          <Text className="mb-1 text-sm font-medium text-neutral-500">
            {translate('strains.detail.flowering_time')}
          </Text>
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {floweringTime}
          </Text>
        </View>

        <View className="w-1/2 pl-2">
          <Text className="mb-1 text-sm font-medium text-neutral-500">
            {translate('strains.detail.yield')}
          </Text>
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {yieldRating}
          </Text>
        </View>

        <View className="w-1/2 pr-2">
          <Text className="mb-1 text-sm font-medium text-neutral-500">
            {translate('strains.detail.height')}
          </Text>
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {heightRating}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const EffectsFlavorsSection = ({ strain }: { strain: Strain }) => {
  return (
    <Animated.View entering={FadeIn.delay(600).springify()} className="mt-8">
      {strain.effects && strain.effects.length > 0 && (
        <View className="mb-6" testID="strain-effects">
          <Text className="mb-3 text-lg font-bold text-neutral-900 dark:text-white">
            {translate('strains.detail.effects')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {strain.effects.map((effect) => (
              <View
                key={effect.name}
                className="rounded-full bg-green-100 px-3 py-1 dark:bg-green-900/30"
              >
                <Text className="font-medium text-green-800 dark:text-green-200">
                  {effect.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {strain.flavors && strain.flavors.length > 0 && (
        <View testID="strain-flavors">
          <Text className="mb-3 text-lg font-bold text-neutral-900 dark:text-white">
            {translate('strains.detail.flavors')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {strain.flavors.map((flavor) => (
              <View
                key={flavor.name}
                className="rounded-full bg-orange-100 px-3 py-1 dark:bg-orange-900/30"
              >
                <Text className="font-medium text-orange-800 dark:text-orange-200">
                  {flavor.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
};

type ErrorStateProps = {
  onBack: () => void;
  onRetry: () => void;
  topInset: number;
};

const StrainErrorState = ({ onBack, onRetry, topInset }: ErrorStateProps) => (
  <View
    className="flex-1 bg-white dark:bg-neutral-950"
    testID="strain-detail-error"
  >
    <View
      className="flex-row items-center px-4"
      style={{ paddingTop: topInset + 8 }}
    >
      <Pressable
        accessibilityHint={translate('strains.detail.back_hint')}
        accessibilityLabel={translate('accessibility.common.go_back')}
        accessibilityRole="button"
        className="size-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"
        onPress={onBack}
        testID="back-button"
      >
        <ArrowLeft color="#171717" width={20} height={20} />
      </Pressable>
    </View>
    <ListErrorState
      title={translate('strains.detail.error_title')}
      body={translate('strains.detail.error_message')}
      onRetry={onRetry}
      retryLabel={translate('strains.detail.retry')}
    />
  </View>
);

type HeroSectionProps = {
  strain: Strain;
  imageProps: ReturnType<typeof getListImageProps> | Record<string, never>;
  topInset: number;
  onBack: () => void;
  onShare: () => void;
};

const InvalidIdState = ({ onBack }: { onBack: () => void }) => (
  <View
    className="flex-1 bg-white dark:bg-neutral-950"
    testID="strain-detail-invalid"
  >
    <ListErrorState
      title={translate('strains.detail.invalid_id')}
      body={translate('strains.detail.error_message')}
      onRetry={onBack}
      retryLabel={translate('common.go_back')}
    />
  </View>
);

const StrainHeroSection = ({
  strain,
  imageProps,
  topInset,
  onBack,
  onShare,
}: HeroSectionProps) => (
  <View className="relative h-96 w-full bg-neutral-100 dark:bg-neutral-800">
    <AnimatedImage
      className="size-full"
      contentFit="cover"
      sharedTransitionTag={`strain-image-${strain.slug}`}
      {...imageProps}
    />

    {/* Header Actions Overlay */}
    <View
      className="absolute inset-x-0 top-0 z-10 flex-row items-center justify-between px-4"
      style={{ paddingTop: topInset + 8 }}
    >
      <Pressable
        onPress={onBack}
        className="size-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-md active:bg-black/30"
        accessibilityRole="button"
        accessibilityLabel={translate('accessibility.common.go_back')}
        accessibilityHint={translate('strains.detail.back_hint')}
        testID="back-button"
      >
        <ArrowLeft color="white" width={24} height={24} />
      </Pressable>

      <View className="flex-row gap-2">
        <FavoriteButtonConnected
          strainId={strain.id}
          strain={strain}
          variant="overlay"
          testID="favorite-button"
        />
        <Pressable
          onPress={onShare}
          className="size-10 items-center justify-center rounded-full bg-black/20 backdrop-blur-md active:bg-black/30"
          accessibilityRole="button"
          accessibilityLabel={translate('strains.detail.share')}
          accessibilityHint={translate('strains.detail.share_hint')}
          testID="share-button"
        >
          <ShareIcon color="white" width={24} height={24} />
        </Pressable>
      </View>
    </View>

    {/* Title Overlay */}
    <View className="absolute inset-x-0 bottom-0">
      <BlurView intensity={40} tint="dark" className="px-5 pb-6 pt-12">
        <Animated.View entering={FadeIn.delay(200).springify()}>
          <Text className="mb-2 text-4xl font-extrabold text-white shadow-sm">
            {strain.name}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <RaceBadge race={strain.race} />
            {strain.thc_display && <THCBadge thc={strain.thc_display} />}
            <DifficultyBadge difficulty={strain.grow.difficulty} />
          </View>
        </Animated.View>
      </BlurView>
    </View>
  </View>
);

export default function StrainDetailsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { grossHeight: tabBarHeight } = useBottomTabBarHeight();

  // Hide default header to create a custom clean layout
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Fetch strain data - hook is disabled when slug is undefined via `enabled` option
  const {
    data: strain,
    isLoading,
    isError,
    error,
    refetch,
  } = useStrain({ strainId: slug });

  // Log errors to Sentry when they occur
  React.useEffect(() => {
    if (isError && error) {
      console.error('[StrainDetails] Failed to load strain:', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error, {
        tags: { screen: 'StrainDetails', slug: slug ?? 'undefined' },
      });
    }
  }, [isError, error, slug]);

  // Background cache: Save viewed strain to Supabase for future users
  // This runs in background and doesn't block the UI
  React.useEffect(() => {
    if (strain) {
      // Fire and forget - save to Supabase cache for other users
      import('@/lib/supabase').then(({ supabase }) => {
        const strainId = strain.id;
        const strainSlug = strain.slug;
        const strainName = strain.name;
        const strainRace = strain.race;

        supabase
          .from('strain_cache')
          .upsert(
            {
              id: strainId,
              slug: strainSlug,
              name: strainName,
              race: strainRace,
              data: strain,
            },
            { onConflict: 'id' }
          )
          .then(({ error: cacheError }) => {
            if (cacheError) {
              // Silent fail - caching is best-effort
              console.debug('[StrainDetails] Cache save failed:', cacheError);
            }
          });
      });
    }
  }, [strain]);

  const imageProps = React.useMemo(() => {
    if (!strain) return {};
    return getListImageProps(strain.id, strain.imageUrl);
  }, [strain]);

  const handleShare = React.useCallback(async () => {
    if (!strain) return;

    haptics.selection();

    // Build deep link URL: prefer strain.link, fallback to public URL
    const shareUrl =
      strain.link || `https://growbro.app/strains/${strain.slug}`;

    // Build localized share message
    const shareMessage = translate('strains.detail.share_message', {
      name: strain.name,
      url: shareUrl,
    });

    try {
      await Share.share({
        message: shareMessage,
        url: shareUrl, // iOS uses this separately, Android includes in message
        title: strain.name,
      });
    } catch (err) {
      // User cancelled (error.name === 'AbortError') is expected, don't log
      const isShareCancelled =
        err instanceof Error && err.message === 'Share action cancelled';
      if (!isShareCancelled && err instanceof Error) {
        Sentry.addBreadcrumb({
          category: 'strains_share',
          message: 'Share failed',
          level: 'warning',
          data: { strainSlug: strain.slug, error: err.message },
        });
      }
    }
  }, [strain]);

  const handleBack = React.useCallback(() => {
    haptics.selection();
    // Guard: if there's no history (e.g. deep link), fall back to strains list
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/strains');
    }
  }, [router]);

  // Guard against undefined slug
  if (!slug) {
    return <InvalidIdState onBack={handleBack} />;
  }

  // Handle error state
  if (isError) {
    return (
      <StrainErrorState
        onBack={handleBack}
        onRetry={() => refetch()}
        topInset={insets.top}
      />
    );
  }

  // Handle loading state with skeleton
  if (isLoading || !strain) {
    return <StrainDetailSkeleton onBack={handleBack} />;
  }

  return (
    <View
      className="flex-1 bg-white dark:bg-neutral-950"
      testID="strain-detail-screen"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <StrainHeroSection
          strain={strain}
          imageProps={imageProps}
          topInset={insets.top}
          onBack={handleBack}
          onShare={handleShare}
        />

        {/* Content */}
        <View className="px-5 pt-6">
          {strain.description?.map((paragraph, index) => (
            <Animated.Text
              key={index}
              entering={FadeIn.delay(300 + index * 100).springify()}
              className="mb-4 text-lg leading-relaxed text-neutral-600 dark:text-neutral-300"
            >
              {paragraph}
            </Animated.Text>
          ))}
          <GrowInfoSection strain={strain} />
          <EffectsFlavorsSection strain={strain} />
        </View>
      </ScrollView>
    </View>
  );
}
