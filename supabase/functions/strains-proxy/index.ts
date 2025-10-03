// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import type {
  CacheEntry,
  ProxyRequest,
  ProxyResponse,
  RateLimitEntry,
} from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, If-None-Match, Cache-Control',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP
const rateLimitMap = new Map<string, RateLimitEntry>();

// Cache configuration
const CACHE_TTL_MS = 5 * 60_000; // 5 minutes for list endpoints
const CACHE_TTL_DETAIL_MS = 24 * 60 * 60_000; // 24 hours for detail endpoints
const cacheMap = new Map<string, CacheEntry>();

/**
 * Check rate limit for IP address
 */
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // New window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true };
}

/**
 * Generate cache key from request parameters
 */
function getCacheKey(params: ProxyRequest): string {
  const parts = [
    params.endpoint,
    params.strainId || '',
    params.page || 0,
    params.pageSize || 20,
    params.cursor || '',
    params.searchQuery || '',
    params.sortBy || '',
    params.sortDirection || '',
  ];

  if (params.filters) {
    parts.push(JSON.stringify(params.filters));
  }

  return parts.join('|');
}

/**
 * Get cached response if available and not expired
 */
function getCachedResponse(
  cacheKey: string,
  clientETag?: string
): { data?: any; etag?: string; notModified?: boolean } {
  const entry = cacheMap.get(cacheKey);

  if (!entry) {
    return {};
  }

  const now = Date.now();
  if (now > entry.expiresAt) {
    // Expired, remove from cache
    cacheMap.delete(cacheKey);
    return {};
  }

  // Check if client has matching ETag
  if (clientETag && clientETag === entry.etag) {
    return { notModified: true, etag: entry.etag };
  }

  return { data: entry.data, etag: entry.etag };
}

/**
 * Store response in cache
 */
function setCachedResponse(cacheKey: string, data: any, ttlMs: number): string {
  const now = Date.now();
  const etag = `"${crypto.randomUUID()}"`;

  cacheMap.set(cacheKey, {
    data,
    etag,
    cachedAt: now,
    expiresAt: now + ttlMs,
  });

  // Limit cache size to prevent memory issues
  if (cacheMap.size > 100) {
    const firstKey = cacheMap.keys().next().value;
    if (firstKey) {
      cacheMap.delete(firstKey);
    }
  }

  return etag;
}

/**
 * Build The Weed DB API URL based on request parameters
 */
function buildApiUrl(params: ProxyRequest, baseUrl: string): string {
  let path = '';

  if (params.endpoint === 'detail' && params.strainId) {
    // Detail endpoint
    path = `/strains/${encodeURIComponent(params.strainId)}`;
  } else if (params.endpoint === 'list') {
    // List endpoint with optional filters
    if (params.searchQuery) {
      path = `/strains/search/name/${encodeURIComponent(params.searchQuery)}`;
    } else if (params.filters?.race) {
      path = `/strains/search/race/${encodeURIComponent(params.filters.race)}`;
    } else if (params.filters?.effects && params.filters.effects.length > 0) {
      path = `/strains/search/effect/${encodeURIComponent(params.filters.effects[0])}`;
    } else if (params.filters?.flavors && params.filters.flavors.length > 0) {
      path = `/strains/search/flavor/${encodeURIComponent(params.filters.flavors[0])}`;
    } else {
      path = '/strains';
    }
  } else {
    throw new Error('Invalid endpoint or missing parameters');
  }

  const url = new URL(path, baseUrl);

  // Add pagination parameters
  if (params.cursor) {
    url.searchParams.set('cursor', params.cursor);
  } else if (params.page !== undefined) {
    url.searchParams.set('page', String(params.page));
  }

  if (params.pageSize) {
    url.searchParams.set('limit', String(params.pageSize));
  }

  // Add sort parameters
  if (params.sortBy) {
    url.searchParams.set('sort_by', params.sortBy);
    url.searchParams.set('sort_direction', params.sortDirection || 'asc');
  }

  return url.toString();
}

/**
 * Normalize API response to consistent format
 */
function normalizeApiResponse(
  data: any,
  endpoint: string,
  pageSize: number
): ProxyResponse {
  if (endpoint === 'detail') {
    // Detail endpoint
    const strain = data.strain || data.data || data;
    return { strain };
  }

  // List endpoint
  let strains: any[] = [];
  let hasMore = false;
  let nextCursor: string | undefined;

  if (Array.isArray(data.strains)) {
    strains = data.strains;
    hasMore = data.hasMore ?? strains.length === pageSize;
    nextCursor = data.nextCursor;
  } else if (Array.isArray(data.data)) {
    strains = data.data;
    hasMore = Boolean(data.next);
    if (data.next) {
      try {
        const nextUrl = new URL(data.next);
        nextCursor = nextUrl.searchParams.get('cursor') || undefined;
      } catch {
        // Invalid URL, ignore
      }
    }
  } else if (Array.isArray(data)) {
    strains = data;
    hasMore = strains.length === pageSize;
  }

  return { strains, hasMore, nextCursor };
}

