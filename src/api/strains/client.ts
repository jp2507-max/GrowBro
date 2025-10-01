import { Env } from '@env';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

import { categorizeError } from '@/lib/error-handling';
import { computeBackoffMs } from '@/lib/sync/backoff';

import type { GetStrainsParams, Strain, StrainsResponse } from './types';
import { normalizeStrain } from './utils';

/**
 * API client for The Weed DB strains data
 * Routes through serverless proxy to protect API credentials
 */
export class StrainsApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    // Use proxy URL in production, direct API URL in development
    this.baseURL =
      Env.STRAINS_API_URL ||
      (process.env.NODE_ENV === 'production'
        ? `${Env.API_URL}/strains-proxy`
        : 'https://api.theweeddb.com/v1');

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(Env.STRAINS_API_KEY && {
          'x-rapidapi-key': Env.STRAINS_API_KEY,
          'x-rapidapi-host': Env.STRAINS_API_HOST,
        }),
      },
    });

    // Add security interceptors to strip sensitive headers from logs/serialization
    this.setupSecurityInterceptors();
  }

  /**
   * Setup axios interceptors to sanitize sensitive headers from request/response objects
   * This prevents API keys from being leaked in logs, error reports, or serialized objects
   */
  private setupSecurityInterceptors(): void {
    const { sanitizeHeaders, sanitizeConfig } =
      this.createSanitizationHelpers();

    this.setupRequestInterceptor(sanitizeConfig);
    this.setupResponseInterceptor(sanitizeHeaders, sanitizeConfig);
    this.setupRetryInterceptor();
  }

  private createSanitizationHelpers() {
    const sensitiveHeaders = [
      'x-rapidapi-key',
      'x-rapidapi-host',
      'authorization',
      'x-api-key',
    ];

    const sanitizeHeaders = (headers: any): any => {
      if (!headers || typeof headers !== 'object') return headers;
      const sanitized = { ...headers };
      for (const headerName of sensitiveHeaders) {
        if (sanitized[headerName] !== undefined) {
          sanitized[headerName] = '[REDACTED]';
        }
      }
      return sanitized;
    };

    const sanitizeConfig = (config: any): any => {
      if (!config || typeof config !== 'object') return config;
      const sanitized = { ...config };
      if (sanitized.headers) {
        sanitized.headers = sanitizeHeaders(sanitized.headers);
      }
      return sanitized;
    };

    return { sanitizeHeaders, sanitizeConfig };
  }

  private setupRequestInterceptor(sanitizeConfig: (config: any) => any): void {
    this.client.interceptors.request.use(
      (config) => sanitizeConfig(config),
      (error) => {
        if (error.config) {
          error.config = sanitizeConfig(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  private setupResponseInterceptor(
    sanitizeHeaders: (headers: any) => any,
    sanitizeConfig: (config: any) => any
  ): void {
    this.client.interceptors.response.use(
      (response) => {
        if (response.headers) {
          response.headers = sanitizeHeaders(response.headers);
        }
        return response;
      },
      (error) => {
        if (error.response?.headers) {
          error.response.headers = sanitizeHeaders(error.response.headers);
        }
        if (error.config) {
          error.config = sanitizeConfig(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  private setupRetryInterceptor(): void {
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const cfg: any = error?.config ?? {};
        cfg.__retryCount = cfg.__retryCount ?? 0;
        const maxRetries = cfg.__maxRetries ?? 3;

        const { isRetryable } = categorizeError(error);
        const method = String(cfg?.method ?? 'get').toUpperCase();
        const isIdempotent =
          method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

        const status = error?.response?.status;
        if (status === 429) {
          return Promise.reject(error);
        }

        if (!isRetryable || !isIdempotent || cfg.__retryCount >= maxRetries) {
          return Promise.reject(error);
        }

        cfg.__retryCount += 1;
        const delay = computeBackoffMs(cfg.__retryCount, 1000, 30_000);
        await new Promise((r) => setTimeout(r, delay));

        return this.client(cfg);
      }
    );
  }

  /**
   * Build query parameters for strains API request
   */
  private buildQueryParams(params: GetStrainsParams): URLSearchParams {
    const { page = 0, pageSize = 20, cursor, searchQuery, filters } = params;

    const queryParams = new URLSearchParams();

    // Add pagination params
    if (cursor) {
      queryParams.set('cursor', cursor);
    } else {
      queryParams.set('page', String(page));
    }
    queryParams.set('limit', String(pageSize));

    // Add search query
    if (searchQuery && searchQuery.trim()) {
      queryParams.set('search', searchQuery.trim());
    }

    // Add filters
    if (filters) {
      if (filters.race) {
        queryParams.set('type', filters.race);
      }
      if (filters.effects && filters.effects.length > 0) {
        queryParams.set('effects', filters.effects.join(','));
      }
      if (filters.flavors && filters.flavors.length > 0) {
        queryParams.set('flavors', filters.flavors.join(','));
      }
      if (filters.difficulty) {
        queryParams.set('difficulty', filters.difficulty);
      }
      if (filters.thcMin !== undefined) {
        queryParams.set('thc_min', String(filters.thcMin));
      }
      if (filters.thcMax !== undefined) {
        queryParams.set('thc_max', String(filters.thcMax));
      }
      if (filters.cbdMin !== undefined) {
        queryParams.set('cbd_min', String(filters.cbdMin));
      }
      if (filters.cbdMax !== undefined) {
        queryParams.set('cbd_max', String(filters.cbdMax));
      }
    }

    return queryParams;
  }

  /**
   * Normalize API response to consistent format
   */
  private normalizeResponse(
    data: any,
    pageSize: number
  ): { strains: any[]; hasMore: boolean; nextCursor?: string } {
    if (Array.isArray(data.strains)) {
      // Proxy normalized format
      return {
        strains: data.strains,
        hasMore: data.hasMore ?? data.strains.length === pageSize,
        nextCursor: data.nextCursor,
      };
    }

    if (Array.isArray(data.data)) {
      // Legacy format
      const nextCursor = data.next
        ? new URL(data.next, this.baseURL).searchParams.get('cursor') ||
          undefined
        : undefined;
      return {
        strains: data.data,
        hasMore: Boolean(data.next),
        nextCursor,
      };
    }

    if (Array.isArray(data)) {
      // Direct array response
      return {
        strains: data,
        hasMore: data.length === pageSize,
        nextCursor: undefined,
      };
    }

    throw new Error('Invalid API response format');
  }

  /**
   * Fetch paginated list of strains with optional filters and search
   */
  async getStrains(params: GetStrainsParams = {}): Promise<StrainsResponse> {
    const { signal, pageSize = 20 } = params;
    const queryParams = this.buildQueryParams(params);

    const config: AxiosRequestConfig = {
      params: queryParams,
      signal,
      headers: {
        'Cache-Control': 'max-age=300', // 5 minutes
      },
    };

    // Support ETag caching if available
    const cachedETag = this.getCachedETag(queryParams.toString());
    if (cachedETag) {
      config.headers = {
        ...config.headers,
        'If-None-Match': cachedETag,
      };
    }

    try {
      const response = await this.client.get('/strains', config);

      // Cache ETag for future requests
      const etag = response.headers['etag'];
      if (etag) {
        this.setCachedETag(queryParams.toString(), etag);
      }

      // Normalize response format
      const { strains, hasMore, nextCursor } = this.normalizeResponse(
        response.data,
        pageSize
      );

      // Normalize all strain data
      const normalizedStrains = strains.map((s) => normalizeStrain(s));

      const result = {
        data: normalizedStrains,
        hasMore,
        nextCursor,
      };

      // Cache the response
      this.setCachedData(queryParams.toString(), result);

      return result;
    } catch (error: any) {
      // Handle 304 Not Modified - return cached data
      if (error?.response?.status === 304) {
        const cached = this.getCachedData(queryParams.toString());
        if (cached && cached.data.length > 0) {
          // Optionally: validate cache timestamp or version
          return cached;
        }
        // If cache miss on 304, this is unexpected—log and re-throw
        console.warn('304 Not Modified but no cached data found');
      }

      throw error;
    }
  }

  /**
   * Fetch single strain by ID
   */
  async getStrain(strainId: string, signal?: AbortSignal): Promise<Strain> {
    const encodedId = encodeURIComponent(strainId);
    const config: AxiosRequestConfig = {
      signal,
      headers: {
        'Cache-Control': 'max-age=86400', // 24 hours
      },
    };

    const response = await this.client.get(`/strains/${encodedId}`, config);
    const data = response.data;

    // Handle different response formats
    const strainData = data.strain || data.data || data;

    return normalizeStrain(strainData);
  }

  /**
   * Simple in-memory ETag cache
   * In production, consider using MMKV or AsyncStorage
   */
  private etagCache = new Map<string, string>();
  private dataCache = new Map<string, StrainsResponse>();

  private getCachedETag(key: string): string | undefined {
    return this.etagCache.get(key);
  }

  private setCachedETag(key: string, etag: string): void {
    // Limit cache size to prevent memory issues
    if (this.etagCache.size > 50) {
      const firstKey = this.etagCache.keys().next().value;
      if (firstKey) {
        this.etagCache.delete(firstKey);
      }
    }
    this.etagCache.set(key, etag);
  }

  private getCachedData(key: string): StrainsResponse | undefined {
    return this.dataCache.get(key);
  }

  private setCachedData(key: string, data: StrainsResponse): void {
    // Limit cache size
    if (this.dataCache.size > 50) {
      const firstKey = this.dataCache.keys().next().value;
      if (firstKey) {
        this.dataCache.delete(firstKey);
      }
    }
    this.dataCache.set(key, data);
  }
}

// Lazy singleton instance
let clientInstance: StrainsApiClient | null = null;

/**
 * Get the singleton API client instance
 */
export function getStrainsApiClient(): StrainsApiClient {
  if (!clientInstance) {
    clientInstance = new StrainsApiClient();
  }
  return clientInstance;
}

/**
 * Reset the singleton instance (primarily for testing)
 */
export function resetStrainsApiClient(): void {
  clientInstance = null;
}
