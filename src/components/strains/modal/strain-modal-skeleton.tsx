import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StrainDetailSkeleton } from '@/components/strains/strain-detail-skeleton';
import { Pressable, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { X } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';

type Props = {
  onClose: () => void;
};

export function StrainModalSkeleton({ onClose }: Props): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const iconColor =
    colorScheme === 'dark' ? colors.neutral[100] : colors.charcoal[900];

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
      <View
        className="flex-row items-center px-4"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          accessibilityHint={translate('accessibility.modal.close_hint')}
          accessibilityLabel={translate('accessibility.modal.close_label')}
          accessibilityRole="button"
          className="size-10 items-center justify-center rounded-full bg-neutral-200 dark:bg-white/10"
          onPress={onClose}
          testID="close-button"
        >
          <X color={iconColor} size={20} />
        </Pressable>
      </View>
      <StrainDetailSkeleton onBack={onClose} hideHeader={true} />
    </View>
  );
}
