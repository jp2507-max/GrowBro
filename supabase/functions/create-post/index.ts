// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

import { processImageVariants } from '../_shared/image-processing.ts';
import { withRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Idempotency-Key, X-Client-Tx-Id',
};

const COMMUNITY_MEDIA_BUCKET = 'community-posts';

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
  supabaseClient: any,
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
  supabaseClient: any;
  userId: string;
  sourceUrl: string;
}) {
  const response = await fetch(sourceUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch media source. Status: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const inputBytes = new Uint8Array(arrayBuffer);

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
