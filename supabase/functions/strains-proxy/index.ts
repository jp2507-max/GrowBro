// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'jsr:@supabase/supabase-js@2';

import type {
  CacheEntry,
  ProxyRequest,
  ProxyResponse,
  RateLimitEntry,
} from './types.ts';

// Supabase client for strain_cache operations
// Lazily initialize Supabase client so missing env vars don't crash at module load.
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (supabase) return supabase;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    // Log a clear message — features that depend on Supabase will be disabled.
    console.error(
      'Supabase not configured: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. Supabase cache operations will be disabled.'
    );
    return null;
  }

  supabase = createClient(supabaseUrl, supabaseServiceKey);
  return supabase;
}

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
 * Check Supabase strain_cache for a cached strain
 * Searches by id or slug (handles both _id format from API and slugified names)
 * Returns the cached strain data if found, null otherwise
 */
/**
 * Generate a URL-safe slug from a string
 */
// slugify moved above to be available before getStrainFromSupabaseCache

async function getStrainFromSupabaseCache(
  strainId: string
): Promise<any | null> {
  try {
    const client = getSupabaseClient();
    if (!client) return null;
    // First try exact match on id
    const { data: idData, error: idError } = await client
      .from('strain_cache')
      .select('data')
      .eq('id', strainId)
      .maybeSingle();

    if (!idError && idData) {
      return idData.data;
    }

    // Then try exact match on slug
    const { data: slugData, error: slugError } = await client
      .from('strain_cache')
      .select('data')
      .eq('slug', strainId)
      .maybeSingle();

    if (!slugError && slugData) {
      return slugData.data;
    }

    // If not found, try slugified version (use shared slugify helper)
    const slugified = slugify(strainId);

    // Only try slugified if it's different from the original
    if (slugified !== strainId) {
      const { data: slugifiedData, error: slugifiedError } = await client
        .from('strain_cache')
        .select('data')
        .eq('slug', slugified)
        .maybeSingle();

      if (!slugifiedError && slugifiedData) {
        return slugifiedData.data;
      }
    }

    return null;
  } catch (err) {
    console.error('Error checking strain cache:', err);
    return null;
  }
}

/**
 * Generate a URL-safe slug from a string
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Extract race from genetics string like "Indica (90-100%)" or "Sativa-dominant"
 */
function extractRace(
  genetics: string | undefined
): 'indica' | 'sativa' | 'hybrid' | null {
  if (!genetics || typeof genetics !== 'string') return null;
  const lower = genetics.toLowerCase();
  if (lower.includes('indica')) return 'indica';
  if (lower.includes('sativa')) return 'sativa';
  if (lower.includes('hybrid')) return 'hybrid';
  return null;
}

/**
 * Save strain to Supabase strain_cache
 * Handles raw API format with _id, genetics string, etc.
 */
