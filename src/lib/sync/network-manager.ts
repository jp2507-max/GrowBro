import NetInfo from '@react-native-community/netinfo';

export type ConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'unknown';

export type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean;
  isMetered: boolean;
  type: ConnectionType;
};

let cachedState: NetworkState = {
  isConnected: false,
  isInternetReachable: false,
  isMetered: false,
  type: 'unknown',
};

let initialized = false;
let unsubscribe: (() => void) | null = null;

type NetInfoLikeDetails =
  | { isConnectionExpensive?: boolean | null }
  | null
  | undefined;
type NetInfoLikeState =
  | {
      type?: string;
      isConnected?: boolean | null;
      isInternetReachable?: boolean | null;
      details?: NetInfoLikeDetails;
    }
  | null
  | undefined;

function deriveConnectionType(type: string | undefined): ConnectionType {
  if (type === 'wifi') return 'wifi';
  if (type === 'cellular') return 'cellular';
  if (type === 'ethernet') return 'ethernet';
  return 'unknown';
}

function deriveIsMetered(
  type: string | undefined,
  details?: NetInfoLikeDetails
): boolean {
  if (details?.isConnectionExpensive === true) return true;
  if (type === 'cellular') return true;
  if (type === 'unknown') return true; // Conservative default for unknown networks
  return false;
}

function updateFromNetInfo(state: NetInfoLikeState): void {
  const type = deriveConnectionType(state?.type);
  const isConnected =
    Boolean(state?.isConnected ?? false) && type !== 'unknown';
  const isInternetReachableRaw = state?.isInternetReachable;
  const isInternetReachable =
    isInternetReachableRaw === undefined || isInternetReachableRaw === null
      ? false
      : Boolean(isInternetReachableRaw) && type !== 'unknown';
  const isMetered = deriveIsMetered(state?.type, state?.details);
  cachedState = { isConnected, isInternetReachable, isMetered, type };
}

async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;
  try {
    const current = await NetInfo.fetch();
    updateFromNetInfo(current);
  } catch {
    // leave defaults
  }
  if (!unsubscribe) {
    unsubscribe = NetInfo.addEventListener((state: NetInfoLikeState) =>
      updateFromNetInfo(state)
    );
  }
}

export async function getNetworkState(): Promise<NetworkState> {
  await ensureInitialized();
  return cachedState;
}

export async function isOnline(): Promise<boolean> {
  await ensureInitialized();
  return cachedState.isConnected && cachedState.isInternetReachable;
}

export async function isInternetReachable(): Promise<boolean> {
  await ensureInitialized();
  return cachedState.isInternetReachable;
}

export async function isMetered(): Promise<boolean> {
  await ensureInitialized();
  return cachedState.isMetered;
}

export async function getConnectionType(): Promise<ConnectionType> {
  await ensureInitialized();
  return cachedState.type;
}

export function onConnectivityChange(
  callback: (state: NetworkState) => void
): () => void {
  if (!initialized) {
    // Fire async init but don't await; consumer receives updates via listener
    void ensureInitialized();
  }
  const handler = (state: NetInfoLikeState) => {
    updateFromNetInfo(state);
    callback(cachedState);
  };
  const remove = NetInfo.addEventListener(handler);
  return () => {
    remove?.();
  };
}

export async function shouldSync(): Promise<boolean> {
  await ensureInitialized();
  return cachedState.isConnected && cachedState.isInternetReachable;
}

export async function canSyncLargeFiles(): Promise<boolean> {
  await ensureInitialized();
  if (!cachedState.isConnected || !cachedState.isInternetReachable) {
    return false;
  }
  return !cachedState.isMetered && cachedState.type === 'wifi';
}

export function _resetForTests(): void {
  if (unsubscribe) {
    try {
      unsubscribe();
    } catch {}
  }
  unsubscribe = null;
  initialized = false;
  cachedState = {
    isConnected: false,
    isInternetReachable: false,
    isMetered: false,
    type: 'unknown',
  };
}
