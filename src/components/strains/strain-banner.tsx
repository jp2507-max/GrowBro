import * as React from 'react';

import type { Strain } from '@/api';
import { DifficultyBadge } from '@/components/strains/difficulty-badge';
import { RaceBadge } from '@/components/strains/race-badge';
import { THCBadge } from '@/components/strains/thc-badge';
import { Image, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import { getDetailImageProps } from '@/lib/strains/image-optimization';

type Props = {
  strain: Strain;
  testID?: string;
};

export const StrainBanner = React.memo<Props>(({ strain, testID }) => {
  const indoorOutdoorText = React.useMemo(() => {
    const parts: string[] = [];
    if (strain.grow.indoor_suitable) {
      parts.push(translate('strains.detail.indoor'));
    }
    if (strain.grow.outdoor_suitable) {
      parts.push(translate('strains.detail.outdoor'));
    }
    return parts.length > 0
      ? parts.join(' • ')
      : translate('strains.detail.not_reported');
  }, [strain.grow.indoor_suitable, strain.grow.outdoor_suitable]);

  // Get optimized image props for detail view (higher resolution)
  const imageProps = React.useMemo(
    () => getDetailImageProps(strain.id, strain.imageUrl),
    [strain.id, strain.imageUrl]
  );

  return (
    <View testID={testID}>
      {/* Hero Image */}
      <Image
        className="h-64 w-full"
        contentFit="cover"
        {...imageProps}
        accessibilityLabel={`${strain.name} strain image`}
        accessibilityHint="Strain image for visual identification"
      />

      {/* At-a-glance info */}
      <View className="mx-4 -mt-8 rounded-2xl bg-white p-4 shadow-lg dark:bg-neutral-900">
        <View className="mb-3 flex-row flex-wrap gap-1.5">
          <RaceBadge race={strain.race} />
          {strain.thc_display && <THCBadge thc={strain.thc_display} />}
          {strain.cbd.label || strain.cbd.min !== undefined ? (
            <View className="rounded-full bg-success-100 px-3 py-1 dark:bg-success-900">
              <Text className="text-xs font-medium text-success-800 dark:text-success-100">
                {translate('strains.detail.cbd')}:{' '}
                {strain.cbd_display || translate('strains.detail.not_reported')}
              </Text>
            </View>
          ) : null}
          <DifficultyBadge difficulty={strain.grow.difficulty} />
        </View>

        {/* Growing Environment */}
        <View className="flex-row items-center">
          <Text className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {translate('strains.detail.suitable_for')}:
          </Text>
          <Text className="ml-2 text-sm text-neutral-700 dark:text-neutral-300">
            {indoorOutdoorText}
          </Text>
        </View>
      </View>
    </View>
  );
});

StrainBanner.displayName = 'StrainBanner';
