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

jest.mock(
  '@react-native-community/netinfo',
  () => {
    const listeners: ((s: any) => void)[] = [];
    let state: any = {
      type: 'unknown',
      isConnected: false,
      isInternetReachable: false,
      details: { isConnectionExpensive: undefined },
    };
    return {
      addEventListener: (cb: (s: any) => void) => {
        listeners.push(cb);
        return () => {
          const idx = listeners.indexOf(cb);
          if (idx >= 0) listeners.splice(idx, 1);
        };
      },
      fetch: async () => state,
      __setState: (next: any) => {
        state = next;
        listeners.forEach((l) => l(next));
      },
    } as any;
  },
  { virtual: true }
);

const setNetInfo = (next: any) => (NetInfo as any).__setState(next);

describe('NetworkManager', () => {
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
