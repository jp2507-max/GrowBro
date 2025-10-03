/**
 * Type definitions for strains-proxy Edge Function
 */

export interface StrainFilters {
  race?: 'indica' | 'sativa' | 'hybrid';
  effects?: string[];
  flavors?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  thcMin?: number;
  thcMax?: number;
  cbdMin?: number;
  cbdMax?: number;
}

export interface ProxyRequest {
  endpoint: 'list' | 'detail';
  strainId?: string;
  page?: number;
  pageSize?: number;
  cursor?: string;
  searchQuery?: string;
  filters?: StrainFilters;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface ProxyResponse {
  strains?: any[];
  strain?: any;
  hasMore?: boolean;
  nextCursor?: string;
  cached?: boolean;
  error?: string;
}

export interface CacheEntry {
  data: any;
  etag: string;
  cachedAt: number;
  expiresAt: number;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}
