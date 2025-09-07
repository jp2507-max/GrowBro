import {
  categorizeSyncError,
  SYNC_ERROR_TYPES,
  SyncSchemaMismatchError,
} from '@/lib/sync/sync-errors';

describe('sync-errors', () => {
  test('categorizes timeout as network retryable', () => {
    const err = new Error(
      'Request timeout: pull operation exceeded 30 seconds'
    );
    const c = categorizeSyncError(err);
    expect(c.type).toBe(SYNC_ERROR_TYPES.NETWORK);
    expect(c.retryable).toBe(true);
  });

  test('categorizes 409 as conflict retryable', () => {
    const err = new Error('push failed: 409');
    const c = categorizeSyncError(err);
    expect(c.type).toBe(SYNC_ERROR_TYPES.CONFLICT);
    expect(c.retryable).toBe(true);
  });

  test('categorizes 401 as auth retryable', () => {
    const err = new Error('pull failed: 401');
    const c = categorizeSyncError(err);
    expect(c.type).toBe(SYNC_ERROR_TYPES.AUTH);
    expect(c.retryable).toBe(true);
  });

  test('categorizes 422 as validation non-retryable', () => {
    const err = new Error('push failed: 422');
    const c = categorizeSyncError(err);
    expect(c.type).toBe(SYNC_ERROR_TYPES.VALIDATION);
    expect(c.retryable).toBe(false);
  });

  test('schema mismatch is validation non-retryable', () => {
    const err = new SyncSchemaMismatchError();
    const c = categorizeSyncError(err);
    expect(c.type).toBe(SYNC_ERROR_TYPES.VALIDATION);
    expect(c.retryable).toBe(false);
  });
});
