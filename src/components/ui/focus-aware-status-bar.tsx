import { useIsFocused } from '@react-navigation/native';
import { useColorScheme } from 'nativewind';
import * as React from 'react';
import { Platform } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';

type Props = { hidden?: boolean; style?: 'light' | 'dark' };
export const FocusAwareStatusBar = ({ hidden = false, style }: Props) => {
  const isFocused = useIsFocused();
  const { colorScheme } = useColorScheme();

  if (Platform.OS === 'web') return null;

  // Use provided style or auto-determine from colorScheme
  const barStyle = style ?? (colorScheme === 'light' ? 'dark' : 'light');

  return isFocused ? <SystemBars style={barStyle} hidden={hidden} /> : null;
};
