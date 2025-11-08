import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { processImageVariants } from './_shared/image-processing.ts';
import { withRateLimit } from './_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Idempotency-Key, X-Client-Tx-Id',
};

const COMMUNITY_MEDIA_BUCKET = 'community-posts';

// Fetch configuration constants
const MAX_BYTES = 50 * 1024 * 1024; // 50MB limit
const FETCH_TIMEOUT_MS = 30000; // 30 seconds timeout

interface CreatePostRequest {
  body: string;
  media_uri?: string;
  client_tx_id?: string;
  media?: {
    // Server-side processing (web/legacy)
    source_url?: string;
    filename?: string;
    mime_type?: string;
    // Mobile pre-uploaded variants
    originalPath?: string;
    resizedPath?: string;
    thumbnailPath?: string;
    width?: number;
    height?: number;
    aspectRatio?: number;
    bytes?: number;
    blurhash?: string;
    thumbhash?: string;
  };
}

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
    // Get authorization header
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

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit: 5 posts per hour
    const rateLimitResponse = await withRateLimit(
      supabaseClient,
      user.id,
      {
        endpoint: 'posts',
        limit: 5,
        windowSeconds: 3600,
      },
      corsHeaders
    );

    if (rateLimitResponse) {
      console.log(
        `[create-post] Rate limit exceeded for user ${user.id.slice(0, 8)}...`
      );
      return rateLimitResponse;
    }

    // Parse request body
    const requestBody: CreatePostRequest = await req.json();

    // Validate post body
    if (!requestBody.body || requestBody.body.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Post body cannot be empty' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (requestBody.body.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Post body cannot exceed 2000 characters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let mediaProcessingResult = null;

    // Check if mobile client already uploaded variants
    const hasMobileVariants =
      requestBody.media?.originalPath &&
      requestBody.media?.resizedPath &&
      requestBody.media?.thumbnailPath;

    if (hasMobileVariants) {
      // Mobile client pre-uploaded variants, use them directly
      mediaProcessingResult = {
        originalPath: requestBody.media!.originalPath!,
        resizedPath: requestBody.media!.resizedPath!,
        thumbnailPath: requestBody.media!.thumbnailPath!,
        width: requestBody.media!.width ?? 0,
        height: requestBody.media!.height ?? 0,
        aspectRatio: requestBody.media!.aspectRatio ?? 1,
        bytes: requestBody.media!.bytes ?? 0,
        blurhash: requestBody.media!.blurhash,
        thumbhash: requestBody.media!.thumbhash,
      };
    } else {
      // Server-side processing for web/legacy clients
      try {
        mediaProcessingResult = await handleOptionalMediaUpload(
          supabaseClient,
          user.id,
          requestBody.media
        );
      } catch (mediaError) {
        const status =
          typeof mediaError?.status === 'number' ? mediaError.status : 500;
        return new Response(
          JSON.stringify({
            error:
              status === 400
                ? 'Invalid media payload'
                : 'Failed to process media',
            message:
              mediaError instanceof Error
                ? mediaError.message
                : String(mediaError),
          }),
          {
            status,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      body: requestBody.body,
      client_tx_id: requestBody.client_tx_id,
    };

    if (mediaProcessingResult) {
      insertPayload.media_uri = mediaProcessingResult.originalPath;
      insertPayload.media_resized_uri = mediaProcessingResult.resizedPath;
      insertPayload.media_thumbnail_uri = mediaProcessingResult.thumbnailPath;
      insertPayload.media_blurhash = mediaProcessingResult.blurhash;
      insertPayload.media_thumbhash = mediaProcessingResult.thumbhash;
      insertPayload.media_width = mediaProcessingResult.width;
      insertPayload.media_height = mediaProcessingResult.height;
      insertPayload.media_aspect_ratio = mediaProcessingResult.aspectRatio;
      insertPayload.media_bytes = mediaProcessingResult.bytes;
    } else if (requestBody.media_uri) {
      insertPayload.media_uri = requestBody.media_uri;
    }

    // Create post
    const { data: post, error: insertError } = await supabaseClient
      .from('posts')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[create-post] Insert error:', insertError);
      return new Response(
        JSON.stringify({
          error: `Failed to create post: ${insertError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Return created post with initial counts
    const response = {
      ...post,
      userId: post.user_id,
      like_count: 0,
      comment_count: 0,
      user_has_liked: false,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[create-post] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleOptionalMediaUpload(
  supabaseClient: SupabaseClient,
  userId: string,
  media: CreatePostRequest['media']
) {
  if (!media || !media.source_url) {
    return null;
  }

  if (
    typeof media.source_url !== 'string' ||
    media.source_url.trim().length === 0
  ) {
    throw createHttpError(
      400,
      'Invalid media payload: media.source_url must be a non-empty string.'
    );
  }

  // Validate URL to prevent SSRF attacks
  try {
    const url = new URL(media.source_url);

    // Only allow HTTPS
    if (url.protocol !== 'https:') {
      throw createHttpError(
        400,
        'Only HTTPS URLs are allowed for media sources.'
      );
    }

    // Block private/internal IP ranges
    const hostname = url.hostname.toLowerCase();

    // Try to resolve the hostname to IP addresses using a trusted DNS-over-HTTPS
    // resolver (fallbacks if the resolver fails). We validate the resolved IPs
    // to ensure they are not in private or link-local ranges. This defends
    // against DNS rebinding where the hostname string looks public but resolves
    // to internal addresses (e.g., 127.0.0.1, cloud metadata service).
    try {
      let resolvedIps: string[] = [];
      try {
        resolvedIps = await resolveHostnameToIps(hostname);
      } catch (dnsErr) {
        // If DNS resolution fails for some reason, we don't want to silently
        // allow a potential SSRF. Log and continue to the hostname checks
        // below as a conservative fallback.
        console.warn('[create-post] DNS resolution failed:', dnsErr);
        resolvedIps = [];
      }

      for (const ip of resolvedIps) {
        if (isIpPrivate(ip)) {
          throw createHttpError(
            400,
            'Cannot fetch from private IP addresses or local domains.'
          );
        }
      }
    } catch (err) {
      if (err?.status === 400) throw err;
      // Any unexpected error in the DNS check should result in a 400 to be
      // conservative about reaching internal hosts.
      throw createHttpError(400, 'Invalid media source URL format.');
    }

    // Additional hostname string checks (kept for extra defense-in-depth)
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('172.16.') ||
      hostname.startsWith('172.17.') ||
      hostname.startsWith('172.18.') ||
      hostname.startsWith('172.19.') ||
      hostname.startsWith('172.20.') ||
      hostname.startsWith('172.21.') ||
      hostname.startsWith('172.22.') ||
      hostname.startsWith('172.23.') ||
      hostname.startsWith('172.24.') ||
      hostname.startsWith('172.25.') ||
      hostname.startsWith('172.26.') ||
      hostname.startsWith('172.27.') ||
      hostname.startsWith('172.28.') ||
      hostname.startsWith('172.29.') ||
      hostname.startsWith('172.30.') ||
      hostname.startsWith('172.31.') ||
      hostname === '::1' ||
      hostname === '0.0.0.0' ||
      hostname === '[::]' ||
      hostname.includes('local')
    ) {
      throw createHttpError(
        400,
        'Cannot fetch from private IP addresses or local domains.'
      );
    }
  } catch (error) {
    if (error?.status === 400) {
      throw error;
    }
    throw createHttpError(400, 'Invalid media source URL format.');
  }

  try {
    return await processAndUploadMedia({
      supabaseClient,
      userId,
      sourceUrl: media.source_url,
    });
  } catch (error) {
    console.error('[create-post] Failed to process media:', error);
    throw createHttpError(500, 'Failed to process media uploads.');
  }
}

async function processAndUploadMedia({
  supabaseClient,
  userId,
  sourceUrl,
}: {
  supabaseClient: SupabaseClient;
  userId: string;
  sourceUrl: string;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(sourceUrl, {
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    controller.abort();
    if (error.name === 'AbortError') {
      throw createHttpError(
        408,
        'Request timeout while fetching media source.'
      );
    }
    throw createHttpError(
      500,
      `Failed to fetch media source: ${error.message}`
    );
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    controller.abort();
    throw createHttpError(
      response.status,
      `Failed to fetch media source. Status: ${response.status}`
    );
  }

  // Check content-length header if present
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BYTES) {
    controller.abort();
    throw createHttpError(
      413,
      `Media source too large: ${contentLength} bytes exceeds limit of ${MAX_BYTES} bytes.`
    );
  }

  let inputBytes: Uint8Array;

  try {
    if (contentLength) {
      // If content-length is present and within limits, use arrayBuffer
      const arrayBuffer = await response.arrayBuffer();
      inputBytes = new Uint8Array(arrayBuffer);
    } else {
      // Stream and accumulate with size limit
      const reader = response.body?.getReader();
      if (!reader) {
        controller.abort();
        throw createHttpError(500, 'Unable to read response body.');
      }

      const chunks: Uint8Array[] = [];
      let totalSize = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          totalSize += value.length;
          if (totalSize > MAX_BYTES) {
            controller.abort();
            reader.cancel();
            throw createHttpError(
              413,
              `Media source too large: exceeded limit of ${MAX_BYTES} bytes while streaming.`
            );
          }

          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      // Concatenate all chunks
      inputBytes = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        inputBytes.set(chunk, offset);
        offset += chunk.length;
      }
    }
  } catch (error) {
    controller.abort();
    if (error?.status) {
      throw error; // Re-throw HTTP errors we created
    }
    throw createHttpError(
      500,
      `Failed to process media response: ${error.message}`
    );
  }

  const processed = await processImageVariants(inputBytes);
  const hash = await hashBytes(processed.original.data);
  const basePath = buildBasePath(userId, hash);
  const contentType = 'image/jpeg';

  const uploadedPaths: string[] = [];

  try {
    const original = await uploadVariant({
      supabaseClient,
      variant: 'original',
      bucket: COMMUNITY_MEDIA_BUCKET,
      basePath,
      data: processed.original.data,
      contentType,
      uploadedPaths,
    });

    const resized = await uploadVariant({
      supabaseClient,
      variant: 'resized',
      bucket: COMMUNITY_MEDIA_BUCKET,
      basePath,
      data: processed.resized.data,
      contentType,
      uploadedPaths,
    });

    const thumbnail = await uploadVariant({
      supabaseClient,
      variant: 'thumbnail',
      bucket: COMMUNITY_MEDIA_BUCKET,
      basePath,
      data: processed.thumbnail.data,
      contentType,
      uploadedPaths,
    });

    return {
      originalPath: original.storedPath,
      resizedPath: resized.storedPath,
      thumbnailPath: thumbnail.storedPath,
      blurhash: processed.blurhash,
      thumbhash: processed.thumbhash,
      width: processed.metadata.width,
      height: processed.metadata.height,
      aspectRatio: processed.metadata.aspectRatio,
      bytes: processed.metadata.bytes,
      hash,
    };
  } catch (error) {
    if (uploadedPaths.length > 0) {
      try {
        await supabaseClient.storage
          .from(COMMUNITY_MEDIA_BUCKET)
          .remove(uploadedPaths);
      } catch (cleanupError) {
        console.error(
          '[create-post] Failed to cleanup uploaded media:',
          cleanupError
        );
      }
    }

    throw error;
  }
}

async function uploadVariant({
  supabaseClient,
  variant,
  bucket,
  basePath,
  data,
  contentType,
  uploadedPaths,
}: {
  supabaseClient: any;
  variant: string;
  bucket: string;
  basePath: string;
  data: Uint8Array;
  contentType: string;
  uploadedPaths: string[];
}) {
  const filename = `${variant}.jpg`;
  const path = `${basePath}/${filename}`;
  const blob = new Blob([data], { type: contentType });

  const { data: uploadData, error } = await supabaseClient.storage
    .from(bucket)
    .upload(path, blob, { contentType, upsert: false });

  if (
    error &&
    error.statusCode !== 409 &&
    error.message !== 'The resource already exists'
  ) {
    throw new Error(`Failed to upload ${variant} variant: ${error.message}`);
  }

  if (!error && uploadData?.path) {
    uploadedPaths.push(uploadData.path);
  }

  const storedPath = `${bucket}/${path}`;

  return {
    storedPath,
  };
}

function buildBasePath(userId: string, hash: string): string {
  const safeUserId = sanitizePathSegment(userId) || 'user';
  const safeHash = sanitizePathSegment(hash) || 'media';
  return `${safeUserId}/${safeHash}`;
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '');
}

async function hashBytes(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createHttpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

// Resolve a hostname to A and AAAA records using a trusted DNS-over-HTTPS
// resolver (Google DNS). Returns an array of IP strings. This gives us the
// ability to validate the actual IPs the hostname resolves to (defending
// against DNS rebinding attacks).
async function resolveHostnameToIps(hostname: string): Promise<string[]> {
  const records: string[] = [];

  // Query A records
  try {
    const aResp = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`
    );
    if (aResp.ok) {
      const aJson = await aResp.json();
      if (Array.isArray(aJson.Answer)) {
        for (const ans of aJson.Answer) {
          if (ans && ans.data) records.push(String(ans.data));
        }
      }
    }
  } catch (e) {
    // propagate to caller to decide fallback behavior
    throw e;
  }

  // Query AAAA records
  try {
    const aaaaResp = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=AAAA`
    );
    if (aaaaResp.ok) {
      const aaaaJson = await aaaaResp.json();
      if (Array.isArray(aaaaJson.Answer)) {
        for (const ans of aaaaJson.Answer) {
          if (ans && ans.data) records.push(String(ans.data).toLowerCase());
        }
      }
    }
  } catch (e) {
    throw e;
  }

  return records;
}

// Return true if the provided IP (IPv4 or IPv6) is in a private/loopback/link-local
// or otherwise reserved range that should not be fetched from.
function isIpPrivate(ip: string): boolean {
  if (!ip) return false;

  const lower = ip.toLowerCase();

  // Handle IPv4 mapped in IPv6 like ::ffff:127.0.0.1
  const lastColon = lower.lastIndexOf(':');
  if (lastColon !== -1 && lower.includes('.')) {
    const potentialIpv4 = lower.slice(lastColon + 1);
    if (potentialIpv4.split('.').length === 4) {
      return isIpv4Private(potentialIpv4);
    }
  }

  // If it contains dots, treat as IPv4
  if (lower.includes('.')) return isIpv4Private(lower);

  // IPv6 checks
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
  if (lower === '::' || lower === '0:0:0:0:0:0:0:0') return true;
  // Unique local addresses (fc00::/7 -> fc00 or fd00)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  // Link-local fe80::/10
  if (lower.startsWith('fe80')) return true;

  return false;
}

function isIpv4Private(ipv4: string): boolean {
  const parts = ipv4.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;

  // 0.0.0.0/8 unspecified
  if (a === 0) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 127.0.0.0/8 loopback
  if (a === 127) return true;
  // 169.254.0.0/16 link-local
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // Carrier-grade NAT 100.64.0.0/10
  if (a === 100 && b >= 64 && b <= 127) return true;

  return false;
}
