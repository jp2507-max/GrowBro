import { setItem } from '@/lib/storage';
import { cleanup } from '@/lib/test-utils';

import { ConsentService } from './consent-service';
import type { ConsentState } from './consent-types';

const CONSENT_KEY = 'consents.v1';

afterEach(cleanup);

describe('ConsentService.isConsentRequired', () => {
  beforeEach(() => {
    // Clear any stored consent data before each test
    setItem(CONSENT_KEY, null);
    jest.restoreAllMocks();
  });

  test('returns true when versions do not match', () => {
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

    setItem(CONSENT_KEY, outdatedConsent);
    expect(ConsentService.isConsentRequired()).toBe(true);
  });
});
