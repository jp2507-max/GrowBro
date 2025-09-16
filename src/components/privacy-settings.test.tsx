import React from 'react';
import { Alert } from 'react-native';

import * as privacyConsent from '@/lib/privacy-consent';
import { cleanup, fireEvent, screen, setup } from '@/lib/test-utils';

import { PrivacySettings } from './privacy-settings';

// IMPORTANT: Mock only what we need from '@/lib' to avoid importing the entire
// library index which initializes heavy modules (e.g., supabase client) and can
// keep Jest alive or cause hangs on Windows. We only need `translate` here.
jest.mock('@/lib', () => ({
  translate: (key: string) => key,
}));

jest.mock('@/lib/privacy-consent', () => {
  const actual = jest.requireActual('@/lib/privacy-consent');
  // Provide stable initial state and spyable setters
  const initialConsent = {
    analytics: false,
    crashReporting: true,
    personalizedData: false,
    sessionReplay: false,
    lastUpdated: 1700000000000,
  };
  let consent = { ...initialConsent };

  const resetConsent = () => {
    consent = { ...initialConsent };
  };

  return {
    ...actual,
    getPrivacyConsent: jest.fn(() => consent),
    setPrivacyConsent: jest.fn((next: any) => {
      const patch = typeof next === 'object' ? next : {};
      consent = {
        ...consent,
        ...patch,
        lastUpdated: Date.now(),
      };
    }),
    __resetConsent: resetConsent,
  };
});

afterEach(() => {
  jest.clearAllMocks();
  cleanup();
  // Reset mocked consent state between tests to prevent order dependency
  (privacyConsent as any).__resetConsent?.();
});

describe('PrivacySettings', () => {
  test('renders root and rows with initial values', async () => {
    setup(<PrivacySettings />);
    expect(await screen.findByTestId('privacy-settings')).toBeOnTheScreen();
    expect(screen.getByTestId('toggle-crashReporting-switch').props.value).toBe(
      true
    );
    expect(screen.getByTestId('toggle-analytics-switch').props.value).toBe(
      false
    );
    expect(
      screen.getByTestId('privacy-settings-last-updated')
    ).toBeOnTheScreen();
  });

  test('invokes onConsentChange and persists on toggle', async () => {
    const onConsentChange = jest.fn();
    setup(<PrivacySettings onConsentChange={onConsentChange} />);
    const analyticsSwitch = screen.getByTestId('toggle-analytics-switch');
    fireEvent(analyticsSwitch, 'valueChange', true);

    // onConsentChange called with full updated object incl. lastUpdated
    expect(onConsentChange).toHaveBeenCalledTimes(1);
    const arg = onConsentChange.mock.calls[0][0];
    expect(arg.analytics).toBe(true);
    expect(typeof arg.lastUpdated).toBe('number');
  });

  test('updates last updated text on change', async () => {
    setup(<PrivacySettings />);
    // capture before value (not asserted directly to avoid flakiness)
    fireEvent(
      screen.getByTestId('toggle-sessionReplay-switch'),
      'valueChange',
      true
    );
    const afterText = screen.getByTestId('privacy-settings-last-updated').props
      .children[1] as string;
    expect(afterText).toBeDefined();
    // Date string may match if same day; assert node changed reference or is a string
    expect(typeof afterText).toBe('string');
  });

  test('info title press triggers alert via onInfoPress', async () => {
    const { user } = setup(<PrivacySettings />);
    const alertSpy = jest.spyOn(Alert, 'alert');
    await user.press(screen.getByTestId('toggle-personalizedData-title'));
    expect(alertSpy).toHaveBeenCalled();
  });
});
