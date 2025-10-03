import React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';
import {
  initializeRegionalCompliance,
  useRegionalCompliance,
} from '@/lib/compliance/regional-compliance';

export function ComplianceBanner(): React.ReactElement | null {
  const mode = useRegionalCompliance.use.mode();
  const isRestricted = useRegionalCompliance.use.isRestricted();

  React.useEffect(() => {
    initializeRegionalCompliance();
  }, []);

  if (mode !== 'conservative' && !isRestricted) {
    return null;
  }

  return (
    <View
      className="mx-4 mt-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20"
      testID="strains-compliance-banner"
    >
      <Text className="text-xs font-medium text-amber-900 dark:text-amber-100">
        {translate('strains.compliance.headline')}
      </Text>
      <Text className="mt-1 text-xs text-amber-800 dark:text-amber-200">
        {translate('strains.compliance.body')}
      </Text>
    </View>
  );
}
