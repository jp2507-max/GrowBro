import { Env } from '@env';
import axios from 'axios';

import { categorizeError } from '@/lib/error-handling';
import { computeBackoffMs } from '@/lib/sync-engine';

export const client = axios.create({
  baseURL: Env.API_URL,
  timeout: 30000,
});

// Lightweight retry/backoff without extra deps
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const cfg: any = error?.config ?? {};
    // Initialize per-request retry state
    cfg.__retryCount = cfg.__retryCount ?? 0;
    const maxRetries = cfg.__maxRetries ?? 3;

    const { isRetryable } = categorizeError(error);
    const method = String(cfg?.method ?? 'get').toUpperCase();
    const isIdempotent =
      method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
    if (!isRetryable || !isIdempotent || cfg.__retryCount >= maxRetries) {
      return Promise.reject(error);
    }

    cfg.__retryCount += 1;
    const delay = computeBackoffMs(cfg.__retryCount, 1000, 30_000);
    await new Promise((r) => setTimeout(r, delay));
    return client(cfg);
  }
);
