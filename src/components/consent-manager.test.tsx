import React from 'react';
import { Alert } from 'react-native';

import { ConsentManager } from '@/components/consent-manager';
import { type ConsentState } from '@/lib/privacy/consent-types';
import { type PrivacyConsent } from '@/lib/privacy-consent';
import { cleanup, fireEvent, screen, setup } from '@/lib/test-utils';

let runtimeConsent: ConsentState = {
  telemetry: true,
  experiments: false,
  cloudProcessing: true,
  aiTraining: false,
  crashDiagnostics: true,
  version: '2025-09-01',
  timestamp: '2025-10-13T12:00:00.000Z',
  locale: 'en-US',
};

let privacyConsent: PrivacyConsent = {
  analytics: false,
  crashReporting: true,
  personalizedData: false,
  sessionReplay: false,
  lastUpdated: 0,
};

jest.mock('@/lib', () => ({
  translate: (key: string, vars?: Record<string, unknown>) =>
    vars && 'date' in vars ? `${key}:${vars.date}` : key,
}));

jest.mock('@/components/ui', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    Button: ({ label, onPress, testID }: any) => (
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onPress}
        testID={testID}
      >
        <Text>{label}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('@/lib/privacy/consent-service', () => ({
  ConsentService: {
    getConsents: jest.fn(),
    setConsent: jest.fn(),
    setConsents: jest.fn(),
    hasConsent: jest.fn(),
    getConsentVersion: jest.fn(),
    onChange: jest.fn(),
    resetForTests: jest.fn(),
  },
}));

jest.mock('@/lib/privacy-consent', () => ({
  getPrivacyConsent: jest.fn(),
  setPrivacyConsent: jest.fn(),
}));

jest.mock('@/lib/privacy/telemetry-client', () => ({
  telemetryClient: {
    clearQueue: jest.fn().mockResolvedValue(undefined),
  },
}));

const { ConsentService } = jest.requireMock('@/lib/privacy/consent-service');
const { getPrivacyConsent, setPrivacyConsent } = jest.requireMock(
  '@/lib/privacy-consent'
);
const { telemetryClient } = jest.requireMock('@/lib/privacy/telemetry-client');

// Set up mock implementations
ConsentService.getConsents.mockImplementation(async () => runtimeConsent);
ConsentService.setConsent.mockImplementation(
  async (purpose: keyof ConsentState, value: boolean) => {
    runtimeConsent = { ...runtimeConsent, [purpose]: value };
  }
);
ConsentService.setConsents.mockImplementation(
  async (changes: Partial<Record<keyof ConsentState, boolean>>) => {
    runtimeConsent = { ...runtimeConsent, ...changes } as ConsentState;
  }
);
ConsentService.hasConsent.mockImplementation(
  (purpose: keyof ConsentState) => runtimeConsent[purpose] === true
);
ConsentService.getConsentVersion.mockImplementation(
  () => runtimeConsent.version
);
ConsentService.onChange.mockImplementation(() => () => undefined);

getPrivacyConsent.mockImplementation(() => privacyConsent);
setPrivacyConsent.mockImplementation((updates: Partial<PrivacyConsent>) => {
  privacyConsent = {
    ...privacyConsent,
    ...updates,
    lastUpdated: Date.now(),
  };
});

describe('ConsentManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    runtimeConsent = {
      telemetry: true,
      experiments: false,
      cloudProcessing: true,
      aiTraining: false,
      crashDiagnostics: true,
      version: '2025-09-01',
      timestamp: '2025-10-13T12:00:00.000Z',
      locale: 'en-US',
    };
    privacyConsent = {
      analytics: false,
      crashReporting: true,
      personalizedData: false,
      sessionReplay: false,
      lastUpdated: 0,
    };
  });

  afterEach(() => {
    cleanup();
  });

  test('renders current consent state when visible', async () => {
    setup(<ConsentManager mode="settings" isVisible testID="cm" />);
    expect(await screen.findByTestId('cm')).toBeOnTheScreen();
    expect(screen.getByTestId('consent-telemetry-switch').props.value).toBe(
      true
    );
    expect(screen.getByTestId('consent-analytics-switch').props.value).toBe(
      false
    );
  });

  test('toggling runtime consent updates ConsentService', async () => {
    setup(<ConsentManager mode="settings" isVisible />);
    await screen.findByTestId('consent-telemetry-switch');
    fireEvent(
      screen.getByTestId('consent-telemetry-switch'),
      'valueChange',
      false
    );
    expect(ConsentService.setConsent).toHaveBeenCalledWith('telemetry', false);
  });

  test('quick opt-out clears telemetry queue and revokes consents', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    setup(<ConsentManager mode="opt-out" isVisible onComplete={jest.fn()} />);
    await screen.findByTestId('consent-manager');
    fireEvent.press(screen.getByTestId('opt-out-all-btn'));
    expect(telemetryClient.clearQueue).toHaveBeenCalled();
    expect(ConsentService.setConsent).toHaveBeenCalledWith('telemetry', false);
    expect(setPrivacyConsent).toHaveBeenCalledWith({
      analytics: false,
      crashReporting: false,
      personalizedData: false,
      sessionReplay: false,
    });
  });
});
