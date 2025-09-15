import React from 'react';
import type { SvgProps } from 'react-native-svg';

import { Feeding } from '@/components/ui/icons/feeding';
import { Flush } from '@/components/ui/icons/flush';
import { TopDress } from '@/components/ui/icons/top-dress';

export type EventType = 'feeding' | 'flush' | 'top_dress';

type Props = {
  type: EventType;
  color?: string;
  size?: number;
  testID?: string;
};

export function EventTypeIcon({
  type,
  color = '#111827',
  size = 16,
  testID,
}: Props): React.ReactElement | null {
  const common: Pick<SvgProps, 'width' | 'height' | 'color'> = {
    width: size,
    height: size,
    color,
  };
  if (type === 'feeding') return <Feeding testID={testID} {...common} />;
  if (type === 'flush') return <Flush testID={testID} {...common} />;
  if (type === 'top_dress') return <TopDress testID={testID} {...common} />;
  return null;
}
