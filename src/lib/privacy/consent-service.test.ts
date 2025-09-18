import { getItem, setItem } from '@/lib/storage';
import { cleanup } from '@/lib/test-utils';

import { ConsentService } from './consent-service';
import type { ConsentState } from './consent-types';

const CONSENT_KEY = 'consents.v1';
const CURRENT_CONSENT_VERSION = '2025-09-01';

afterEach(cleanup);

describe('ConsentService - getConsents', () => {
  beforeEach(() => {
    // Clear any stored consent data before each test
    setItem(CONSENT_KEY, null);
    jest.restoreAllMocks();
  });
  test('returns fresh defaults when no stored consent exists', async () => {
    const result = await ConsentService.getConsents();

    expect(result).toEqual({
      telemetry: false,
      experiments: false,
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
      aiTraining: true,
      crashDiagnostics: false,
      version: CURRENT_CONSENT_VERSION,
      timestamp: '2025-01-01T00:00:00.000Z',
      locale: 'en',
    };

    setItem(CONSENT_KEY, storedConsent);
    const result = await ConsentService.getConsents();

    expect(result).toEqual(storedConsent);
  });

  test('clears and returns fresh defaults when stored version is outdated', async () => {
    const outdatedConsent: ConsentState = {
      telemetry: true,
      experiments: true,
      aiTraining: true,
      crashDiagnostics: true,
      version: '2024-01-01', // Old version
      timestamp: '2024-01-01T00:00:00.000Z',
      locale: 'en',
    };

    setItem(CONSENT_KEY, outdatedConsent);
    const result = await ConsentService.getConsents();

    // Should return fresh defaults, not the old consent values
    expect(result).toEqual({
      telemetry: false,
      experiments: false,
      aiTraining: false,
      crashDiagnostics: false,
      version: CURRENT_CONSENT_VERSION,
      timestamp: expect.any(String),
      locale: expect.any(String),
    });

    // Should have cleared the old data from storage
    const stored = getItem<ConsentState>(CONSENT_KEY);
    expect(stored?.version).toBe(CURRENT_CONSENT_VERSION);
    expect(stored?.telemetry).toBe(false);
  });
});

describe('ConsentService - hasConsent', () => {
  beforeEach(() => {
    // Clear any stored consent data before each test
    setItem(CONSENT_KEY, null);
    jest.restoreAllMocks();
  });

  test('returns false for outdated consent version', () => {
    const outdatedConsent: ConsentState = {
      telemetry: true,
      experiments: false,
      aiTraining: false,
      crashDiagnostics: true,
      version: '2024-01-01', // Old version
      timestamp: '2024-01-01T00:00:00.000Z',
      locale: 'en',
    };

    setItem(CONSENT_KEY, outdatedConsent);

    // Even though telemetry was true in old version, should return false
    expect(ConsentService.hasConsent('telemetry')).toBe(false);
    expect(ConsentService.hasConsent('crashDiagnostics')).toBe(false);
  });

  test('returns false when no consent data exists', () => {
    expect(ConsentService.hasConsent('telemetry')).toBe(false);
    expect(ConsentService.hasConsent('crashDiagnostics')).toBe(false);
  });

  test('returns stored value when version matches', () => {
    const currentConsent: ConsentState = {
      telemetry: true,
      experiments: false,
      aiTraining: true,
      crashDiagnostics: false,
      version: CURRENT_CONSENT_VERSION,
      timestamp: '2025-01-01T00:00:00.000Z',
      locale: 'en',
    };

    setItem(CONSENT_KEY, currentConsent);

    expect(ConsentService.hasConsent('telemetry')).toBe(true);
    expect(ConsentService.hasConsent('experiments')).toBe(false);
    expect(ConsentService.hasConsent('aiTraining')).toBe(true);
    expect(ConsentService.hasConsent('crashDiagnostics')).toBe(false);
  });
});

describe('ConsentService - isConsentRequired', () => {
  beforeEach(() => {
    // Clear any stored consent data before each test
    setItem(CONSENT_KEY, null);
    jest.restoreAllMocks();
  });

  test('returns true when versions do not match', () => {
    const outdatedConsent: ConsentState = {
      telemetry: true,
      experiments: false,
      aiTraining: false,
      crashDiagnostics: true,
      version: '2024-01-01', // Old version
      timestamp: '2024-01-01T00:00:00.000Z',
      locale: 'en',
    };

    setItem(CONSENT_KEY, outdatedConsent);
    expect(ConsentService.isConsentRequired()).toBe(true);
  });
});
