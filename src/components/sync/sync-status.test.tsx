import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { SyncStatus } from '@/components/sync/sync-status';

jest.mock('@/lib/sync-engine', () => ({
  getPendingChangesCount: jest.fn(async () => 0),
  isSyncInFlight: jest.fn(() => false),
}));

describe('SyncStatus', () => {
  it('renders summary text', () => {
    render(<SyncStatus />);
    // Initial render may still be loading, but formatted text should appear quickly
    expect(screen.getByText(/Last sync|Letzte Sync/i)).toBeTruthy();
  });
});
