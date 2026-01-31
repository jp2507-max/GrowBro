import { Link } from 'expo-router';
import * as React from 'react';
import { Platform, StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Image, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { translate } from '@/lib';
import { haptics } from '@/lib/haptics';
import { formatStrainCardLabel } from '@/lib/strains/accessibility';
import { getListImageProps } from '@/lib/strains/image-optimization';
import type { Strain } from '@/types/strains';

type StrainListItemProps = {
  strain: Strain;
  testID?: string;
  onStartNavigation?: (strainId: string) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Helper to determine if strain is CBD-focused
function getIsCbdStrain(cbdDisplay?: string): boolean {
  if (!cbdDisplay) return false;
  const cbdMatch = cbdDisplay.match(/(\d+)/);
  return cbdMatch ? parseInt(cbdMatch[1], 10) >= 5 : false;
}

// Helper to get flavor notes
function getFlavorNotes(strain: Strain): string | null {
  if (strain.flavors?.length) {
    return strain.flavors
      .slice(0, 2)
      .map((f) => f.name)
      .join(' & ');
  }
  if (strain.description?.[0]) {
    const desc = strain.description[0];
    return desc.length > 30 ? `${desc.slice(0, 30)}...` : desc;
  }
  return null;
}

// Extracted: Badges row
type ListItemBadgesProps = {
  strain: Strain;
  isCbd: boolean;
  raceLabel: string;
};
const ListItemBadges = React.memo<ListItemBadgesProps>(
  ({ strain, isCbd, raceLabel }) => (
    <View className="flex-row gap-2">
      {(strain.thc_display || strain.cbd_display) && (
        <View
          style={isCbd ? styles.cbdBadge : styles.thcBadge}
          className="flex-row items-center rounded px-2 py-0.5"
        >
          <View
            style={isCbd ? styles.cbdDot : styles.thcDot}
            className="mr-1.5 size-1.5 rounded-full"
          />
          <Text
            style={isCbd ? styles.cbdText : styles.thcText}
            className="text-[10px] font-bold tracking-wider"
          >
            {isCbd ? `${strain.cbd_display} CBD` : `${strain.thc_display} THC`}
          </Text>
        </View>
      )}
      <View style={styles.raceBadge} className="rounded px-2 py-0.5">
        <Text
          style={styles.raceText}
          className="text-[10px] font-medium tracking-wider"
        >
          {raceLabel}
        </Text>
      </View>
    </View>
  )
);
ListItemBadges.displayName = 'ListItemBadges';

// Extracted: Content section
type ListItemContentProps = {
  strain: Strain;
  flavorNotes: string | null;
  isCbd: boolean;
  raceLabel: string;
};
const ListItemContent = React.memo<ListItemContentProps>(
  ({ strain, flavorNotes, isCbd, raceLabel }) => (
    <View className="min-w-0 flex-1 justify-center py-1">
      <View className="flex-row items-start justify-between">
        <Text
          className="flex-1 pr-2 text-lg font-bold text-white"
          numberOfLines={1}
        >
          {strain.name}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      {flavorNotes && (
        <Text
          className="mb-2 text-xs font-medium text-white/50"
          numberOfLines={1}
        >
          {flavorNotes}
        </Text>
      )}
      <ListItemBadges strain={strain} isCbd={isCbd} raceLabel={raceLabel} />
    </View>
  )
);
ListItemContent.displayName = 'ListItemContent';

/**
 * Compact list item for strains in the discovery list.
 */
export const StrainListItem = React.memo<StrainListItemProps>(
  ({ strain, testID, onStartNavigation }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.get() }],
    }));

    const onPressIn = React.useCallback(() => {
      haptics.selection();
      onStartNavigation?.(strain.id);
      scale.set(
        withSpring(0.98, {
          damping: 15,
          stiffness: 400,
          reduceMotion: ReduceMotion.System,
        })
      );
    }, [onStartNavigation, scale, strain.id]);

    const onPressOut = React.useCallback(() => {
      scale.set(
        withSpring(1, {
          damping: 15,
          stiffness: 400,
          reduceMotion: ReduceMotion.System,
        })
      );
    }, [scale]);

    const imageProps = React.useMemo(
      () => getListImageProps(strain.id, strain.imageUrl),
      [strain.id, strain.imageUrl]
    );
    const accessibilityLabel = React.useMemo(
      () =>
        formatStrainCardLabel({
          name: strain.name,
          race: strain.race,
          thc_display: strain.thc_display,
          difficulty: strain.grow.difficulty,
        }),
      [strain.name, strain.race, strain.thc_display, strain.grow.difficulty]
    );
    const flavorNotes = React.useMemo(() => getFlavorNotes(strain), [strain]);
    const isCbd = React.useMemo(
      () => getIsCbdStrain(strain.cbd_display),
      [strain.cbd_display]
    );
    const raceLabel = React.useMemo(() => {
      const map = {
        indica: translate('strains.race.indica'),
        sativa: translate('strains.race.sativa'),
        hybrid: translate('strains.race.hybrid'),
      };
      return map[strain.race] || strain.race;
    }, [strain.race]);

    return (
      <Link href={`/strains/${strain.slug}`} asChild>
        <AnimatedPressable
          testID={testID}
          accessibilityRole="link"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={translate(
            'accessibility.strains.open_detail_hint'
          )}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          style={animatedStyle}
          className="mx-5 mb-4"
        >
          <View
            style={[
              styles.cardContainer,
              isDark ? styles.cardDark : styles.cardLight,
            ]}
            className="flex-row items-center gap-4 rounded-xl p-3"
          >
            <View className="size-20 shrink-0 overflow-hidden rounded-lg bg-black">
              <Image className="size-full" contentFit="cover" {...imageProps} />
            </View>
            <ListItemContent
              strain={strain}
              flavorNotes={flavorNotes}
              isCbd={isCbd}
              raceLabel={raceLabel}
            />
          </View>
        </AnimatedPressable>
      </Link>
    );
  }
);
StrainListItem.displayName = 'StrainListItem';

const styles = StyleSheet.create({
  cardContainer: {
    backdropFilter: 'blur(8px)',
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  chevron: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.2)',
    fontWeight: '300',
  },
  thcBadge: {
    backgroundColor: 'rgba(148, 250, 46, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(148, 250, 46, 0.2)',
  },
  thcDot: {
    backgroundColor: colors.neon.lime,
    shadowColor: colors.neon.lime,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  thcText: {
    color: colors.neon.lime,
  },
  cbdBadge: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  cbdDot: {
    backgroundColor: '#60A5FA',
    shadowColor: '#60A5FA',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  cbdText: {
    color: '#60A5FA',
  },
  raceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  raceText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