async function saveStrainToSupabaseCache(strain: any): Promise<void> {
  try {
    const client = getSupabaseClient();
    if (!client) {
      // Supabase not configured — skip caching but do not fail the request.
      console.warn(
        'Skipping Supabase cache save: Supabase client not configured'
      );
      return;
    }
    // Extract ID - API uses _id, fallback to id or generate one
    const id =
      strain._id ||
      strain.id ||
      `strain_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Generate slug from name if not present
    const slug = strain.slug || (strain.name ? slugify(strain.name) : id);

    // Extract race from genetics string
    const race = strain.race || extractRace(strain.genetics);

    const { error } = await client.from('strain_cache').upsert(
      {
        id: String(id),
        slug: String(slug),
        name: String(strain.name || 'Unknown'),
        race: race,
        data: strain,
      },
      {
        onConflict: 'id',
      }
    );

    if (error) {
      console.error('Error saving strain to cache:', error);
    }
  } catch (err) {
    console.error('Error saving strain to cache:', err);
  }
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
    // List endpoint - always use /strains and pass filters as query parameters
    path = '/strains';
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

  // Add search query - API uses 'name' parameter for name-based search
  if (params.searchQuery && params.searchQuery.trim()) {
    url.searchParams.set('name', params.searchQuery.trim());
  }

  // Add sort parameters
  if (params.sortBy) {
    url.searchParams.set('sort_by', params.sortBy);
    url.searchParams.set('sort_direction', params.sortDirection || 'asc');
  }

  // Add filter parameters
  if (params.filters) {
    if (params.filters.race) {
      url.searchParams.set('type', params.filters.race);
    }
    if (params.filters.effects && params.filters.effects.length > 0) {
      url.searchParams.set('effects', params.filters.effects.join(','));
    }
    if (params.filters.flavors && params.filters.flavors.length > 0) {
      url.searchParams.set('flavors', params.filters.flavors.join(','));
    }
    if (params.filters.difficulty) {
      url.searchParams.set('difficulty', params.filters.difficulty);
    }
    if (params.filters.thcMin !== undefined) {
      url.searchParams.set('thc_min', String(params.filters.thcMin));
    }
    if (params.filters.thcMax !== undefined) {
      url.searchParams.set('thc_max', String(params.filters.thcMax));
    }
    if (params.filters.cbdMin !== undefined) {
      url.searchParams.set('cbd_min', String(params.filters.cbdMin));
    }
    if (params.filters.cbdMax !== undefined) {
      url.searchParams.set('cbd_max', String(params.filters.cbdMax));
    }
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
    signal: AbortSignal.timeout(10_000), // 10 second timeout
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(
      `API request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
    // Attach status code and retry-after header to the error
    (error as any).status = response.status;
    (error as any).retryAfter = response.headers.get('retry-after');
    throw error;
  }

  return await response.json();
}

/**
 * Main request handler
 */

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
      const pageVal = Number(url.searchParams.get('page'));
      const pageSizeVal = Number(url.searchParams.get('pageSize'));
      params = {
        endpoint: (url.searchParams.get('endpoint') as any) || 'list',
        strainId: url.searchParams.get('strainId') || undefined,
        page: !Number.isNaN(pageVal) ? pageVal : undefined,
        pageSize: !Number.isNaN(pageSizeVal) ? pageSizeVal : 20,
        cursor: url.searchParams.get('cursor') || undefined,
        searchQuery:
          url.searchParams.get('name') ||
          url.searchParams.get('search') ||
          undefined,
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
        const val = Number(url.searchParams.get('thc_min'));
        if (!Number.isNaN(val)) filters.thcMin = val;
      }
      if (url.searchParams.get('thc_max')) {
        const val = Number(url.searchParams.get('thc_max'));
        if (!Number.isNaN(val)) filters.thcMax = val;
      }
      if (url.searchParams.get('cbd_min')) {
        const val = Number(url.searchParams.get('cbd_min'));
        if (!Number.isNaN(val)) filters.cbdMin = val;
      }
      if (url.searchParams.get('cbd_max')) {
        const val = Number(url.searchParams.get('cbd_max'));
        if (!Number.isNaN(val)) filters.cbdMax = val;
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

    // Check in-memory cache first
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

    // For detail endpoint, check Supabase strain_cache (permanent cache)
    if (params.endpoint === 'detail' && params.strainId) {
      const cachedStrain = await getStrainFromSupabaseCache(params.strainId);
      if (cachedStrain) {
        const response: ProxyResponse = { strain: cachedStrain };
        // Also store in memory cache for this session
        const ttl = CACHE_TTL_DETAIL_MS;
        const etag = setCachedResponse(cacheKey, response, ttl);

        return new Response(
          JSON.stringify({ ...response, cached: true, source: 'supabase' }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ETag: etag,
              'Cache-Control': `max-age=${Math.floor(ttl / 1000)}`,
              ...corsHeaders,
            },
          }
        );
      }
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

    // For detail endpoint, save to Supabase strain_cache (permanent cache)
    // This runs in background and doesn't block the response
    if (params.endpoint === 'detail' && normalized.strain) {
      // Don't await - let it run in background
      saveStrainToSupabaseCache(normalized.strain).catch((err) => {
        console.error('Background cache save failed:', err);
      });
    }

    // Cache the response in memory
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

    // Check if this is an API error with status code
    const status = (error as any).status || 500;
    const retryAfter = (error as any).retryAfter;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...corsHeaders,
    };

    // Add Retry-After header if present (for 429 responses)
    if (retryAfter) {
      headers['Retry-After'] = retryAfter;
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      status,
      headers,
    });
  }
});
