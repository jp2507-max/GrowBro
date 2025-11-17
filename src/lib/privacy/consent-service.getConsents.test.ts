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

describe('ConsentService.getConsents', () => {
  beforeEach(async () => {
    // Clear any stored consent data before each test
    await clearSecureConfigForTests();
    jest.restoreAllMocks();
  });

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
      timestamp: '2025-01-01T00:00:00.000Z',
      locale: 'en',
    };

    await setSecureConfig(CONSENT_KEY, storedConsent);
    const result = await ConsentService.getConsents();

    // Should return the stored consent values, but with updated locale and timestamp
    expect(result).toEqual({
      ...storedConsent,
      timestamp: expect.any(String), // timestamp gets updated to current time
      locale: expect.any(String), // locale gets updated to current locale
    });
  });
});

describe('ConsentService.getConsents - versioning', () => {
  beforeEach(async () => {
    await clearSecureConfigForTests();
    jest.restoreAllMocks();
  });

  test('clears and returns fresh defaults when stored version is outdated', async () => {
    const outdatedConsent: ConsentState = {
      telemetry: true,
      experiments: true,
      cloudProcessing: true,
      aiTraining: true,
      crashDiagnostics: true,
      version: '2024-01-01', // Old version
      timestamp: '2024-01-01T00:00:00.000Z',
      locale: 'en',
    };

    await setSecureConfig(CONSENT_KEY, outdatedConsent);
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
