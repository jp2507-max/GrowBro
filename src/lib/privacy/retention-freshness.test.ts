import { getLastPurgeReport } from '@/lib/privacy/retention-worker';

describe('Retention Freshness (CI gate)', () => {
  const isCI = process.env.CI === 'true';

  (isCI ? test : test.skip)('last purge report is <= 48h old', () => {
    const report = getLastPurgeReport();
    expect(report).toBeTruthy();
    const ageMs = Date.now() - (report as any).generatedAt;
    const maxMs = 48 * 60 * 60 * 1000;
    expect(ageMs).toBeLessThanOrEqual(maxMs);
  });
});
