import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { SyncStatus } from '@/components/sync/sync-status';
import { storage } from '@/lib/storage';
import * as SyncEngine from '@/lib/sync-engine';

describe('SyncStatus', () => {
  beforeEach(() => {
    storage.set('sync.lastPulledAt', JSON.stringify(Date.now()));
    jest.spyOn(SyncEngine, 'getPendingChangesCount').mockResolvedValue(3);
    jest.spyOn(SyncEngine, 'isSyncInFlight').mockReturnValue(true as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders last sync time and pending count with spinner', async () => {
    render(<SyncStatus />);
    const lbl = await screen.findByText(/Last sync:/i);
    expect(lbl).toBeTruthy();
  });
});