/**
 * Fetch data from The Weed DB API
 */
async function fetchFromApi(
  params: ProxyRequest,
  apiKey: string,
  apiHost: string
): Promise<any> {
  const baseUrl =
    Deno.env.get('STRAINS_API_BASE_URL') ||
    'https://the-weed-db.p.rapidapi.com';
  const url = buildApiUrl(params, baseUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  // Add API key headers if using RapidAPI
  if (apiHost.includes('rapidapi')) {
    headers['x-rapidapi-key'] = apiKey;
    headers['x-rapidapi-host'] = apiHost;
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Main request handler
 */
/* eslint-disable max-lines-per-function */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    // Get client IP for rate limiting
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Check rate limit
    const rateLimitResult = checkRateLimit(clientIp);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            ...corsHeaders,
          },
        }
      );
    }

    // Parse request parameters
    let params: ProxyRequest;
    if (req.method === 'POST') {
      params = await req.json();
    } else {
      // GET request - parse from URL
      const url = new URL(req.url);
      params = {
        endpoint: (url.searchParams.get('endpoint') as any) || 'list',
        strainId: url.searchParams.get('strainId') || undefined,
        page: url.searchParams.get('page')
          ? Number(url.searchParams.get('page'))
          : undefined,
        pageSize: url.searchParams.get('pageSize')
          ? Number(url.searchParams.get('pageSize'))
          : 20,
        cursor: url.searchParams.get('cursor') || undefined,
        searchQuery: url.searchParams.get('search') || undefined,
        sortBy: url.searchParams.get('sort_by') || undefined,
        sortDirection: (url.searchParams.get('sort_direction') as any) || 'asc',
      };

      // Parse filters from query params
      const filters: any = {};
      if (url.searchParams.get('type')) {
        filters.race = url.searchParams.get('type');
      }
      if (url.searchParams.get('effects')) {
        filters.effects = url.searchParams.get('effects')?.split(',');
      }
      if (url.searchParams.get('flavors')) {
        filters.flavors = url.searchParams.get('flavors')?.split(',');
      }
      if (url.searchParams.get('difficulty')) {
        filters.difficulty = url.searchParams.get('difficulty');
      }
      if (url.searchParams.get('thc_min')) {
        filters.thcMin = Number(url.searchParams.get('thc_min'));
      }
      if (url.searchParams.get('thc_max')) {
        filters.thcMax = Number(url.searchParams.get('thc_max'));
      }
      if (url.searchParams.get('cbd_min')) {
        filters.cbdMin = Number(url.searchParams.get('cbd_min'));
      }
      if (url.searchParams.get('cbd_max')) {
        filters.cbdMax = Number(url.searchParams.get('cbd_max'));
      }

      if (Object.keys(filters).length > 0) {
        params.filters = filters;
      }
    }

    // Validate required parameters
    if (!params.endpoint) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: endpoint' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (params.endpoint === 'detail' && !params.strainId) {
      return new Response(
        JSON.stringify({
          error: 'Missing required parameter: strainId for detail endpoint',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Check cache
    const cacheKey = getCacheKey(params);
    const clientETag = req.headers.get('if-none-match');
    const cached = getCachedResponse(cacheKey, clientETag);

    if (cached.notModified) {
      return new Response(null, {
        status: 304,
        headers: {
          ETag: cached.etag!,
          'Cache-Control': 'max-age=300',
          ...corsHeaders,
        },
      });
    }

    if (cached.data) {
      return new Response(JSON.stringify({ ...cached.data, cached: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ETag: cached.etag!,
          'Cache-Control': 'max-age=300',
          ...corsHeaders,
        },
      });
    }

    // Get API credentials from environment
    const apiKey = Deno.env.get('STRAINS_API_KEY');
    const apiHost =
      Deno.env.get('STRAINS_API_HOST') || 'the-weed-db.p.rapidapi.com';

    if (!apiKey) {
      throw new Error('STRAINS_API_KEY not configured');
    }

    // Fetch from API
    const apiData = await fetchFromApi(params, apiKey, apiHost);

    // Normalize response
    const normalized = normalizeApiResponse(
      apiData,
      params.endpoint,
      params.pageSize || 20
    );

    // Cache the response
    const ttl =
      params.endpoint === 'detail' ? CACHE_TTL_DETAIL_MS : CACHE_TTL_MS;
    const etag = setCachedResponse(cacheKey, normalized, ttl);

    // Return response with caching headers
    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ETag: etag,
        'Cache-Control': `max-age=${Math.floor(ttl / 1000)}`,
        ...corsHeaders,
      },
    });
  } catch (error) {
    console.error('Strains proxy error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
