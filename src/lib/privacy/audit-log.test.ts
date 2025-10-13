import {
  appendAudit,
  getAuditLog,
  validateAuditChain,
} from '@/lib/privacy/audit-log';
import { clearSecureConfigForTests } from '@/lib/privacy/secure-config-store';

beforeEach(async () => {
  await clearSecureConfigForTests();
});

describe('AuditLog', () => {
  test('appends entries with hash chain and validates', async () => {
    await appendAudit({
      action: 'retention-delete',
      dataType: 'telemetry_raw',
      count: 2,
    });
    await appendAudit({
      action: 'retention-aggregate',
      dataType: 'telemetry_aggregated',
      count: 2,
      bucket: '2025-09-16',
    });
    const log = await getAuditLog();
    expect(log.length).toBeGreaterThanOrEqual(2);
    expect(await validateAuditChain()).toBe(true);
  });
});
