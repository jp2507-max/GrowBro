import { render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';

import { ConnectivityBanner } from '@/components/sync/connectivity-banner';
import { _resetForTests } from '@/lib/sync/network-manager';

jest.mock('@react-native-community/netinfo', () => {
  const listeners: ((s: any) => void)[] = [];
  let state: any = {
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
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
});

describe('ConnectivityBanner', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('does not render when online', async () => {
    render(<ConnectivityBanner />);
    await waitFor(() => expect(screen.queryByText(/offline/i)).toBeNull());
  });
});
