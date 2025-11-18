import { cleanup } from '@/lib/test-utils';

import { ConsentService } from './consent-service';
import type { ConsentState } from './consent-types';
import {
  clearSecureConfigForTests,
  getSecureConfig,
  setSecureConfig,
} from './secure-config-store';

const CONSENT_KEY = 'consents.v1';
const CURRENT_CONSENT_VERSION = '2025-09-01';

afterEach(cleanup);

beforeEach(async () => {
  await clearSecureConfigForTests();
  (ConsentService as any).resetForTests();
});

describe('ConsentService - getConsents', () => {
  test('returns fresh defaults when no stored consent exists', async () => {
    const result = await ConsentService.getConsents();

    expect(result).toEqual({
      telemetry: false,
      experiments: false,
      cloudProcessing: false,
      aiTraining: false,
      crashDiagnostics: false,
      version: CURRENT_CONSENT_VERSION,
      timestamp: expect.any(String),
      locale: expect.any(String),
    });
  });

  test('returns stored consent when version matches', async () => {
    const storedConsent: ConsentState = {
      telemetry: true,
      experiments: false,
      cloudProcessing: false,
      aiTraining: true,
      crashDiagnostics: false,
      version: CURRENT_CONSENT_VERSION,
      timestamp: new Date().toISOString(),
      locale: 'en',
    };

    await setSecureConfig(CONSENT_KEY, storedConsent);
    (ConsentService as any).resetForTests();
    const result = await ConsentService.getConsents();

    expect(result).toEqual(storedConsent);
  });
});

describe('ConsentService - getConsents (versioning)', () => {
  test('clears and returns fresh defaults when stored version is outdated', async () => {
    const outdatedConsent: ConsentState = {
      telemetry: true,
      experiments: true,
      cloudProcessing: true,
      aiTraining: true,
      crashDiagnostics: true,
      version: '2024-01-01', // Old version
      timestamp: new Date().toISOString(),
      locale: 'en',
    };

    await setSecureConfig(CONSENT_KEY, outdatedConsent);
    (ConsentService as any).resetForTests();
    const result = await ConsentService.getConsents();

    // Should return fresh defaults, not the old consent values
    expect(result).toEqual({
      telemetry: false,
      experiments: false,
      cloudProcessing: false,
      aiTraining: false,
      crashDiagnostics: false,
      version: CURRENT_CONSENT_VERSION,
      timestamp: expect.any(String),
      locale: expect.any(String),
    });

    // Should have cleared the old data from storage
    const stored = await getSecureConfig<ConsentState>(CONSENT_KEY);
    expect(stored?.version).toBe(CURRENT_CONSENT_VERSION);
    expect(stored?.telemetry).toBe(false);
  });
});

describe('ConsentService - hasConsent', () => {
  test('returns false for outdated consent version', async () => {
    const outdatedConsent: ConsentState = {
      telemetry: true,
      experiments: false,
      cloudProcessing: false,
      aiTraining: false,
      crashDiagnostics: true,
      version: '2024-01-01', // Old version
      timestamp: new Date().toISOString(),
      locale: 'en',
    };

    await setSecureConfig(CONSENT_KEY, outdatedConsent);
    (ConsentService as any).resetForTests();

    // Even though telemetry was true in old version, should return false
    expect(ConsentService.hasConsent('telemetry')).toBe(false);
    expect(ConsentService.hasConsent('crashDiagnostics')).toBe(false);
  });

  test('returns false when no consent data exists', () => {
    (ConsentService as any).resetForTests();
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
      timestamp: new Date().toISOString(),
      locale: 'en',
    };

    await setSecureConfig(CONSENT_KEY, currentConsent);
    (ConsentService as any).resetForTests();
    await ConsentService.getConsents();

    expect(ConsentService.hasConsent('telemetry')).toBe(true);
    expect(ConsentService.hasConsent('experiments')).toBe(false);
    expect(ConsentService.hasConsent('aiTraining')).toBe(true);
    expect(ConsentService.hasConsent('crashDiagnostics')).toBe(false);
  });
});

describe('ConsentService - isConsentRequired', () => {
  test('returns true when versions do not match', async () => {
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
    (ConsentService as any).resetForTests();
    expect(ConsentService.isConsentRequired()).toBe(true);
  });
});
