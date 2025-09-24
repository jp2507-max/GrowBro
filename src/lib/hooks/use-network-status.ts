import NetInfo, {
  type NetInfoState,
  type NetInfoSubscription,
} from '@react-native-community/netinfo';
import React from 'react';

type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean;
  state: NetInfoState | null;
};

const initialStatus: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  state: null,
};

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = React.useState<NetworkStatus>(initialStatus);

  React.useEffect(() => {
    let isMounted = true;
    let subscription: NetInfoSubscription | null = null;

    const update = (next: NetInfoState | null) => {
      if (!isMounted) return;
      if (!next) {
        setStatus(initialStatus);
        return;
      }
      setStatus({
        isConnected: Boolean(next.isConnected),
        isInternetReachable: next.isInternetReachable ?? true,
        state: next,
      });
    };

    void NetInfo.fetch().then(update);
    subscription = NetInfo.addEventListener(update);

    return () => {
      isMounted = false;
      if (subscription) {
        subscription();
        subscription = null;
      }
    };
  }, []);

  return status;
}
