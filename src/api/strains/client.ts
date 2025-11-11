import { Env } from '@env';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

import { categorizeError } from '@/lib/error-handling';
import { registerCertificatePinningInterceptor } from '@/lib/security/certificate-pinner';
import { computeBackoffMs } from '@/lib/sync/backoff';

import type { GetStrainsParams, Strain, StrainsResponse } from './types';
import { normalizeStrain } from './utils';

// Analytics tracking (lazy loaded to avoid circular dependencies)
let analyticsClient: any = null;
async function getAnalyticsClient() {
  if (!analyticsClient) {
    const { getAnalyticsClient: getClient } = await import(
      '@/lib/analytics-registry'
    );
    analyticsClient = getClient();
  }
  return analyticsClient;
}

/**
 * API client for The Weed DB strains data
 * Routes through serverless proxy to protect API credentials
 */
export class StrainsApiClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    // Use proxy URL in production, direct API URL in development
    const useProxy =
      process.env.NODE_ENV === 'production' ||
      Env.STRAINS_USE_PROXY === 'true' ||
      Env.STRAINS_USE_PROXY === '1';

    this.baseURL = useProxy
      ? `${Env.SUPABASE_URL}/functions/v1/strains-proxy`
      : Env.STRAINS_API_URL || 'https://api.theweeddb.com/v1';

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Only add API keys when NOT using proxy
        ...(!useProxy &&
          Env.STRAINS_API_KEY && {
            'x-rapidapi-key': Env.STRAINS_API_KEY,
            'x-rapidapi-host': Env.STRAINS_API_HOST,
          }),
      },
    });

    registerCertificatePinningInterceptor(this.client);

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
      (config) => config,
      (error) => {
        if (error.config) {
          error.config = sanitizeConfig({ ...error.config });
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
          error.config = sanitizeConfig({ ...error.config });
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
    const {
      page = 0,
      pageSize = 20,
      cursor,
      searchQuery,
      filters,
      sortBy,
      sortDirection = 'asc',
    } = params;

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

    // Add sort params
    if (sortBy) {
      queryParams.set('sort_by', sortBy);
      queryParams.set('sort_direction', sortDirection);
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
    const startTime = Date.now();

    const config = this.buildRequestConfig(queryParams, signal);

    try {
      const response = await this.client.get('/strains', config);
      return this.handleSuccessResponse({
        response,
        queryParams,
        params,
        pageSize,
        responseTime: Date.now() - startTime,
      });
    } catch (error: any) {
      return this.handleErrorResponse({
        error,
        queryParams,
        params,
        responseTime: Date.now() - startTime,
      });
    }
  }

  /**
   * Build request config with caching headers
   */
  private buildRequestConfig(
    queryParams: URLSearchParams,
    signal?: AbortSignal
  ): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
      params: queryParams,
      signal,
      headers: {
        'Cache-Control': 'max-age=300',
      },
    };

    const cachedETag = this.getCachedETag(queryParams.toString());
    if (cachedETag) {
      config.headers = {
        ...config.headers,
        'If-None-Match': cachedETag,
      };
    }

    return config;
  }

  /**
   * Handle successful API response
   */
  private handleSuccessResponse(options: {
    response: any;
    queryParams: URLSearchParams;
    params: GetStrainsParams;
    pageSize: number;
    responseTime: number;
  }): StrainsResponse {
    const etag = options.response.headers['etag'];
    if (etag) {
      this.setCachedETag(options.queryParams.toString(), etag);
    }

    const { strains, hasMore, nextCursor } = this.normalizeResponse(
      options.response.data,
      options.pageSize
    );

    const result = {
      data: strains.map((s) => normalizeStrain(s)),
      hasMore,
      nextCursor,
    };

    this.setCachedData(options.queryParams.toString(), result);

    if (options.params.searchQuery || options.params.filters) {
      void this.trackSearchAnalytics({
        params: options.params,
        resultsCount: result.data.length,
        responseTimeMs: options.responseTime,
        isOffline: false,
      });
    }

    return result;
  }

  /**
   * Handle API error response
   */
  private handleErrorResponse(options: {
    error: any;
    queryParams: URLSearchParams;
    params: GetStrainsParams;
    responseTime: number;
  }): StrainsResponse {
    if (options.error?.response?.status === 304) {
      const cached = this.getCachedData(options.queryParams.toString());
      if (cached && cached.data.length > 0) {
        void this.trackSearchAnalytics({
          params: options.params,
          resultsCount: cached.data.length,
          responseTimeMs: options.responseTime,
          isOffline: true,
        });
        return cached;
      }
      console.warn('304 Not Modified but no cached data found');
    }

    throw options.error;
  }

  /**
   * Track search analytics (non-blocking)
   */
  private async trackSearchAnalytics(options: {
    params: GetStrainsParams;
    resultsCount: number;
    responseTimeMs: number;
    isOffline: boolean;
  }): Promise<void> {
    try {
      const analytics = await getAnalyticsClient();
      const { trackStrainSearch } = await import(
        '@/lib/strains/strains-analytics'
      );

      trackStrainSearch(analytics, {
        query: options.params.searchQuery,
        resultsCount: options.resultsCount,
        filters: options.params.filters,
        sortBy: options.params.sortBy,
        isOffline: options.isOffline,
        responseTimeMs: options.responseTimeMs,
      });
    } catch (error) {
      // Silently fail analytics to not impact user experience
      console.debug('[StrainsApiClient] Analytics tracking failed:', error);
    }
  }

  /**
   * Fetch single strain by ID
   */
  async getStrain(strainId: string, signal?: AbortSignal): Promise<Strain> {
    const encodedId = encodeURIComponent(strainId);
    const startTime = Date.now();

    const config: AxiosRequestConfig = {
      signal,
      headers: {
        'Cache-Control': 'max-age=86400', // 24 hours
      },
    };

    try {
      const response = await this.client.get(`/strains/${encodedId}`, config);
      const responseTime = Date.now() - startTime;
      const data = response.data;

      // Handle different response formats
      const strainData = data.strain || data.data || data;

      // Track API performance
      void this.trackApiPerformance({
        endpoint: 'detail',
        responseTimeMs: responseTime,
        statusCode: response.status,
        cacheHit: false,
      });

      return normalizeStrain(strainData);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const statusCode = error?.response?.status || 0;

      // Track error performance
      void this.trackApiPerformance({
        endpoint: 'detail',
        responseTimeMs: responseTime,
        statusCode,
        cacheHit: false,
        errorType: error?.message || 'unknown',
      });

      throw error;
    }
  }

  /**
   * Track API performance (non-blocking)
   */
  private async trackApiPerformance(options: {
    endpoint: 'list' | 'detail';
    responseTimeMs: number;
    statusCode: number;
    cacheHit: boolean;
    errorType?: string;
  }): Promise<void> {
    try {
      const analytics = await getAnalyticsClient();
      const { trackApiPerformance } = await import(
        '@/lib/strains/strains-performance'
      );

      trackApiPerformance(analytics, options);
    } catch (error) {
      // Silently fail analytics to not impact user experience
      console.debug('[StrainsApiClient] Performance tracking failed:', error);
    }
  }

  /**
   * Simple in-memory ETag cache
   * In production, consider using MMKV or AsyncStorage
   */
  private etagCache = new Map<string, string>();
  private dataCache = new Map<string, StrainsResponse>();

  private getCachedETag(key: string): string | undefined {
    const hit = this.etagCache.get(key);
    void this.trackCacheOperation({
      operation: 'read',
      cacheType: 'etag',
      hit: hit !== undefined,
    });
    return hit;
  }

  private setCachedETag(key: string, etag: string): void {
    // Limit cache size to prevent memory issues
    if (this.etagCache.size > 50) {
      const firstKey = this.etagCache.keys().next().value;
      if (firstKey) {
        this.etagCache.delete(firstKey);
        void this.trackCacheOperation({
          operation: 'evict',
          cacheType: 'etag',
          hit: false,
        });
      }
    }
    this.etagCache.set(key, etag);
    void this.trackCacheOperation({
      operation: 'write',
      cacheType: 'etag',
      hit: false,
    });
  }

  private getCachedData(key: string): StrainsResponse | undefined {
    const hit = this.dataCache.get(key);
    void this.trackCacheOperation({
      operation: 'read',
      cacheType: 'memory',
      hit: hit !== undefined,
    });
    return hit;
  }

  private setCachedData(key: string, data: StrainsResponse): void {
    // Limit cache size
    if (this.dataCache.size > 50) {
      const firstKey = this.dataCache.keys().next().value;
      if (firstKey) {
        this.dataCache.delete(firstKey);
        void this.trackCacheOperation({
          operation: 'evict',
          cacheType: 'memory',
          hit: false,
        });
      }
    }
    this.dataCache.set(key, data);

    // Calculate approximate size
    const sizeKb = Math.round(JSON.stringify(data).length / 1024);
    void this.trackCacheOperation({
      operation: 'write',
      cacheType: 'memory',
      hit: false,
      sizeKb,
    });
  }

  /**
   * Track cache operation (non-blocking)
   */
  private async trackCacheOperation(options: {
    operation: 'read' | 'write' | 'evict';
    cacheType: 'memory' | 'disk' | 'etag';
    hit: boolean;
    sizeKb?: number;
  }): Promise<void> {
    try {
      const analytics = await getAnalyticsClient();
      const { trackCachePerformance } = await import(
        '@/lib/strains/strains-performance'
      );

      trackCachePerformance(analytics, {
        operation: options.operation,
        cacheType: options.cacheType,
        hitRate:
          options.operation === 'read' ? (options.hit ? 1 : 0) : undefined,
        sizeKb: options.sizeKb,
      });
    } catch (error) {
      // Silently fail analytics to not impact user experience
      console.debug('[StrainsApiClient] Cache tracking failed:', error);
    }
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
