import * as React from 'react';

import { Pressable, View } from '@/components/ui';
import { X } from '@/components/ui/icons';
import { ListErrorState } from '@/components/ui/list';
import { translate } from '@/lib/i18n';

type Props = {
  onClose: () => void;
  onRetry: () => void;
  topInset: number;
};

export function StrainErrorState({
  onClose,
  onRetry,
  topInset,
}: Props): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const iconColor =
    colorScheme === 'dark' ? colors.neutral[100] : colors.charcoal[900];

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="strain-modal-error"
    >
      <View
        className="flex-row items-center px-4"
        style={{ paddingTop: topInset + 8 }}
      >
        <Pressable
          accessibilityHint={translate('accessibility.modal.close_hint')}
          accessibilityLabel={translate('accessibility.modal.close_label')}
          accessibilityRole="button"
          className="size-10 items-center justify-center rounded-full bg-white text-charcoal-900 dark:bg-white/10 dark:text-neutral-100"
          onPress={onClose}
          testID="close-button"
        >
          <X color={iconColor} width={20} height={20} />
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
}
