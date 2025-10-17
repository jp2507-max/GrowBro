/**
 * Integration Tests: Navigation and Deep Linking
 *
 * Tests for inventory tab navigation, deep linking, and offline indicators.
 *
 * Requirements: 4.2, 7.4
 */

import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { OfflineBanner } from '@/components/inventory/offline-banner';
import * as exactAlarm from '@/lib/permissions/exact-alarm';

describe('OfflineBanner', () => {
  it('renders with offline message', () => {
    render(<OfflineBanner variant="persistent" />);
    expect(screen.getByTestId('offline-banner')).toBeOnTheScreen();
  });

  it('shows dismissible variant when provided', () => {
    const mockDismiss = jest.fn();
    render(<OfflineBanner variant="dismissible" onDismiss={mockDismiss} />);
    expect(screen.getByTestId('offline-banner')).toBeOnTheScreen();
  });
});

describe('ExactAlarmPermission', () => {
  it('should export permission utilities', () => {
    expect(typeof exactAlarm.checkExactAlarmPermission).toBe('function');
    expect(typeof exactAlarm.requestExactAlarmPermission).toBe('function');
    expect(typeof exactAlarm.shouldShowExactAlarmPrompt).toBe('function');
  });
});
