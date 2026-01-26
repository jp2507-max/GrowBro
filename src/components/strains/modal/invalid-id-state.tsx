import * as React from 'react';

import { View } from '@/components/ui';
import { ListErrorState } from '@/components/ui/list';
import { translate } from '@/lib/i18n';

type Props = {
  onClose: () => void;
};

export function InvalidIdState({ onClose }: Props): React.ReactElement {
  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="strain-modal-invalid"
    >
      <ListErrorState
        title={translate('strains.detail.invalid_id')}
        body={translate('strains.detail.error_message')}
        onRetry={onClose}
        retryLabel={translate('common.close')}
      />
    </View>
  );
}
