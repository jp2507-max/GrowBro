jest.mock('@/lib/env', () => ({
  Env: {
    ACCOUNT_DELETION_URL: 'https://growbro.app/delete-account',
  },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

import { supabase } from '@/lib/supabase';
import {
  deleteAccountInApp,
  provideWebDeletionUrl,
  requestDataExport,
  requestDeletionViaWeb,
  validateDeletionPathAccessibility,
} from '@/lib/privacy/deletion-manager';
import { getAuditLog } from '@/lib/privacy/audit-log';
import { removeItem } from '@/lib/storage';

const invokeMock = supabase.functions.invoke as jest.Mock;
const AUDIT_STORAGE_KEY = 'privacy.audit.v1';

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({
    data: {
      jobId: 'job-123',
      status: 'queued',
      estimatedCompletion: '2025-09-01T00:00:00Z',
    },
    error: null,
  });
  removeItem(AUDIT_STORAGE_KEY);
});

describe('deletion-manager', () => {
  test('deleteAccountInApp invokes Supabase edge function and records audit', async () => {
    const result = await deleteAccountInApp('test_reason');

    expect(invokeMock).toHaveBeenCalledWith('dsr-delete', {
      body: { reason: 'test_reason' },
    });

    expect(result).toEqual({
      jobId: 'job-123',
      status: 'queued',
      estimatedCompletion: '2025-09-01T00:00:00Z',
    });

    const audit = getAuditLog();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'account-delete-request',
      details: expect.objectContaining({
        source: 'in_app',
        jobId: 'job-123',
        reason: 'test_reason',
      }),
    });
  });

  test('deleteAccountInApp surfaces Supabase errors', async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'Boom' },
    });

    await expect(deleteAccountInApp()).rejects.toThrow('Boom');
    expect(invokeMock).toHaveBeenCalledWith('dsr-delete', {
      body: { reason: 'user_initiated_in_app' },
    });

    const audit = getAuditLog();
    expect(audit).toHaveLength(1);
    expect(audit[0]?.details).toEqual(
      expect.objectContaining({ source: 'in_app' })
    );
  });

  test('requestDataExport queues export job and audits intent', async () => {
    const exportResult = await requestDataExport({ includeTelemetry: false });

    expect(invokeMock).toHaveBeenLastCalledWith('dsr-export', {
      body: {
        includeTelemetry: false,
        includeCrash: true,
        includeConsents: true,
        locale: undefined,
      },
    });

    expect(exportResult.jobId).toBe('job-123');

    const audit = getAuditLog();
    expect(
      audit.some((entry) => entry.details?.reason === 'data_export_before_delete')
    ).toBe(true);
  });

  test('requestDeletionViaWeb exposes canonical URL and audits web source', () => {
    const res = requestDeletionViaWeb('user-1');

    expect(res).toEqual({
      url: 'https://growbro.app/delete-account',
      verified: true,
    });

    const audit = getAuditLog();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      details: expect.objectContaining({
        source: 'web',
        userId: 'user-1',
      }),
    });
  });

  test('validateDeletionPathAccessibility stays within 3 taps', () => {
    const result = validateDeletionPathAccessibility();

    expect(result.accessible).toBe(true);
    expect(result.stepCount).toBeLessThanOrEqual(result.maxAllowed);
  });

  test('provideWebDeletionUrl returns URL exposed via Env', () => {
    expect(provideWebDeletionUrl()).toBe(
      'https://growbro.app/delete-account'
    );
  });
});