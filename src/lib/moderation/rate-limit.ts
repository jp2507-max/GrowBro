// Simple in-memory + persisted rate limiting for moderation actions
// Rules:
// - Max N reports per user per minute/hour
// - Backoff window for repeated reports on same content

import { getItem, setItem } from '@/lib/storage';

type WindowKey = string;

const RL_KEY = 'moderation.ratelimit.v1';

type Bucket = {
  // unix ms
  windowStart: number;
  // count of actions in current window
  count: number;
  // backoff duration in milliseconds (only used for backoff buckets)
  backoffMs?: number;
};

type RateTable = Record<WindowKey, Bucket>;

export type RateDecision = {
  allowed: boolean;
  // milliseconds to wait until next allowed action
  retryAfterMs?: number;
  reason?: 'window_exceeded' | 'backoff';
};

function load(): RateTable {
  return getItem<RateTable>(RL_KEY) ?? {};
}

function save(t: RateTable): void {
  setItem(RL_KEY, t);
}

function windowKey(userId: string | number, kind: string): WindowKey {
  return `${kind}:${userId}`;
}

export type RateLimitPolicy = {
  // moving window size in ms
  windowMs: number;
  // max allowed actions in window
  max: number;
};

export const DEFAULT_POLICY: RateLimitPolicy = {
  windowMs: 60_000, // 1 minute
  max: 5,
};

export function checkRateLimit(
  userId: string | number,
  kind: 'report' | 'block' | 'mute' | 'delete',
  policy: RateLimitPolicy = DEFAULT_POLICY
): RateDecision {
  const table = load();
  const key = windowKey(userId, kind);
  const now = Date.now();
  const bucket = table[key];
  if (!bucket || now - bucket.windowStart >= policy.windowMs) {
    // open fresh window
    table[key] = { windowStart: now, count: 1 };
    save(table);
    return { allowed: true };
  }
  if (bucket.count < policy.max) {
    table[key] = { ...bucket, count: bucket.count + 1 };
    save(table);
    return { allowed: true };
  }
  const retryAfter = policy.windowMs - (now - bucket.windowStart);
  return {
    allowed: false,
    retryAfterMs: retryAfter,
    reason: 'window_exceeded',
  };
}

export function nextAllowedTimestamp(
  userId: string | number,
  kind: 'report' | 'block' | 'mute' | 'delete',
  policy: RateLimitPolicy = DEFAULT_POLICY
): number | undefined {
  const table = load();
  const key = windowKey(userId, kind);
  const bucket = table[key];
  if (!bucket) return undefined;
  const now = Date.now();
  const delta = now - bucket.windowStart;
  if (delta >= policy.windowMs) return undefined;
  if (bucket.count >= policy.max) return bucket.windowStart + policy.windowMs;
  return undefined;
}

export function recordBackoff(
  userId: string | number,
  contentId: string | number,
  ms: number
): void {
  const table = load();
  const key = `backoff:${userId}:${contentId}`;
  table[key] = { windowStart: Date.now(), count: 0, backoffMs: ms };
  save(table);
}

export function getBackoffUntil(
  userId: string | number,
  contentId: string | number
): number | undefined {
  const table = load();
  const key = `backoff:${userId}:${contentId}`;
  const bucket = table[key];
  if (!bucket || !bucket.backoffMs) return undefined;
  const until = bucket.windowStart + bucket.backoffMs;
  if (Date.now() >= until) return undefined;
  return until;
}
