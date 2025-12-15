import React from 'react';

import { Text, View } from '@/components/ui';
import type { TxKeyPath } from '@/lib';

type Props = {
  children: React.ReactNode;
  title?: TxKeyPath;
  testID?: string;
};

export const ItemsContainer = ({ children, title, testID }: Props) => {
  return (
    <>
      {title && (
        <Text className="pb-2 pt-4 text-lg text-text-primary" tx={title} />
      )}
      {
        <View
          testID={testID}
          className="rounded-md border border-border bg-card"
        >
          {children}
        </View>
      }
    </>
  );
};
