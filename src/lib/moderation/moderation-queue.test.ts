import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import * as api from '@/api/moderation';

import { moderationQueue } from './moderation-queue';

describe('ModerationQueue', () => {
  beforeEach(() => {
    moderationQueue.reset();
  });
  afterEach(() => {
    moderationQueue.reset();
    jest.restoreAllMocks();
  });

  test('enqueue and audit report', () => {
    const r = moderationQueue.enqueueReport(1, 'spam');
    expect(r.status).toBe('queued');
    const q = moderationQueue.getQueue();
    expect(q.find((x) => x.id === r.id)).toBeTruthy();
    const audit = moderationQueue.getAuditTrail();
    expect(audit[0].action).toBe('report_enqueued');
  });

  test('process report success removes from queue and audits', async () => {
    jest.spyOn(api, 'apiReportContent').mockResolvedValue(undefined as any);
    moderationQueue.enqueueReport(2, 'harassment');
    await moderationQueue.processAll();
    expect(moderationQueue.getQueue()).toHaveLength(0);
    expect(
      moderationQueue.getAuditTrail().some((a) => a.action === 'report_sent')
    ).toBe(true);
  });

  test('process report failure marks failed and audits', async () => {
    jest.spyOn(api, 'apiReportContent').mockRejectedValue(new Error('network'));
    moderationQueue.enqueueReport(3, 'illegal');
    await moderationQueue.processAll();
    const q = moderationQueue.getQueue();
    expect(q[0].status).toBe('failed');
    expect(
      moderationQueue.getAuditTrail().some((a) => a.action === 'report_failed')
    ).toBe(true);
  });

  test('escalate to human updates status and audit', () => {
    const r = moderationQueue.enqueueReport(4, 'other');
    moderationQueue.escalateToHuman(r.id, 'manual');
    const q = moderationQueue.getQueue();
    expect(q[0].status).toBe('escalated');
    expect(
      moderationQueue
        .getAuditTrail()
        .some((a) => a.action === 'escalate_report')
    ).toBe(true);
  });
});
