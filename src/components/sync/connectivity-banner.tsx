import React from 'react';

import { Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import {
  getNetworkState,
  type NetworkState,
  onConnectivityChange,
} from '@/lib/sync/network-manager';

type Props = {
  className?: string;
  onPress?: () => void;
  testID?: string;
};

export function ConnectivityBanner({
  className,
  onPress,
  testID,
}: Props): React.ReactElement | null {
  const [state, setState] = React.useState<NetworkState | null>(null);

  React.useEffect(() => {
    let mounted = true;
    void getNetworkState().then((s) => {
      if (mounted) setState(s);
    });
    const off = onConnectivityChange((s) => setState(s));
    return () => {
      mounted = false;
      off?.();
    };
  }, []);

  if (!state) return null;
  if (state.isConnected && state.isInternetReachable) return null;

  const content = (
    <View
      accessibilityRole="text"
      className="w-full items-center justify-center"
    >
      <Text className="text-center text-xs text-yellow-900">
        {translate('sync.offline_banner')}
      </Text>
    </View>
  );

  if (!onPress) {
    return (
      <View
        className={`w-full bg-yellow-100 px-3 py-2 ${className ?? ''}`}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityHint={translate('sync.offline_banner_action_hint')}
      accessibilityLabel={translate('sync.offline_banner_action_label')}
      accessibilityRole="button"
      className={`w-full bg-yellow-100 px-3 py-2 ${className ?? ''}`}
      onPress={onPress}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}
