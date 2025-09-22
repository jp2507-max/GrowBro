import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';

import { removeItem } from '@/lib/storage';

import {
  checkRateLimit,
  DEFAULT_POLICY,
  getBackoffUntil,
  nextAllowedTimestamp,
  recordBackoff,
} from './rate-limit';

describe('rate-limit', () => {
  beforeEach(() => {
    removeItem('moderation.ratelimit.v1');
  });
  afterEach(() => {
    removeItem('moderation.ratelimit.v1');
  });

  test('allows actions within window until max', () => {
    const uid = 'u1';
    const p = { ...DEFAULT_POLICY, max: 2, windowMs: 1000 };
    expect(checkRateLimit(uid, 'report', p).allowed).toBe(true);
    expect(checkRateLimit(uid, 'report', p).allowed).toBe(true);
    const third = checkRateLimit(uid, 'report', p);
    expect(third.allowed).toBe(false);
    expect(typeof third.retryAfterMs).toBe('number');
  });

  test('nextAllowedTimestamp reflects remaining window', () => {
    const uid = 'u2';
    const p = { ...DEFAULT_POLICY, max: 1, windowMs: 500 };
    expect(checkRateLimit(uid, 'block', p).allowed).toBe(true);
    const ts = nextAllowedTimestamp(uid, 'block', p)!;
    expect(ts).toBeGreaterThan(Date.now());
  });

  test('backoff utilities store and retrieve until timestamp', () => {
    const uid = 'u3';
    const cid = 42;
    recordBackoff(uid, cid, 200);
    const until = getBackoffUntil(uid, cid)!;
    expect(until).toBeGreaterThan(Date.now());
  });
});
