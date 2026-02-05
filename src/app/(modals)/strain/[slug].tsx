/**
 * Strain Detail Modal
 *
 * Full-screen modal presentation of strain details.
 * Used when navigating to a strain from screens outside the strains tab
 * (e.g., plants, feed posts) to preserve proper back navigation.
 *
 * This is a thin wrapper around the strains detail screen logic,
 * adapted for modal presentation.
 */

import { Env } from '@env';
import * as Sentry from '@sentry/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as React from 'react';
import { useLayoutEffect } from 'react';
import { Share } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStrain } from '@/api/strains/use-strain';
import { FloatingNavButtons } from '@/components/strains/modal/floating-nav-buttons';
import { InvalidIdState } from '@/components/strains/modal/invalid-id-state';
import { StrainErrorState } from '@/components/strains/modal/strain-error-state';
import { StrainModalSkeleton } from '@/components/strains/modal/strain-modal-skeleton';
import { StrainScrollContent } from '@/components/strains/modal/strain-scroll-content';
import { Image, View } from '@/components/ui';
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
function cacheStrainToSupabase(strain: Strain): void {
  // `public.strain_cache` is service-role-only writable (RLS).
  // Caching is handled by the server-side `strains-proxy` Edge Function.
  // Keep as a no-op to avoid dev/prod RLS noise.
  if (isProxyEnabled()) return;
  void strain;
}

/** Share strain via native share sheet */
async function shareStrain(strain: Strain): Promise<void> {
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

export default function StrainModalScreen(): React.ReactElement {
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
      console.error('[StrainModal] Failed to load strain:', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      Sentry.captureException(error, {
        tags: { screen: 'StrainModal', slug: slug ?? 'undefined' },
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

  const handleClose = React.useCallback(() => {
    haptics.selection();
    router.back();
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
    return <InvalidIdState onClose={handleClose} />;
  }

  if (isError) {
    return (
      <StrainErrorState
        onClose={handleClose}
        onRetry={() => refetch()}
        topInset={insets.top}
      />
    );
  }

  if (isLoading || !strain) {
    return <StrainModalSkeleton onClose={handleClose} />;
  }

  return (
    <View
      className="relative flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="strain-modal-screen"
    >
      {/* --- 1. FIXED BACKGROUND HEADER (Absolute) --- */}
      <View className="absolute inset-x-0 top-0 z-0 h-[450px] bg-neutral-900">
        <AnimatedImage
          className="size-full opacity-90"
          contentFit="cover"
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
        onClose={handleClose}
        onShare={handleShare}
      />

      <StrainScrollContent strain={strain} scrollHandler={scrollHandler} />
    </View>
  );
}
