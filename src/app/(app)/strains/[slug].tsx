import { Env } from '@env';
import * as Sentry from '@sentry/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as React from 'react';
import { useLayoutEffect } from 'react';
import { Share } from 'react-native';
import Animated, {
  FadeIn,
  ReduceMotion,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStrain } from '@/api/strains/use-strain';
import { FavoriteButtonConnected } from '@/components/strains/favorite-button-connected';
import { RaceBadge } from '@/components/strains/race-badge';
import { StrainDetailSkeleton } from '@/components/strains/strain-detail-skeleton';
import { Image, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import {
  ArrowLeft,
  Calendar,
  Leaf,
  Scale,
  Share as ShareIcon,
  Smile,
  Sprout,
} from '@/components/ui/icons';
import { ListErrorState } from '@/components/ui/list';
import { strainImageTag } from '@/lib/animations';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import { getListImageProps } from '@/lib/strains/image-optimization';
import type { Strain } from '@/types/strains';

const AnimatedImage = Animated.createAnimatedComponent(Image);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * Check if using proxy (production always uses proxy, dev can disable)
 */
function isProxyEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return true;
  }
  const rawValue = Env?.STRAINS_USE_PROXY;
  const normalized = rawValue ? String(rawValue).trim().toLowerCase() : '';
  return normalized !== 'false' && normalized !== '0';
}

