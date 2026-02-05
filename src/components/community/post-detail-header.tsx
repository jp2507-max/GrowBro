/**
 * PostDetailHeader - Sticky glass-blur header with back, title, and more options
 */

import * as React from 'react';

import { GlassButton, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { ArrowLeft, MoreHorizontal } from '@/components/ui/icons';
import { translate, type TxKeyPath } from '@/lib/i18n';

type PostDetailHeaderProps = {
  onBack: () => void;
  onOptionsPress?: () => void;
  topInset: number;
};

export function PostDetailHeader({
  onBack,
  onOptionsPress,
  topInset,
}: PostDetailHeaderProps): React.ReactElement {
  return (
    <View
      className="z-50 border-b border-white/5 bg-charcoal-950 pb-3"
      style={{
        paddingTop: topInset + 12,
      }}
    >
      <View className="flex-row items-center justify-between px-4">
        {/* Back Button */}
        <GlassButton
          onPress={onBack}
          accessibilityLabel={translate('nav.back' as TxKeyPath)}
          accessibilityHint={translate('accessibility.back_hint' as TxKeyPath)}
          fallbackClassName="bg-white/10"
        >
          <ArrowLeft color={colors.white} width={22} height={22} />
        </GlassButton>

        {/* Centered Title */}
        <Text className="text-lg font-bold tracking-tight text-white">
          {translate('community.discussion' as TxKeyPath)}
        </Text>

        {/* More Options Button */}
        <Pressable
          onPress={onOptionsPress}
          accessibilityRole="button"
          accessibilityLabel={translate(
            'accessibility.community.post_options' as TxKeyPath
          )}
          accessibilityHint={translate(
            'accessibility.community.post_options_hint' as TxKeyPath
          )}
          className="size-10 items-center justify-center rounded-full bg-white/10"
        >
          <MoreHorizontal width={20} height={20} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}
