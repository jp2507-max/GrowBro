import { colorScheme, useColorScheme } from 'nativewind';
import React from 'react';
import { Appearance } from 'react-native';
import { useMMKVString } from 'react-native-mmkv';

import { storage } from '../storage';

const SELECTED_THEME = 'SELECTED_THEME';
export type ColorSchemeType = 'light' | 'dark' | 'system';
/**
 * this hooks should only be used while selecting the theme
 * This hooks will return the selected theme which is stored in MMKV
 * selectedTheme should be one of the following values 'light', 'dark' or 'system'
 * don't use this hooks if you want to use it to style your component based on the theme use useColorScheme from nativewind instead
 *
 */
export const useSelectedTheme = () => {
  const { setColorScheme } = useColorScheme();
  const [theme, _setTheme] = useMMKVString(SELECTED_THEME, storage);

  const setSelectedTheme = React.useCallback(
    (t: ColorSchemeType) => {
      setColorScheme(t);
      _setTheme(t);
    },
    [setColorScheme, _setTheme]
  );

  const selectedTheme = (theme ?? 'system') as ColorSchemeType;
  return { selectedTheme, setSelectedTheme } as const;
};
// to be used in the root file to load the selected theme from MMKV
export const loadSelectedTheme = () => {
  const theme = storage.getString(SELECTED_THEME);
  if (theme === 'light' || theme === 'dark') {
    // User explicitly chose a theme - override NativeWind
    colorScheme.set(theme);
  } else {
    // 'system' or not set: use Appearance API directly
    // NativeWind's automatic detection has issues on Expo 54 native (GitHub #1640)
    const deviceScheme = Appearance.getColorScheme() ?? 'light';
    colorScheme.set(deviceScheme);
  }
};

// Hook to listen for device theme changes when user has 'system' selected
export const useSystemThemeListener = () => {
  const [storedTheme] = useMMKVString(SELECTED_THEME, storage);

  React.useEffect(() => {
    // Only listen if user wants to follow system preference
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return;
    }

    const subscription = Appearance.addChangeListener(
      ({ colorScheme: newScheme }) => {
        colorScheme.set(newScheme ?? 'light');
      }
    );

    return () => subscription.remove();
  }, [storedTheme]);
};
