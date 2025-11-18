import { cleanup } from '@/lib/test-utils';

import { ConsentService } from './consent-service';
import type { ConsentState } from './consent-types';
import {
  clearSecureConfigForTests,
  setSecureConfig,
} from './secure-config-store';

const CONSENT_KEY = 'consents.v1';
const CURRENT_CONSENT_VERSION = '2025-09-01';

afterEach(cleanup);

beforeEach(async () => {
  await clearSecureConfigForTests();
  (ConsentService as { resetForTests: () => void }).resetForTests();
});

describe('ConsentService.hasConsent', () => {
  test('returns false for outdated consent version', async () => {
    const outdatedConsent: ConsentState = {
      telemetry: true,
      experiments: false,
      cloudProcessing: false,
      aiTraining: false,
      crashDiagnostics: true,
      version: '2024-01-01', // Old version
      timestamp: '2024-01-01T00:00:00.000Z',
      locale: 'en',
    };

    await setSecureConfig(CONSENT_KEY, outdatedConsent);
    (ConsentService as { resetForTests: () => void }).resetForTests();

    // Even though telemetry was true in old version, should return false
    expect(ConsentService.hasConsent('telemetry')).toBe(false);
    expect(ConsentService.hasConsent('crashDiagnostics')).toBe(false);
  });

  test('returns false when no consent data exists', () => {
    expect(ConsentService.hasConsent('telemetry')).toBe(false);
    expect(ConsentService.hasConsent('crashDiagnostics')).toBe(false);
  });

  test('returns stored value when version matches', async () => {
    const currentConsent: ConsentState = {
      telemetry: true,
      experiments: false,
      cloudProcessing: false,
      aiTraining: true,
      crashDiagnostics: false,
      version: CURRENT_CONSENT_VERSION,
      timestamp: '2025-01-01T00:00:00.000Z',
      locale: 'en',
    };

    await setSecureConfig(CONSENT_KEY, currentConsent);
    (ConsentService as { resetForTests: () => void }).resetForTests();
    await ConsentService.getConsents();

    expect(ConsentService.hasConsent('telemetry')).toBe(true);
    expect(ConsentService.hasConsent('experiments')).toBe(false);
    expect(ConsentService.hasConsent('aiTraining')).toBe(true);
    expect(ConsentService.hasConsent('crashDiagnostics')).toBe(false);
  });
});
