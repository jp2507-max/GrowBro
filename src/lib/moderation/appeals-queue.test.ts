import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import * as api from '@/api/moderation/appeals';
import * as auth from '@/lib/auth/user-utils';
import { removeItem } from '@/lib/storage';

import { appealsQueue } from './appeals-queue';

describe('AppealsQueue', () => {
  beforeEach(() => {
    appealsQueue.reset();
  });
  afterEach(() => {
    appealsQueue.reset();
    removeItem('moderation.appeals.queue.v1');
    jest.restoreAllMocks();
  });

  test('enqueue and process success', async () => {
    jest.spyOn(api, 'apiSubmitAppeal').mockResolvedValue({ success: true });
    jest.spyOn(auth, 'getAuthenticatedUserId').mockResolvedValue('user123');
    appealsQueue.enqueue(1, 'unfair');
    await appealsQueue.processAll();
    expect(appealsQueue.getAll()).toHaveLength(0);
  });

  test('process failure marks failed', async () => {
    jest
      .spyOn(api, 'apiSubmitAppeal')
      .mockResolvedValue({ success: false, error: 'API error' });
    jest.spyOn(auth, 'getAuthenticatedUserId').mockResolvedValue('user123');
    appealsQueue.enqueue(2, 'mistake');
    await appealsQueue.processAll();
    const items = appealsQueue.getAll();
    expect(items[0].status).toBe('failed');
  });

  test('infers appeal type from reason', async () => {
    const mockApiSubmit = jest
      .spyOn(api, 'apiSubmitAppeal')
      .mockResolvedValue({ success: true });
    jest.spyOn(auth, 'getAuthenticatedUserId').mockResolvedValue('user123');

    // Test content removal (default)
    appealsQueue.enqueue(1, 'inappropriate content');
    await appealsQueue.processAll();

    // Test account action
    appealsQueue.enqueue(2, 'account suspension');
    await appealsQueue.processAll();

    // Test geo restriction
    appealsQueue.enqueue(3, 'geo blocked content');
    await appealsQueue.processAll();

    expect(mockApiSubmit).toHaveBeenCalledTimes(3);

    // Check the appeal types passed to the API
    expect(mockApiSubmit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        appeal_type: 'content_removal',
        counter_arguments: 'inappropriate content',
      })
    );

    expect(mockApiSubmit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        appeal_type: 'account_action',
        counter_arguments: 'account suspension',
      })
    );

    expect(mockApiSubmit).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        appeal_type: 'geo_restriction',
        counter_arguments: 'geo blocked content',
      })
    );
  });
});
