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

  describe('inferAppealType edge cases', () => {
    test('should classify "My private account information was shared" as content_removal', async () => {
      // This should be content_removal because of "private" and "information" and "shared" keywords
      // even though it contains "account" which would normally trigger account_action
      const reason = 'My private account information was shared';
      // We need to test the internal function, so we'll enqueue and check the API call
      const mockApiSubmit = jest
        .spyOn(api, 'apiSubmitAppeal')
        .mockResolvedValue({ success: true });
      jest.spyOn(auth, 'getAuthenticatedUserId').mockResolvedValue('user123');

      appealsQueue.enqueue(4, reason);
      await appealsQueue.processAll();

      expect(mockApiSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          appeal_type: 'content_removal',
          counter_arguments: reason,
        })
      );
    });

    test('should classify "I\'m banned in my region" as geo_restriction', async () => {
      // This should be geo_restriction because of "region" keyword
      // even though it contains "ban" which would normally trigger account_action
      const reason = "I'm banned in my region";
      const mockApiSubmit = jest
        .spyOn(api, 'apiSubmitAppeal')
        .mockResolvedValue({ success: true });
      jest.spyOn(auth, 'getAuthenticatedUserId').mockResolvedValue('user123');

      appealsQueue.enqueue(5, reason);
      await appealsQueue.processAll();

      expect(mockApiSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          appeal_type: 'geo_restriction',
          counter_arguments: reason,
        })
      );
    });

    test('should prioritize geo keywords over account keywords', async () => {
      // Test mixed scenarios where both account and geo keywords are present
      const testCases = [
        {
          reason: 'My account was banned in this region',
          expected: 'geo_restriction',
        },
        {
          reason: 'User account geo restriction applied',
          expected: 'geo_restriction',
        },
        {
          reason: 'Suspended account in restricted country',
          expected: 'geo_restriction',
        },
      ];

      for (const { reason, expected } of testCases) {
        const mockApiSubmit = jest
          .spyOn(api, 'apiSubmitAppeal')
          .mockResolvedValue({ success: true });
        jest.spyOn(auth, 'getAuthenticatedUserId').mockResolvedValue('user123');

        appealsQueue.enqueue(6, reason);
        await appealsQueue.processAll();

        expect(mockApiSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            appeal_type: expected,
            counter_arguments: reason,
          })
        );
        jest.clearAllMocks();
      }
    });

    test('should prioritize content removal indicators over account keywords', async () => {
      // Test cases where content removal words should take precedence over account words
      const testCases = [
        {
          reason: 'My account information was posted publicly',
          expected: 'content_removal',
        },
        {
          reason: 'Private user details shared without permission',
          expected: 'content_removal',
        },
        {
          reason: 'Account data was inappropriately shared',
          expected: 'content_removal',
        },
      ];

      for (const { reason, expected } of testCases) {
        const mockApiSubmit = jest
          .spyOn(api, 'apiSubmitAppeal')
          .mockResolvedValue({ success: true });
        jest.spyOn(auth, 'getAuthenticatedUserId').mockResolvedValue('user123');

        appealsQueue.enqueue(7, reason);
        await appealsQueue.processAll();

        expect(mockApiSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            appeal_type: expected,
            counter_arguments: reason,
          })
        );
        jest.clearAllMocks();
      }
    });
  });
});
