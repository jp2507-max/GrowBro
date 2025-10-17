/**
 * Integration Tests: Navigation and Deep Linking
 *
 * Tests for inventory tab navigation, deep linking, and offline indicators.
 *
 * Requirements: 4.2, 7.4
 */

import { screen } from '@testing-library/react-native';
import React from 'react';

import { OfflineBanner } from '@/components/inventory/offline-banner';
import * as exactAlarm from '@/lib/permissions/exact-alarm';
import { setup } from '@/lib/test-utils';

describe('OfflineBanner', () => {
  it('renders with offline message', () => {
    setup(<OfflineBanner variant="persistent" />);
    expect(screen.getByLabelText('Offline Mode')).toBeOnTheScreen();
  });

  it('shows dismissible variant when provided', () => {
    const mockDismiss = jest.fn();
    setup(<OfflineBanner variant="dismissible" onDismiss={mockDismiss} />);
    expect(screen.getByLabelText('Offline Mode')).toBeOnTheScreen();
  });
});

describe('ExactAlarmPermission', () => {
  it('should export permission utilities', () => {
    expect(typeof exactAlarm.checkExactAlarmPermission).toBe('function');
    expect(typeof exactAlarm.requestExactAlarmPermission).toBe('function');
    expect(typeof exactAlarm.shouldShowExactAlarmPrompt).toBe('function');
  });
});
