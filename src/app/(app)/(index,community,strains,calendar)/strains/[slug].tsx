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
import { THCBadge } from '@/components/strains';
import { FavoriteButtonConnected } from '@/components/strains/favorite-button-connected';
import { RaceBadge } from '@/components/strains/race-badge';
import { StrainDetailSkeleton } from '@/components/strains/strain-detail-skeleton';
import { GlassButton, Image, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import {
  ArrowLeft,
  Calendar,
  Leaf,
  Scale,
  Share as ShareIcon,
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

/** Hero image overlay gradient colors (dark overlay for text readability) */
const HERO_GRADIENT_COLORS = [
  'transparent',
  'rgba(0,0,0,0.4)',
  'rgba(0,0,0,0.95)',
] as const;

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
  // `public.strain_cache` is service-role-only writable (RLS).
  // Caching is handled by the server-side `strains-proxy` Edge Function.
  // Keep as a no-op to avoid dev/prod RLS noise.
  if (isProxyEnabled()) return;
  void strain;
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

const SectionHeader = ({ title }: { title: string }): React.ReactElement => (
  <View className="mb-3 flex-row items-center gap-2">
    <View className="h-5 w-1 rounded-full bg-neon-lime shadow-[0_0_8px_#94fa2e]" />
    <Text className="text-xl font-bold text-neutral-900 dark:text-white">
      {title}
    </Text>
  </View>
);

const EffectsFlavorsSection = ({
  strain,
}: {
  strain: Strain;
}): React.ReactElement => {
  return (
    <Animated.View
      entering={FadeIn.delay(400).springify().reduceMotion(ReduceMotion.System)}
      className="mt-8 space-y-6 px-6 pb-6"
    >
      {strain.effects && strain.effects.length > 0 && (
        <View testID="strain-effects">
          <SectionHeader title={translate('strains.detail.effects')} />
          <View className="flex-row flex-wrap gap-2">
            {strain.effects.map((effect, index) => (
              <View
                key={effect.name}
                className={`rounded-xl border px-5 py-2.5 ${
                  index === 0
                    ? 'border-neon-lime/30 bg-white/5'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    index === 0 ? 'text-neon-lime' : 'text-white'
                  }`}
                >
                  {effect.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {strain.flavors && strain.flavors.length > 0 && (
        <View testID="strain-flavors">
          <SectionHeader title={translate('strains.detail.flavors')} />
          <View className="flex-row flex-wrap gap-2">
            {strain.flavors.map((flavor) => (
              <View
                key={flavor.name}
                className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2"
              >
                <Leaf width={16} height={16} color={colors.neutral[400]} />
                <Text className="text-sm text-white/80">{flavor.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const StatsCard = ({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ width: number; height: number; color: string }>;
  value: string;
  label: string;
}): React.ReactElement => (
  <View className="flex-1 items-center justify-center gap-2 rounded-2xl border border-white/5 bg-gradient-to-b from-white/5 to-white/[0.01] p-3 shadow-[0_4px_20px_-5px_rgba(0,0,0,0.3)]">
    <View className="size-10 items-center justify-center rounded-full border border-neon-lime/20 bg-neon-lime/10 shadow-[0_0_10px_rgba(148,250,46,0.1)]">
      <Icon width={20} height={20} color={colors.neon.lime} />
    </View>
    <View className="items-center">
      <Text
        className="text-[10px] font-bold uppercase tracking-wider text-white/40"
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text className="text-sm font-bold text-white" numberOfLines={1}>
        {value}
      </Text>
    </View>
  </View>
);

const HardFactsGrid = ({ strain }: { strain: Strain }): React.ReactElement => {
  const floweringTime =
    strain.grow?.flowering_time?.label ??
    (strain.grow?.flowering_time?.min_weeks &&
    strain.grow?.flowering_time?.max_weeks
      ? `${strain.grow.flowering_time.min_weeks}-${strain.grow.flowering_time.max_weeks}`
      : translate('common.na'));

  const yieldRating =
    strain.grow?.yield?.indoor?.label ??
    strain.grow?.yield?.outdoor?.label ??
    translate('common.na');

  const difficulty =
    strain.grow?.difficulty === 'beginner'
      ? translate('strains.difficulty.beginner')
      : strain.grow?.difficulty === 'intermediate'
        ? translate('strains.difficulty.intermediate')
        : strain.grow?.difficulty === 'advanced'
          ? translate('strains.difficulty.advanced')
          : translate('common.na');

  return (
    <View className="my-6 flex-row gap-3 px-6">
      <StatsCard
        icon={Calendar}
        value={floweringTime}
        label={translate('strains.hard_facts.flowering_time')}
      />
      <StatsCard
        icon={Scale}
        value={yieldRating}
        label={translate('strains.hard_facts.yield')}
      />
      <StatsCard
        icon={Sprout}
        value={difficulty}
        label={translate('strains.hard_facts.cultivation')}
      />
    </View>
  );
};

const BadgesRow = ({ strain }: { strain: Strain }): React.ReactElement => {
  return (
    <View className="flex-row items-center gap-3">
      <RaceBadge race={strain.race} variant="neon" />
      {strain.thc_display && (
        <THCBadge thc={`THC ${strain.thc_display}`} variant="outline" />
      )}
    </View>
  );
};

type ErrorStateProps = {
  onBack: () => void;
  onRetry: () => void;
  topInset: number;
};

const StrainErrorState = ({
  onBack,
  onRetry,
  topInset,
}: ErrorStateProps): React.ReactElement => (
  <View
    className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
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
        className="size-10 items-center justify-center rounded-full bg-white text-charcoal-900 dark:bg-white/10 dark:text-neutral-100"
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

const InvalidIdState = ({
  onBack,
}: {
  onBack: () => void;
}): React.ReactElement => (
  <View
    className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
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

const StrainContentSheet = ({
  strain,
}: {
  strain: Strain;
}): React.ReactElement => (
  <View className="rounded-t-3xl bg-charcoal-950 pb-8 pt-6">
    <Animated.View
      entering={FadeIn.delay(200).springify().reduceMotion(ReduceMotion.System)}
    >
      <HardFactsGrid strain={strain} />
    </Animated.View>
    <View className="mt-6 px-6">
      <SectionHeader title={translate('strains.detail.about')} />
      {strain.description?.map((paragraph, index) => (
        <Animated.Text
          key={index}
          entering={FadeIn.delay(300 + index * 100)
            .springify()
            .reduceMotion(ReduceMotion.System)}
          className="mb-4 text-base leading-relaxed text-white/70"
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
}: NavButtonsProps): React.ReactElement => (
  <Animated.View
    className="absolute inset-x-0 top-0 z-20 flex-row items-center justify-between px-4"
    style={[{ paddingTop: topInset + 8 }, navStyle]}
  >
    <GlassButton
      onPress={onBack}
      accessibilityLabel={translate('accessibility.common.go_back')}
      accessibilityHint={translate('strains.detail.back_hint')}
      testID="back-button"
      fallbackClassName="bg-black/30"
    >
      <ArrowLeft color={colors.white} width={24} height={24} />
    </GlassButton>
    <View className="flex-row gap-3">
      <FavoriteButtonConnected
        strainId={strain.id}
        strain={strain}
        variant="overlay"
        testID="favorite-button"
      />
      <GlassButton
        onPress={onShare}
        accessibilityLabel={translate('strains.detail.share')}
        accessibilityHint={translate('strains.detail.share_hint')}
        testID="share-button"
        fallbackClassName="bg-black/30"
      >
        <ShareIcon color={colors.white} width={24} height={24} />
      </GlassButton>
    </View>
  </Animated.View>
);

const StrainScrollContent = ({
  strain,
  scrollHandler,
}: StrainContentProps): React.ReactElement => (
  <Animated.ScrollView
    className="z-10 flex-1"
    contentContainerClassName="pb-20 flex-grow"
    showsVerticalScrollIndicator={false}
    onScroll={scrollHandler}
    scrollEventThrottle={16}
    bounces={false}
  >
    <View className="h-[380px] justify-end px-6 pb-6">
      <BadgesRow strain={strain} />
      <Text className="mt-3 text-4xl font-bold tracking-tight text-white">
        {strain.name}
      </Text>
    </View>
    <StrainContentSheet strain={strain} />
  </Animated.ScrollView>
);

export default function StrainDetailsScreen(): React.ReactElement {
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
      scrollY.set(event.contentOffset.y);
    },
  });

  const navButtonsStyle = useAnimatedStyle(() => {
    // Clamp scroll value to [0, 200] range for opacity calculation
    const clampedScroll = Math.min(Math.max(scrollY.get(), 0), 200);
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
      className="relative flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="strain-detail-screen"
    >
      {/* --- 1. FIXED BACKGROUND HEADER (Absolute) --- */}
      <View className="absolute inset-x-0 top-0 z-0 h-[450px] bg-neutral-900">
        <AnimatedImage
          className="size-full"
          contentFit="cover"
          sharedTransitionTag={strainImageTag(strain.slug)}
          {...imageProps}
        />
        <AnimatedLinearGradient
          colors={HERO_GRADIENT_COLORS}
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
