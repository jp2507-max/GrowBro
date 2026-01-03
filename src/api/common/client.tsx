import { Env } from '@env';
import axios, { type InternalAxiosRequestConfig } from 'axios';

import { categorizeError } from '@/lib/error-handling';
import { registerCertificatePinningInterceptor } from '@/lib/security/certificate-pinner';
import { supabase } from '@/lib/supabase';
import { computeBackoffMs } from '@/lib/sync/backoff';

interface RetryConfig extends InternalAxiosRequestConfig {
  __retryCount?: number;
  __maxRetries?: number;
}

export const client = axios.create({
  baseURL: Env.API_URL,
  timeout: 30000,
});

registerCertificatePinningInterceptor(client);

// Inject auth token from Supabase session
client.interceptors.request.use(async (config) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

// Lightweight retry/backoff without extra deps
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Guard against missing or invalid config that would cause client() to fail
    if (!error?.config || !error.config.url) {
      return Promise.reject(error);
    }

    const cfg = error.config as RetryConfig;
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
