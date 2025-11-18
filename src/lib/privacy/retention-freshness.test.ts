import {
  getLastPurgeReport,
  type PurgeReport,
} from '@/lib/privacy/retention-worker';

describe('Retention Freshness (CI gate)', () => {
  const isCI = process.env.CI === 'true';

  (isCI ? test : test.skip)('last purge report is <= 48h old', async () => {
    const report = (await getLastPurgeReport()) as PurgeReport | null;
    expect(report).toBeTruthy();
    if (!report) return;
    const ageMs = Date.now() - report.generatedAt;
    const maxMs = 48 * 60 * 60 * 1000;
    expect(ageMs).toBeLessThanOrEqual(maxMs);
  });
});
