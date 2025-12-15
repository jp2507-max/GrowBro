import { Env } from '@env';
import * as Sentry from '@sentry/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as React from 'react';
import { useLayoutEffect } from 'react';
import { ScrollView, Share } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
// @ts-expect-error - Reanimated 4.x type exports issue
import { Extrapolation, interpolate } from 'react-native-reanimated';
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
import { strainImageTag } from '@/lib/animations';
import { useBottomTabBarHeight } from '@/lib/animations/use-bottom-tab-bar-height';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import { getListImageProps } from '@/lib/strains/image-optimization';
import type { Strain } from '@/types/strains';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * Check if using proxy (production always uses proxy, dev can disable)
 */
function isProxyEnabled(): boolean {
  // Always use proxy in production
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  const rawValue = Env?.STRAINS_USE_PROXY;
  const normalized = rawValue ? String(rawValue).trim().toLowerCase() : '';
  // In dev, proxy is enabled unless explicitly set to 'false' or '0'
  return normalized !== 'false' && normalized !== '0';
}

/** Fire-and-forget background cache to Supabase (dev fallback only) */
function cacheStrainToSupabase(strain: Strain) {
  if (isProxyEnabled()) {
    // Proxy already saves to Supabase; avoid duplicate writes from client.
    return;
  }

  import('@/lib/supabase').then(({ supabase }) => {
    supabase
      .from('strain_cache')
      .upsert(
        {
          id: strain.id,
          slug: strain.slug,
          name: strain.name,
          race: strain.race,
          data: strain,
        },
        { onConflict: 'id' }
      )
      .then(({ error: cacheError }) => {
        if (cacheError) {
          console.debug('[StrainDetails] Cache save failed:', cacheError);
        }
      });
  });
}

