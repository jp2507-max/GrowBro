import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import * as api from '@/api/moderation/appeals';
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
    jest.spyOn(api, 'apiSubmitAppeal').mockResolvedValue(undefined as any);
    appealsQueue.enqueue(1, 'unfair');
    await appealsQueue.processAll();
    expect(appealsQueue.getAll()).toHaveLength(0);
  });

  test('process failure marks failed', async () => {
    jest.spyOn(api, 'apiSubmitAppeal').mockRejectedValue(new Error('net'));
    appealsQueue.enqueue(2, 'mistake');
    await appealsQueue.processAll();
    const items = appealsQueue.getAll();
    expect(items[0].status).toBe('failed');
  });
});
