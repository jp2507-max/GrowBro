import { Env } from '@env';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';

import { getSecurityFeatureFlags } from '@/lib/security/feature-flags';

type HostPattern = {
  raw: string;
  normalized: string;
  allowSubdomains: boolean;
};

const parseHostPatterns = (raw?: string | null): HostPattern[] => {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((pattern) => {
      const allowSubdomains = pattern.startsWith('.');
      const normalized = allowSubdomains ? pattern.slice(1) : pattern;
      return {
        raw: pattern,
        normalized: normalized.toLowerCase(),
        allowSubdomains,
      };
    });
};

const PINNED_HOSTS = parseHostPatterns(Env.SECURITY_PIN_DOMAINS);

const warned = {
  missingConfig: false,
  bypass: false,
};

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const resolveRequestUrl = (config: AxiosRequestConfig): URL => {
  const candidate = config.url ?? '';
  if (candidate && isAbsoluteUrl(candidate)) {
    return new URL(candidate);
  }
  const base = config.baseURL ?? Env.API_URL ?? 'https://localhost';
  return new URL(candidate, base);
};

const hostMatches = (host: string, pattern: HostPattern): boolean => {
  const normalizedHost = host.toLowerCase();
  if (pattern.allowSubdomains) {
    return (
      normalizedHost === pattern.normalized ||
      normalizedHost.endsWith(`.${pattern.normalized}`)
    );
  }
  return normalizedHost === pattern.normalized;
};

export function registerCertificatePinningInterceptor(
  client: AxiosInstance
): void {
  const flags = getSecurityFeatureFlags();
  if (!flags.enableCertificatePinning) {
    return;
  }

  if (flags.bypassCertificatePinning) {
    if (!warned.bypass) {
      console.warn(
        '[security] Certificate pinning bypass is enabled. DO NOT SHIP THIS CONFIG TO PRODUCTION.'
      );
      warned.bypass = true;
    }
    return;
  }

  if (!PINNED_HOSTS.length) {
    if (!warned.missingConfig) {
      console.warn(
        '[security] Certificate pinning enabled but SECURITY_PIN_DOMAINS is not configured.'
      );
      warned.missingConfig = true;
    }
    return;
  }

  client.interceptors.request.use((config) => {
    const url = resolveRequestUrl(config);

    if (url.protocol !== 'https:') {
      throw new Error(
        `[security] Refusing non-HTTPS request (${url.toString()}) while certificate pinning is enabled.`
      );
    }

    const allowed = PINNED_HOSTS.some((pattern) =>
      hostMatches(url.hostname, pattern)
    );

    if (!allowed) {
      throw new Error(
        `[security] Refusing request to unpinned host "${url.hostname}" while certificate pinning is enabled.`
      );
    }

    return config;
  });
}

export function getPinnedHosts(): string[] {
  return PINNED_HOSTS.map((pattern) => pattern.raw || pattern.normalized);
}
