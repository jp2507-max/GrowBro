/* eslint-disable unicorn/filename-case */
import { validateProcessors } from '@/lib/compliance/dpa-manager';
import { assertDPIAUpToDate } from '@/lib/compliance/dpia';
import { assertPurgeReportFresh } from '@/lib/compliance/purge-report';
import { beforeSendHook } from '@/lib/sentry-utils';

// Mock consent to pre-consent (no crash/analytics)
jest.mock('@/lib/privacy-consent', () => ({
  getPrivacyConsentSync: jest.fn(() => ({
    analytics: false,
    crashReporting: false,
    personalizedData: false,
    sessionReplay: false,
    lastUpdated: Date.now(),
  })),
}));

describe('10.3 E2E compliance validations (unit approximations)', () => {
  test('zero-traffic pre-consent: Sentry beforeSend drops events', () => {
    const dropped = beforeSendHook({ message: 'should not send' });
    expect(dropped).toBeNull();
  });

  test('PurgeReport freshness: stale report fails', () => {
    const fresh = {
      generatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      items: [{ dataType: 'telemetry_raw', purgedCount: 10 }],
    };
    expect(() => assertPurgeReportFresh(fresh)).not.toThrow();

    const stale = {
      generatedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
      items: [],
    };
    expect(() => assertPurgeReportFresh(stale)).toThrow('PurgeReport is stale');
  });

  test('DPA Manager SCC/TIA validation for non-EU processors', () => {
    expect(() =>
      validateProcessors([
        {
          processor: 'Supabase',
          region: 'EU',
          dpaUrl: 'https://supabase.com/legal/dpa',
        },
        {
          processor: 'Sentry',
          region: 'US',
          dpaUrl: 'https://sentry.io/legal/dpa/',
          sccModule: 'SCC-2021-914-Module-2',
          tiaDocId: 'TIA-SEN-2024-001',
        },
      ])
    ).not.toThrow();

    expect(() =>
      validateProcessors([
        {
          processor: 'ExampleAnalytics',
          region: 'US',
          dpaUrl: 'https://example.com/dpa',
        },
      ])
    ).toThrow(/missing SCC\/TIA/);
  });

  test('DPIA validation blocks when model version changed or not signed', () => {
    const ok = {
      version: '1.0.0',
      aiModelVersion: 'm1',
      completedAt: new Date().toISOString(),
      signedOff: true,
    };
    expect(() => assertDPIAUpToDate(ok, 'm1')).not.toThrow();

    const notSigned = { ...ok, signedOff: false };
    expect(() => assertDPIAUpToDate(notSigned, 'm1')).toThrow(/DPIA required/);

    const changedModel = { ...ok, aiModelVersion: 'm0' };
    expect(() => assertDPIAUpToDate(changedModel, 'm1')).toThrow(
      /DPIA required/
    );
  });
});
