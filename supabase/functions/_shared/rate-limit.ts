/**
 * Rate Limiting Middleware for Supabase Edge Functions
 *
 * Provides per-user rate limiting with configurable thresholds and time windows.
 * Uses database-backed counters with atomic increments for concurrency safety.
 *
 * @module rate-limit
 */

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export interface RateLimitConfig {
  /** Unique identifier for the endpoint (e.g., 'assessments', 'tasks', 'posts') */
  endpoint: string;
  /** Maximum number of requests allowed in the time window */
  limit: number;
  /** Time window in seconds (default: 3600 for 1 hour) */
  windowSeconds?: number;
  /** Number to increment counter by (default: 1, use batch size for batch operations) */
  increment?: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current count in the window */
  current: number;
  /** Maximum allowed in the window */
  limit: number;
  /** Seconds until the rate limit resets (0 if allowed) */
  retryAfter: number;
}

/**
 * Check and increment rate limit for a user
 *
 * @param client - Authenticated Supabase client with user context
 * @param userId - User ID to rate limit
 * @param config - Rate limit configuration
 * @returns Rate limit result with allowed status and retry-after
 */
export async function checkRateLimit(
  client: SupabaseClient,
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const {
    endpoint,
    limit,
    windowSeconds = 3600, // Default to 1 hour
    increment = 1,
  } = config;

  try {
    // Call the database function for atomic increment and check
    const { data, error } = await client.rpc('increment_rate_limit', {
      p_user_id: userId,
      p_endpoint: endpoint,
      p_limit: limit,
      p_window_seconds: windowSeconds,
      p_increment: increment,
    });

    if (error) {
      console.error('[rate-limit] Database error:', error);
      // Fail open: allow request if rate limit check fails
      return {
        allowed: true,
        current: 0,
        limit,
        retryAfter: 0,
      };
    }

    return data as RateLimitResult;
  } catch (err) {
    console.error('[rate-limit] Unexpected error:', err);
    // Fail open: allow request if rate limit check fails
    return {
      allowed: true,
      current: 0,
      limit,
      retryAfter: 0,
    };
  }
}

/**
 * Create a 429 Too Many Requests response with Retry-After header
 *
 * @param result - Rate limit result from checkRateLimit
 * @param corsHeaders - CORS headers to include in response
 * @returns Response object with 429 status and Retry-After header
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string> = {}
): Response {
  const retryAfter = Math.max(result.retryAfter, 1); // Minimum 1 second

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests. Limit: ${result.limit} per hour. Current: ${result.current}. Try again in ${retryAfter} seconds.`,
      limit: result.limit,
      current: result.current,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': Math.max(
          0,
          result.limit - result.current
        ).toString(),
        'X-RateLimit-Reset': new Date(
          Date.now() + retryAfter * 1000
        ).toISOString(),
        ...corsHeaders,
      },
    }
  );
}

/**
 * Middleware wrapper for rate limiting
 *
 * Usage:
 * ```typescript
 * const result = await withRateLimit(supabaseClient, user.id, {
 *   endpoint: 'assessments',
 *   limit: 10,
 * }, corsHeaders);
 *
 * if (result instanceof Response) {
 *   return result; // Rate limit exceeded
 * }
 * // Continue with request handling
 * ```
 *
 * @param client - Authenticated Supabase client
 * @param userId - User ID to rate limit
 * @param config - Rate limit configuration
 * @param corsHeaders - CORS headers for error response
 * @returns null if allowed, Response if rate limited
 */
export async function withRateLimit(
  client: SupabaseClient,
  userId: string,
  config: RateLimitConfig,
  corsHeaders: Record<string, string> = {}
): Promise<Response | null> {
  const result = await checkRateLimit(client, userId, config);

  if (!result.allowed) {
    return createRateLimitResponse(result, corsHeaders);
  }

  return null;
}
