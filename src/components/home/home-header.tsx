import React from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import {
  HeaderGreeting,
  HeaderSettingsButton,
  HeaderStatsPill,
  ScreenHeaderBase,
} from '@/components/navigation/screen-header-base';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';

type HomeHeaderProps = {
  plantCount: number;
  taskCount: number;
  insets: EdgeInsets;
};

export function HomeHeader({
  plantCount,
  taskCount,
  insets,
}: HomeHeaderProps): React.ReactElement {
  return (
    <ScreenHeaderBase
      insets={insets}
      topRowLeft={<HeaderGreeting />}
      topRowRight={<HeaderSettingsButton />}
      title={translate('home.plants_section.title' as TxKeyPath)}
      testID="home-header"
    >
      <HeaderStatsPill plantCount={plantCount} taskCount={taskCount} />
    </ScreenHeaderBase>
  );
}
