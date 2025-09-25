import type { Theme } from '@react-navigation/native';
import {
  DarkTheme as _DarkTheme,
  DefaultTheme,
} from '@react-navigation/native';
import { useColorScheme } from 'nativewind';

import { themeRoles } from '@/lib/theme-tokens';

const DarkTheme: Theme = {
  ..._DarkTheme,
  colors: {
    ..._DarkTheme.colors,
    primary: themeRoles.action.primary.background.dark,
    background: themeRoles.surface.dark.background,
    text: themeRoles.text.dark.primary,
    border: themeRoles.surface.dark.border,
    card: themeRoles.surface.dark.card,
    notification: themeRoles.action.cta.background.dark,
  },
};

const LightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: themeRoles.action.primary.background.light,
    background: themeRoles.surface.light.background,
    text: themeRoles.text.light.primary,
    border: themeRoles.surface.light.border,
    card: themeRoles.surface.light.card,
    notification: themeRoles.action.cta.background.light,
  },
};

export function useThemeConfig(): Theme {
  const { colorScheme } = useColorScheme();

  if (colorScheme === 'dark') return DarkTheme;

  return LightTheme;
}
