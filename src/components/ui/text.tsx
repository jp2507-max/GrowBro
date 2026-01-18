import type { TOptions } from 'i18next';
import React from 'react';
import type { TextProps, TextStyle } from 'react-native';
import { I18nManager, StyleSheet, Text as NNText } from 'react-native';

import type { TxKeyPath } from '@/lib/i18n';
import { translate } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type Props = TextProps & {
  className?: string;
  tx?: TxKeyPath;
  txOptions?: TOptions;
};

export const Text = ({
  className = '',
  style,
  tx,
  txOptions,
  children,
  ...props
}: Props) => {
  const textStyle = React.useMemo(
    () => cn('text-base text-black dark:text-white font-normal', className),
    [className]
  );

  const nStyle = React.useMemo(
    () =>
      StyleSheet.flatten([
        {
          writingDirection: I18nManager.isRTL ? 'rtl' : 'ltr',
        },
        style,
      ]) as TextStyle,
    [style]
  );
  return (
    <NNText className={textStyle} style={nStyle} {...props}>
      {tx ? translate(tx, txOptions) : children}
    </NNText>
  );
};
