import { Link } from 'expo-router';
import React from 'react';

import { ItemsContainer } from '@/components/settings/items-container';
import { Text } from '@/components/ui';
import { translate } from '@/lib';

export function DevDiagnosticsItem(): React.ReactElement | null {
  if (!__DEV__) return null;
  return (
    <ItemsContainer title="settings.more">
      <Link href="/sync-diagnostics">
        <Text className="text-primary-600 underline">
          {translate('diagnostics.title')}
        </Text>
      </Link>
    </ItemsContainer>
  );
}
