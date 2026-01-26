import * as React from 'react';

import { RaceBadge } from '@/components/strains/race-badge';
import { View } from '@/components/ui';
import type { Strain } from '@/types/strains';

type Props = {
  strain: Strain;
};

export function PremiumTagsRow({ strain }: Props): React.ReactElement {
  return (
    <View className="px-5 pt-2">
      <RaceBadge race={strain.race} variant="premium" />
    </View>
  );
}
