import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useBottomTabBarHeight(): {
  netHeight: number;
  grossHeight: number;
} {
  const insets = useSafeAreaInsets();
  const netHeight = 60;
  return { netHeight, grossHeight: insets.bottom + netHeight };
}
