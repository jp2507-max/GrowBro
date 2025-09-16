import {
  appendAudit,
  getAuditLog,
  validateAuditChain,
} from '@/lib/privacy/audit-log';

describe('AuditLog', () => {
  test('appends entries with hash chain and validates', () => {
    appendAudit({
      action: 'retention-delete',
      dataType: 'telemetry_raw',
      count: 2,
    });
    appendAudit({
      action: 'retention-aggregate',
      dataType: 'telemetry_aggregated',
      count: 2,
      bucket: '2025-09-16',
    });
    const log = getAuditLog();
    expect(log.length).toBeGreaterThanOrEqual(2);
    expect(validateAuditChain()).toBe(true);
  });
});
