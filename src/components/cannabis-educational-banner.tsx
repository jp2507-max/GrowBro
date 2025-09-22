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
      className={`rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-900/40 ${className ?? ''}`.trim()}
    >
      <Text className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        {translate('cannabis.educational_banner_title')}
      </Text>
      <Text className="mt-1 text-sm text-amber-800 dark:text-amber-100">
        {translate('cannabis.educational_banner_body')}
      </Text>
    </View>
  );
}
