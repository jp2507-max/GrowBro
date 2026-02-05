/**
 * Integration Tests: Navigation and Deep Linking
 *
 * Tests for inventory tab navigation, deep linking, and offline indicators.
 *
 * Requirements: 4.2, 7.4
 */

import { fireEvent, screen } from '@testing-library/react-native';
import React from 'react';

import { OfflineBanner } from '@/components/inventory/offline-banner';
import * as exactAlarm from '@/lib/permissions/exact-alarm';
import { setup } from '@/lib/test-utils';

describe('OfflineBanner', () => {
  // NOTE: The component uses the useTranslation() hook from react-i18next.
  // The test helper `setup()` initializes i18n globally, but the mounted
  // component tree must include an I18nextProvider for useTranslation() to
  // find the i18n instance. If tests start failing with i18n errors, wrap the
  // test app in an <I18nextProvider i18n={i18n}> (see lib/test-utils or create
  // a createAppWrapper that includes the provider).
  it('renders with offline message', () => {
    setup(<OfflineBanner variant="persistent" />);
    expect(screen.getByLabelText('Offline Mode')).toBeOnTheScreen();
  });

  it('shows dismissible variant when provided', () => {
    const mockDismiss = jest.fn();
    setup(<OfflineBanner variant="dismissible" onDismiss={mockDismiss} />);
    const banner = screen.getByRole('alert');
    expect(banner).toBeOnTheScreen();

    // Test dismiss interaction
    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.press(dismissButton);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('ExactAlarmPermission', () => {
  it('should export permission utilities', () => {
    expect(typeof exactAlarm.checkExactAlarmPermission).toBe('function');
    expect(typeof exactAlarm.requestExactAlarmPermission).toBe('function');
    expect(typeof exactAlarm.shouldShowExactAlarmPrompt).toBe('function');
  });
});
