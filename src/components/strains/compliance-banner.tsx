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
      className="mx-4 mt-3 rounded-lg bg-warning-50 p-3 dark:bg-warning-900/20"
      testID="strains-compliance-banner"
    >
      <Text className="text-xs font-medium text-warning-900 dark:text-warning-100">
        {translate('strains.compliance.headline')}
      </Text>
      <Text className="mt-1 text-xs text-warning-800 dark:text-warning-200">
        {translate('strains.compliance.body')}
      </Text>
    </View>
  );
}
