import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const COMMUNITY_MEDIA_BUCKET = 'community-posts';
const SIGNED_URL_EXPIRY = 604800; // 7 days in seconds (maximum allowed)

interface MediaUrlRequest {
  paths: string[]; // Array of storage paths to generate signed URLs for
}

interface MediaUrlResponse {
  urls: Record<string, string>; // Map of path -> signed URL
}

/**
 * Edge Function to generate signed URLs for community post media
 *
 * Security model:
 * - Uses service-role key to bypass RLS restrictions on storage.objects
 * - Only authenticated users can call this function
 * - Does NOT validate post ownership (assumes caller has already verified visibility via posts table RLS)
 * - Media paths are validated to prevent directory traversal
 *
 * This function exists because:
 * - RLS on community-posts bucket restricts users to only their own folders
 * - Feed needs to display media from all users whose posts are visible
 * - Posts table RLS already enforces visibility rules (public/hidden/deleted)
 * - Signed URLs are time-limited (7 days) and require knowing the exact path
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify user authentication with anon key client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const requestBody: MediaUrlRequest = await req.json();

    if (!Array.isArray(requestBody.paths) || requestBody.paths.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: paths array required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate and sanitize paths
    const validatedPaths: string[] = [];
    for (const path of requestBody.paths) {
      if (typeof path !== 'string' || !path.trim()) {
        continue; // Skip invalid paths
      }

      const cleanPath = path.trim();

      // Remove bucket prefix if present
      const bucketPrefix = `${COMMUNITY_MEDIA_BUCKET}/`;
      const sanitizedPath = cleanPath.startsWith(bucketPrefix)
        ? cleanPath.slice(bucketPrefix.length)
        : cleanPath;

      // Validate path format: userId/contentHash/variant.jpg
      // Prevents directory traversal and ensures valid structure
      const pathSegments = sanitizedPath.split('/');
      if (
        pathSegments.length !== 3 ||
        pathSegments.some((seg) => !seg || seg.includes('..'))
      ) {
        console.warn(
          `[get-media-urls] Invalid path format rejected: ${sanitizedPath}`
        );
        continue; // Skip invalid paths
      }

      validatedPaths.push(sanitizedPath);
    }

    if (validatedPaths.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid paths provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create service-role client to generate signed URLs (bypasses RLS)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Generate signed URLs for all paths in parallel
    const urlResults = await Promise.allSettled(
      validatedPaths.map(async (path) => {
        const { data, error } = await serviceClient.storage
          .from(COMMUNITY_MEDIA_BUCKET)
          .createSignedUrl(path, SIGNED_URL_EXPIRY);

        if (error) {
          console.error(
            `[get-media-urls] Failed to generate signed URL for ${path}:`,
            error
          );
          // Return original path as fallback
          return { path, url: path };
        }

        return { path, url: data.signedUrl };
      })
    );

    // Build response map
    const urls: Record<string, string> = {};
    urlResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const originalPath = requestBody.paths[index];
        urls[originalPath] = result.value.url;
      }
    });

    const response: MediaUrlResponse = { urls };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[get-media-urls] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
