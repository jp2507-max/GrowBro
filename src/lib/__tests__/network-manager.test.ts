import NetInfo from '@react-native-community/netinfo';

import {
  _resetForTests,
  canSyncLargeFiles,
  getConnectionType,
  getNetworkState,
  isInternetReachable,
  isMetered,
  isOnline,
  onConnectivityChange,
} from '@/lib/sync/network-manager';

// Mock implementation for NetInfo
const createNetInfoMock = () => {
  const listeners: ((s: any) => void)[] = [];
  let state: any = {
    type: 'unknown',
    isConnected: false,
    isInternetReachable: false,
    details: { isConnectionExpensive: undefined },
  };
  let shouldThrow = false;

  return {
    addEventListener: (cb: (s: any) => void) => {
      listeners.push(cb);
      return () => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
    fetch: async () => {
      if (shouldThrow) {
        throw new Error('NetInfo module unavailable');
      }
      return state;
    },
    __setState: (next: any) => {
      state = next;
      listeners.forEach((l) => l(next));
    },
    __setShouldThrow: (throwError: boolean) => {
      shouldThrow = throwError;
    },
  };
};

jest.mock('@react-native-community/netinfo', () => createNetInfoMock(), {
  virtual: true,
});

const setNetInfo = (next: any) => (NetInfo as any).__setState(next);
const setNetInfoThrow = (shouldThrow: boolean) =>
  (NetInfo as any).__setShouldThrow(shouldThrow);

describe('NetworkManager - State Management', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('initializes from NetInfo.fetch and exposes state', async () => {
    setNetInfo({
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      details: { isConnectionExpensive: false },
    });
    const s = await getNetworkState();
    expect(s.isConnected).toBe(true);
    expect(s.isInternetReachable).toBe(true);
    expect(s.isMetered).toBe(false);
    expect(s.type).toBe('wifi');
  });

  it('treats undefined reachability as best-effort based on type', async () => {
    setNetInfo({
      type: 'cellular',
      isConnected: true,
      isInternetReachable: undefined,
    });
    expect(await isInternetReachable()).toBe(true);
    expect(await isMetered()).toBe(true);
  });
});

describe('NetworkManager - Connectivity Changes', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('listener updates callers via onConnectivityChange', async () => {
    const snapshots: any[] = [];
    const off = onConnectivityChange((s) => snapshots.push(s));
    setNetInfo({ type: 'wifi', isConnected: true, isInternetReachable: true });
    setNetInfo({
      type: 'cellular',
      isConnected: true,
      isInternetReachable: true,
      details: { isConnectionExpensive: true },
    });
    off();
    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    expect(snapshots[0].type).toBe('wifi');
    expect(snapshots[1].type).toBe('cellular');
  });
});

describe('NetworkManager - Sync Policies', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('shouldSync and canSyncLargeFiles reflect policy', async () => {
    setNetInfo({ type: 'wifi', isConnected: true, isInternetReachable: true });
    expect(await isOnline()).toBe(true);
    expect(await canSyncLargeFiles()).toBe(true);

    setNetInfo({
      type: 'cellular',
      isConnected: true,
      isInternetReachable: true,
    });
    expect(await canSyncLargeFiles()).toBe(false);
  });

  it('getConnectionType returns normalized type', async () => {
    setNetInfo({
      type: 'ethernet',
      isConnected: true,
      isInternetReachable: true,
    });
    expect(await getConnectionType()).toBe('ethernet');
  });
});

describe('NetworkManager - Error Handling', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('handles NetInfo.fetch errors gracefully with fallback state', async () => {
    // Enable error throwing in NetInfo mock
    setNetInfoThrow(true);

    // All functions should still work and return safe fallback values
    const state = await getNetworkState();
    expect(state.type).toBe('unknown');
    expect(state.isConnected).toBe(false);
    expect(state.isInternetReachable).toBe(false);
    expect(state.isMetered).toBe(false);

    expect(await isOnline()).toBe(false);
    expect(await isInternetReachable()).toBe(false);
    expect(await isMetered()).toBe(false);
    expect(await canSyncLargeFiles()).toBe(false);
    expect(await getConnectionType()).toBe('unknown');

    // Reset for other tests
    setNetInfoThrow(false);
  });
});
