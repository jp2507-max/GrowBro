import React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

type BannerProps = {
  className?: string;
};

export function CannabisEducationalBanner({
  className,
}: BannerProps): React.ReactElement {
  return (
    <View
      className={`rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 dark:border-warning-700 dark:bg-warning-900/40 ${className ?? ''}`.trim()}
    >
      <Text className="text-sm font-semibold text-warning-900 dark:text-warning-200">
        {translate('cannabis.educational_banner_title')}
      </Text>
      <Text className="mt-1 text-sm text-warning-800 dark:text-warning-100">
        {translate('cannabis.educational_banner_body')}
      </Text>
    </View>
  );
}