/** Share strain via native share sheet */
async function shareStrain(strain: Strain) {
  haptics.selection();

  const shareUrl = strain.link || `https://growbro.app/strains/${strain.slug}`;
  const shareMessage = translate('strains.detail.share_message', {
    name: strain.name,
    url: shareUrl,
  });

  try {
    await Share.share({
      message: shareMessage,
      url: shareUrl,
      title: strain.name,
    });
  } catch (err) {
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
}

const GrowInfoSection = ({ strain }: { strain: Strain }) => {
  const floweringTime =
    strain.grow.flowering_time.label ??
    (strain.grow.flowering_time.min_weeks &&
    strain.grow.flowering_time.max_weeks
      ? `${strain.grow.flowering_time.min_weeks}-${strain.grow.flowering_time.max_weeks} weeks`
      : translate('common.na'));

  const yieldRating =
    strain.grow.yield.indoor?.label ??
    strain.grow.yield.outdoor?.label ??
    translate('common.na');
  const heightRating = strain.grow.height.label ?? translate('common.na');

  return (
    <Animated.View
      entering={FadeIn.delay(500).springify().reduceMotion(ReduceMotion.System)}
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
    <Animated.View
      entering={FadeIn.delay(600).springify().reduceMotion(ReduceMotion.System)}
      className="mt-8"
    >
      {strain.effects && strain.effects.length > 0 && (
        <View className="mb-6" testID="strain-effects">
          <Text className="mb-3 text-lg font-bold text-neutral-900 dark:text-white">
            {translate('strains.detail.effects')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {strain.effects.map((effect) => (
              <View
                key={effect.name}
                className="rounded-full bg-success-100 px-3 py-1 dark:bg-success-900/30"
              >
                <Text className="font-medium text-success-800 dark:text-success-200">
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
        className="size-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
        onPress={onBack}
        testID="back-button"
      >
        <ArrowLeft color="currentColor" width={20} height={20} />
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
  scrollY: SharedValue<number>;
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
  scrollY,
}: HeroSectionProps) => {
  // Animate buttons based on scroll position
  const buttonsAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 100, 200],
      [1, 0.6, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 100, 200],
      [0, -10, -30],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  return (
    <View className="relative h-96 w-full bg-neutral-100 dark:bg-neutral-800">
      <AnimatedImage
        className="size-full"
        contentFit="cover"
        sharedTransitionTag={strainImageTag(strain.slug)}
        {...imageProps}
      />

      {/* Header Actions Overlay */}
      <Animated.View
        className="absolute inset-x-0 top-0 z-10 flex-row items-center justify-between px-4"
        style={[{ paddingTop: topInset + 8 }, buttonsAnimatedStyle]}
      >
        <Pressable
          onPress={onBack}
          className="size-10 items-center justify-center rounded-full bg-neutral-100 active:bg-neutral-200"
          accessibilityRole="button"
          accessibilityLabel={translate('accessibility.common.go_back')}
          accessibilityHint={translate('strains.detail.back_hint')}
          testID="back-button"
        >
          <ArrowLeft color="#554B32" width={24} height={24} />
        </Pressable>

        <View className="flex-row gap-3">
          <FavoriteButtonConnected
            strainId={strain.id}
            strain={strain}
            variant="overlay"
            testID="favorite-button"
          />
          <Pressable
            onPress={onShare}
            className="size-10 items-center justify-center rounded-full bg-neutral-100 active:bg-neutral-200"
            accessibilityRole="button"
            accessibilityLabel={translate('strains.detail.share')}
            accessibilityHint={translate('strains.detail.share_hint')}
            testID="share-button"
          >
            <ShareIcon color="#554B32" width={24} height={24} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Title Overlay with Gradient */}
      <View className="absolute inset-x-0 bottom-0">
        <AnimatedLinearGradient
          colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.8)']}
          locations={[0, 0.4, 1]}
          className="w-full"
        >
          <Animated.View
            entering={FadeIn.delay(200)
              .springify()
              .reduceMotion(ReduceMotion.System)}
            className="px-5 pb-9 pt-16"
          >
            <Text className="mb-4 text-4xl font-extrabold text-white shadow-sm">
              {strain.name}
            </Text>
            <View className="flex-row flex-wrap gap-3">
              <RaceBadge race={strain.race} />
              {strain.thc_display && <THCBadge thc={strain.thc_display} />}
              <DifficultyBadge difficulty={strain.grow.difficulty} />
            </View>
          </Animated.View>
        </AnimatedLinearGradient>
      </View>
    </View>
  );
};

export default function StrainDetailsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { grossHeight: tabBarHeight } = useBottomTabBarHeight();
  const scrollY = useSharedValue(0);

  // Hide default header to create a custom clean layout
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Fetch strain data - accepts either strain ID or slug as identifier
  const {
    data: strain,
    isLoading,
    isError,
    error,
    refetch,
  } = useStrain({ strainIdOrSlug: slug });

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

  // Background cache: Save viewed strain to Supabase for future users (dev fallback only)
  React.useEffect(() => {
    if (strain) cacheStrainToSupabase(strain);
  }, [strain]);

  const imageProps = React.useMemo(() => {
    if (!strain) return {};
    return getListImageProps(strain.id, strain.imageUrl);
  }, [strain]);

  const handleShare = React.useCallback(() => {
    if (strain) shareStrain(strain);
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

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event: { contentOffset: { y: number } }) => {
      scrollY.value = event.contentOffset.y;
    },
  });

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
      <AnimatedScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <StrainHeroSection
          strain={strain}
          imageProps={imageProps}
          topInset={insets.top}
          onBack={handleBack}
          onShare={handleShare}
          scrollY={scrollY}
        />

        {/* Content */}
        <View className="px-5 pt-6">
          {strain.description?.map((paragraph, index) => (
            <Animated.Text
              key={index}
              entering={FadeIn.delay(300 + index * 100)
                .springify()
                .reduceMotion(ReduceMotion.System)}
              className="mb-4 text-lg leading-relaxed text-neutral-600 dark:text-neutral-300"
            >
              {paragraph}
            </Animated.Text>
          ))}
          <GrowInfoSection strain={strain} />
          <EffectsFlavorsSection strain={strain} />
        </View>
      </AnimatedScrollView>
    </View>
  );
}
