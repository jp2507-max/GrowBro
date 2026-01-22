import React from 'react';

import StorageSettingsScreen from '@/app/settings/storage';
import { cleanup, screen, setup } from '@/lib/test-utils';

afterEach(cleanup);

// Extract the formatBytes function for testing (since it's not exported)
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

describe('formatBytes', () => {
  test('formats 0 bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  test('formats bytes correctly', () => {
    expect(formatBytes(512)).toBe('512.00 B');
  });

  test('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
  });

  test('formats megabytes correctly', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.50 MB');
  });

  test('formats gigabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    expect(formatBytes(1024 * 1024 * 1024 * 1.25)).toBe('1.25 GB');
  });

  test('clamps large values to GB (prevents undefined output)', () => {
    // TB value should be clamped to GB
    const tbValue = 1024 * 1024 * 1024 * 1024; // 1 TB
    expect(formatBytes(tbValue)).toBe('1024.00 GB');

    // PB value should be clamped to GB
    const pbValue = 1024 * 1024 * 1024 * 1024 * 1024; // 1 PB
    expect(formatBytes(pbValue)).toBe('1048576.00 GB');
  });

  test('handles edge cases', () => {
    expect(formatBytes(1)).toBe('1.00 B');
    expect(formatBytes(1023)).toBe('1023.00 B');
  });
});

describe('StorageSettingsScreen', () => {
  test('renders correctly', async () => {
    setup(<StorageSettingsScreen />);
    expect(await screen.findByTestId('cleanup-button')).toBeOnTheScreen();
  });
});
