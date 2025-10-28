import { getItem, setItem } from '@/lib/storage';
import { cleanup } from '@/lib/test-utils';

import { ConsentService } from './consent-service';
import type { ConsentState } from './consent-types';

const CONSENT_KEY = 'consents.v1';
const CURRENT_CONSENT_VERSION = '2025-09-01';

afterEach(cleanup);

describe('ConsentService.getConsents', () => {
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
      cloudProcessing: false,
      aiTraining: false,
      aiModelImprovement: false,
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
      aiModelImprovement: false,
      crashDiagnostics: false,
      version: CURRENT_CONSENT_VERSION,
      timestamp: '2025-01-01T00:00:00.000Z',
      locale: 'en',
    };

    setItem(CONSENT_KEY, storedConsent);
    const result = await ConsentService.getConsents();

    expect(result).toEqual(storedConsent);
  });
});

describe('ConsentService.getConsents - versioning', () => {
  beforeEach(() => {
    setItem(CONSENT_KEY, null);
    jest.restoreAllMocks();
  });

  test('clears and returns fresh defaults when stored version is outdated', async () => {
    const outdatedConsent: ConsentState = {
      telemetry: true,
      experiments: true,
      cloudProcessing: true,
      aiTraining: true,
      aiModelImprovement: false,
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
      cloudProcessing: false,
      aiTraining: false,
      aiModelImprovement: false,
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