/** Fire-and-forget background cache to Supabase (dev fallback only) */
function cacheStrainToSupabase(strain: Strain) {
  if (isProxyEnabled()) {
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

const EffectsFlavorsSection = ({ strain }: { strain: Strain }) => {
  return (
    <Animated.View
      entering={FadeIn.delay(400).springify().reduceMotion(ReduceMotion.System)}
      className="mt-8 px-6 pb-20"
    >
      {strain.effects && strain.effects.length > 0 && (
        <View className="mb-8" testID="strain-effects">
          <Text className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">
            {translate('strains.detail.effects')}
          </Text>
          <View className="flex-row flex-wrap">
            {strain.effects.map((effect) => (
              <View
                key={effect.name}
                className="mb-3 mr-3 flex-row items-center rounded-full border border-primary-200 bg-primary-100 px-5 py-3 dark:border-primary-700 dark:bg-primary-900/40"
              >
                <Smile
                  width={18}
                  height={18}
                  color={colors.ink[700]}
                  className="mr-2"
                />
                <Text className="text-sm font-bold text-primary-900 dark:text-primary-100">
                  {effect.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {strain.flavors && strain.flavors.length > 0 && (
        <View testID="strain-flavors">
          <Text className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">
            {translate('strains.detail.flavors')}
          </Text>
          <View className="flex-row flex-wrap">
            {strain.flavors.map((flavor) => (
              <View
                key={flavor.name}
                className="mb-3 mr-3 flex-row items-center rounded-full border border-primary-200 bg-primary-100 px-5 py-3 dark:border-primary-700 dark:bg-primary-900/40"
              >
                <Leaf
                  width={18}
                  height={18}
                  color={colors.ink[700]}
                  className="mr-2"
                />
                <Text className="text-sm font-bold text-primary-900 dark:text-primary-100">
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

const HardFactsGrid = ({ strain }: { strain: Strain }) => {
  const floweringTime =
    strain.grow.flowering_time.label ??
    (strain.grow.flowering_time.min_weeks &&
    strain.grow.flowering_time.max_weeks
      ? `${strain.grow.flowering_time.min_weeks}-${strain.grow.flowering_time.max_weeks}`
      : 'N/A');

  const yieldRating =
    strain.grow.yield.indoor?.label ??
    strain.grow.yield.outdoor?.label ??
    'N/A';

  const difficulty =
    strain.grow?.difficulty === 'beginner'
      ? translate('strains.difficulty.beginner')
      : strain.grow?.difficulty === 'intermediate'
        ? translate('strains.difficulty.intermediate')
        : strain.grow?.difficulty === 'advanced'
          ? translate('strains.difficulty.advanced')
          : 'N/A';

  return (
    <View className="my-8 flex-row justify-between gap-3 px-4">
      <View className="flex-1 items-center justify-center rounded-2xl bg-primary-50 p-4 dark:bg-primary-900/40">
        <Calendar
          width={24}
          height={24}
          className="mb-2 text-primary-700 dark:text-primary-300"
        />
        <Text
          className="text-center text-lg font-bold text-neutral-900 dark:text-white"
          numberOfLines={1}
        >
          {floweringTime}
        </Text>
        <Text
          className="mt-1 text-[11px] font-extrabold uppercase tracking-widest text-primary-900/60 dark:text-primary-300/70"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {translate('strains.hardFacts.floweringTime')}
        </Text>
      </View>

      <View className="flex-1 items-center justify-center rounded-2xl bg-primary-50 p-4 dark:bg-primary-900/40">
        <Scale
          width={24}
          height={24}
          color={colors.ink[700]}
          className="mb-2"
        />
        <Text
          className="text-center text-lg font-bold text-neutral-900 dark:text-white"
          numberOfLines={1}
        >
          {yieldRating}
        </Text>
        <Text
          className="mt-1 text-[11px] font-extrabold uppercase tracking-widest text-primary-900/60 dark:text-primary-300/70"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {translate('strains.hardFacts.yield')}
        </Text>
      </View>

      <View className="flex-1 items-center justify-center rounded-2xl bg-primary-50 p-4 dark:bg-primary-900/40">
        <Sprout
          width={24}
          height={24}
          className="mb-2 text-primary-700 dark:text-primary-300"
        />
        <Text
          className="text-center text-lg font-bold text-neutral-900 dark:text-white"
          numberOfLines={1}
        >
          {difficulty}
        </Text>
        <Text
          className="mt-1 text-[11px] font-extrabold uppercase tracking-widest text-primary-900/60 dark:text-primary-300/70"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {translate('strains.hardFacts.cultivation')}
        </Text>
      </View>
    </View>
  );
};

const PremiumTagsRow = ({ strain }: { strain: Strain }) => {
  return (
    <View className="px-5 pt-2">
      <RaceBadge race={strain.race} variant="premium" />
    </View>
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

type StrainContentProps = {
  strain: Strain;
  scrollHandler: ReturnType<typeof useAnimatedScrollHandler>;
};

const StrainContentSheet = ({ strain }: { strain: Strain }) => (
  <View className="-mt-6 min-h-screen rounded-t-sheet bg-white pb-20 pt-4 shadow-2xl dark:bg-neutral-900">
    <View className="mb-4 w-full items-center">
      <View className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
    </View>
    <PremiumTagsRow strain={strain} />
    <Animated.View entering={FadeIn.delay(200).springify()}>
      <HardFactsGrid strain={strain} />
    </Animated.View>
    <View className="px-6 pb-6">
      <Text className="mb-4 text-xl font-bold text-neutral-900 dark:text-white">
        {translate('strains.detail.about')}
      </Text>
      {strain.description?.map((paragraph, index) => (
        <Animated.Text
          key={index}
          entering={FadeIn.delay(300 + index * 100)
            .springify()
            .reduceMotion(ReduceMotion.System)}
          className="mb-4 text-lg leading-8 text-neutral-600 dark:text-neutral-300"
        >
          {paragraph}
        </Animated.Text>
      ))}
    </View>
    <EffectsFlavorsSection strain={strain} />
  </View>
);

type NavButtonsProps = {
  strain: Strain;
  topInset: number;
  navStyle: ReturnType<typeof useAnimatedStyle>;
  onBack: () => void;
  onShare: () => void;
};

const FloatingNavButtons = ({
  strain,
  topInset,
  navStyle,
  onBack,
  onShare,
}: NavButtonsProps) => (
  <Animated.View
    className="absolute inset-x-0 top-0 z-20 flex-row items-center justify-between px-4"
    style={[{ paddingTop: topInset + 8 }, navStyle]}
  >
    <Pressable
      onPress={onBack}
      className="size-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm active:bg-black/40"
      accessibilityRole="button"
      accessibilityLabel={translate('accessibility.common.go_back')}
      accessibilityHint={translate('strains.detail.back_hint')}
      testID="back-button"
    >
      <ArrowLeft color={colors.white} width={24} height={24} />
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
        className="size-10 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm active:bg-black/40"
        accessibilityRole="button"
        accessibilityLabel={translate('strains.detail.share')}
        accessibilityHint={translate('strains.detail.share_hint')}
        testID="share-button"
      >
        <ShareIcon color={colors.white} width={24} height={24} />
      </Pressable>
    </View>
  </Animated.View>
);

const StrainScrollContent = ({ strain, scrollHandler }: StrainContentProps) => (
  <Animated.ScrollView
    className="z-10 flex-1"
    contentContainerClassName="pb-10"
    showsVerticalScrollIndicator={false}
    onScroll={scrollHandler}
    scrollEventThrottle={16}
    bounces={false}
  >
    <View className="h-hero justify-end px-6 pb-8">
      <View className="mb-2 flex-row gap-2">
        <View className="rounded-full bg-white/20 px-3 py-1 backdrop-blur-md">
          <Text className="text-xs font-bold uppercase tracking-wider text-white">
            {strain.race === 'hybrid'
              ? 'Hybrid'
              : strain.race === 'sativa'
                ? 'Sativa'
                : 'Indica'}
          </Text>
        </View>
      </View>
      <Text className="text-4xl font-extrabold text-white shadow-sm">
        {strain.name}
      </Text>
    </View>
    <StrainContentSheet strain={strain} />
  </Animated.ScrollView>
);

export default function StrainDetailsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const {
    data: strain,
    isLoading,
    isError,
    error,
    refetch,
  } = useStrain({ strainIdOrSlug: slug });

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

  const navButtonsStyle = useAnimatedStyle(() => {
    'worklet';
    // Clamp scroll value to [0, 200] range for opacity calculation
    const clampedScroll = Math.min(Math.max(scrollY.value, 0), 200);
    // Map 0-200 scroll to 1-0 opacity
    const opacity = 1 - clampedScroll / 200;
    return { opacity };
  });

  if (!slug) {
    return <InvalidIdState onBack={handleBack} />;
  }

  if (isError) {
    return (
      <StrainErrorState
        onBack={handleBack}
        onRetry={() => refetch()}
        topInset={insets.top}
      />
    );
  }

  if (isLoading || !strain) {
    return <StrainDetailSkeleton onBack={handleBack} />;
  }

  return (
    <View
      className="relative flex-1 bg-white dark:bg-neutral-950"
      testID="strain-detail-screen"
    >
      {/* --- 1. FIXED BACKGROUND HEADER (Absolute) --- */}
      <View className="absolute inset-x-0 top-0 z-0 h-[450px] bg-neutral-900">
        <AnimatedImage
          className="size-full opacity-90"
          contentFit="cover"
          sharedTransitionTag={strainImageTag(strain.slug)}
          {...imageProps}
        />
        <AnimatedLinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.95)']}
          locations={[0, 0.5, 1]}
          className="absolute inset-0 z-10"
        />
      </View>

      <FloatingNavButtons
        strain={strain}
        topInset={insets.top}
        navStyle={navButtonsStyle}
        onBack={handleBack}
        onShare={handleShare}
      />

      <StrainScrollContent strain={strain} scrollHandler={scrollHandler} />
    </View>
  );
}
