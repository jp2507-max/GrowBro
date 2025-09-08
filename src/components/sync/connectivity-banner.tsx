import React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib';
import {
  getNetworkState,
  type NetworkState,
  onConnectivityChange,
} from '@/lib/sync/network-manager';

type Props = {
  className?: string;
};

export function ConnectivityBanner({
  className,
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

  return (
    <View className={`w-full bg-yellow-100 px-3 py-2 ${className ?? ''}`}>
      <Text className="text-center text-xs text-yellow-900">
        {translate('sync.offline_banner')}
      </Text>
    </View>
  );
}
