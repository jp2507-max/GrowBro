declare module '@react-native-community/netinfo' {
  export type NetInfoState = {
    type?: string;
    isConnected?: boolean | null;
    isInternetReachable?: boolean | null;
    details?: { isConnectionExpensive?: boolean | null } | null;
  };

  export type NetInfoSubscription = () => void;

  export function addEventListener(
    listener: (state: NetInfoState) => void
  ): NetInfoSubscription;

  export function fetch(): Promise<NetInfoState>;

  const _default: {
    addEventListener: typeof addEventListener;
    fetch: typeof fetch;
  };

  export default _default;
}
