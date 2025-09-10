import NetInfo from '@react-native-community/netinfo';

export type NetworkState = {
  type: string;
  isConnected: boolean;
  // NetInfo may return undefined for reachability in some environments/tests
  isInternetReachable?: boolean | null;
  details?: { isConnectionExpensive?: boolean } | null;
  isMetered: boolean;
};

let currentState: NetworkState | null = null;
let listeners: ((s: NetworkState) => void)[] = [];
let netInfoUnsub: (() => void) | null = null;

function normalize(raw: any): NetworkState {
  return {
    type: (raw?.type ?? 'unknown') as string,
    isConnected: Boolean(raw?.isConnected),
    isInternetReachable:
      raw?.isInternetReachable === undefined
        ? undefined
        : Boolean(raw.isInternetReachable),
    details: raw?.details ?? null,
    isMetered:
      raw?.details && typeof raw.details.isConnectionExpensive === 'boolean'
        ? Boolean(raw.details.isConnectionExpensive)
        : raw?.type === 'cellular',
  };
}

export async function getNetworkState(): Promise<NetworkState> {
  // Only use cached state if we have active listeners that keep it updated
  if (currentState && listeners.length > 0) return currentState;

  // Always fetch fresh data when no listeners are active to avoid stale cache
  const raw = await NetInfo.fetch();
  currentState = normalize(raw);
  return currentState;
}

export async function getConnectionType(): Promise<string> {
  const s = await getNetworkState();
  return s.type;
}

export function _resetForTests(): void {
  currentState = null;
  listeners = [];
  if (netInfoUnsub) {
    try {
      netInfoUnsub();
    } catch {}
    netInfoUnsub = null;
  }
}

export async function isInternetReachable(): Promise<boolean> {
  const s = await getNetworkState();
  // Treat undefined reachability as best-effort reachable (tests rely on this)
  return s.isInternetReachable ?? true;
}

export async function isMetered(): Promise<boolean> {
  const s = await getNetworkState();
  if (
    s.details &&
    typeof (s.details as any).isConnectionExpensive === 'boolean'
  ) {
    return Boolean((s.details as any).isConnectionExpensive);
  }
  // Default to true for cellular connections
  if (s.type === 'cellular') return true;
  return false;
}

export async function isOnline(): Promise<boolean> {
  const s = await getNetworkState();
  return s.isConnected && (s.isInternetReachable ?? true);
}

export function onConnectivityChange(
  cb: (s: NetworkState) => void
): () => void {
  // Hook up NetInfo listener once
  if (!netInfoUnsub) {
    netInfoUnsub = NetInfo.addEventListener((raw: any) => {
      currentState = normalize(raw);
      listeners.forEach((l) => {
        try {
          l(currentState as NetworkState);
        } catch {}
      });
    });
  }
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx >= 0) listeners.splice(idx, 1);

    // Clean up NetInfo listener if no more listeners remain
    if (listeners.length === 0 && netInfoUnsub) {
      try {
        netInfoUnsub();
      } catch {}
      netInfoUnsub = null;
      currentState = null; // Optional: reset current state when no listeners
    }
  };
}

export async function canSyncLargeFiles(): Promise<boolean> {
  const s = await getNetworkState();
  // Allow only on wifi/ethernet by policy
  if (s.type === 'wifi' || s.type === 'ethernet') return true;
  return false;
}
