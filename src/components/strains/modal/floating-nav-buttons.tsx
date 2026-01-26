import * as React from 'react';
import type { useAnimatedStyle } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';

import { FavoriteButtonConnected } from '@/components/strains/favorite-button-connected';
import { GlassButton, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Share as ShareIcon, X } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';
import type { Strain } from '@/types/strains';

type Props = {
  strain: Strain;
  topInset: number;
  navStyle: ReturnType<typeof useAnimatedStyle>;
  onClose: () => void;
  onShare: () => void;
};

export function FloatingNavButtons({
  strain,
  topInset,
  navStyle,
  onClose,
  onShare,
}: Props): React.ReactElement {
  return (
    <Animated.View
      className="absolute inset-x-0 top-0 z-20 flex-row items-center justify-between px-4"
      style={[{ paddingTop: topInset + 8 }, navStyle]}
    >
      <GlassButton
        onPress={onClose}
        accessibilityLabel={translate('accessibility.modal.close_label')}
        accessibilityHint={translate('accessibility.modal.close_hint')}
        testID="close-button"
        fallbackClassName="bg-black/30"
      >
        <X color={colors.white} width={24} height={24} />
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
}
