/**
 * PostDetailHeader - Green header with back button
 */

import * as React from 'react';

import { GlassButton, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowLeft } from '@/components/ui/icons';
import { translate, type TxKeyPath } from '@/lib/i18n';
import { type getHeaderColors } from '@/lib/theme-utils';

type PostDetailHeaderProps = {
  onBack: () => void;
  topInset: number;
  headerColors: ReturnType<typeof getHeaderColors>;
};

export function PostDetailHeader({
  onBack,
  topInset,
  headerColors,
}: PostDetailHeaderProps): React.ReactElement {
  return (
    <View
      className="z-0 px-5 pb-16"
      style={{
        paddingTop: topInset + 12,
        backgroundColor: headerColors.background,
      }}
    >
      <View className="flex-row items-center gap-4">
        <GlassButton
          onPress={onBack}
          accessibilityLabel={translate('nav.back' as TxKeyPath)}
          accessibilityHint={translate('accessibility.back_hint' as TxKeyPath)}
          fallbackClassName="bg-white/15"
        >
          <ArrowLeft color={colors.white} width={20} height={20} />
        </GlassButton>
        <Text
          className="text-2xl font-bold tracking-tight"
          style={{ color: headerColors.text }}
        >
          {translate('nav.post' as TxKeyPath)}
        </Text>
      </View>
    </View>
  );
}

export default PostDetailHeader;
