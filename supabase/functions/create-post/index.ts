import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  MagickGeometry,
  type MagickImage,
} from 'npm:@imagemagick/magick-wasm@0.0.30';
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { encode as encodeBlurhash } from 'npm:blurhash@2.0.5';
import { rgbaToThumbHash } from 'npm:thumbhash@0.1.1';

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
  title?: string;
  sourceAssessmentId?: string;
  media?:
    | {
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
      }
    | {
        // Mobile pre-uploaded variants (array format for multiple attachments)
        originalPath?: string;
        resizedPath?: string;
        thumbnailPath?: string;
        width?: number;
        height?: number;
        aspectRatio?: number;
        bytes?: number;
        blurhash?: string;
        thumbhash?: string;
      }[];
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
    // Handle both single media object and media array formats
    let mediaItem = null;

    if (Array.isArray(requestBody.media)) {
      // Mobile client sent array - use first item for now (maintains single media compatibility)
      mediaItem = requestBody.media.length > 0 ? requestBody.media[0] : null;
    } else {
      // Legacy single media object format
      mediaItem = requestBody.media;
    }

    const hasMobileVariants =
      mediaItem?.originalPath &&
      mediaItem?.resizedPath &&
      mediaItem?.thumbnailPath;

    if (hasMobileVariants) {
      // Mobile client pre-uploaded variants, validate metadata before use
      const { width, height, aspectRatio, bytes } = mediaItem!;

      // Validate required dimensions
      if (!width || width <= 0) {
        return new Response(
          JSON.stringify({
            error:
              'Invalid media metadata: width must be present and greater than 0',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!height || height <= 0) {
        return new Response(
          JSON.stringify({
            error:
              'Invalid media metadata: height must be present and greater than 0',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate file size
      if (!bytes || bytes <= 0) {
        return new Response(
          JSON.stringify({
            error:
              'Invalid media metadata: bytes must be present and greater than 0',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Compute aspectRatio if missing, otherwise validate it's reasonable
      let finalAspectRatio = aspectRatio;
      if (aspectRatio === undefined || aspectRatio === null) {
        finalAspectRatio = width / height;
      } else if (aspectRatio <= 0) {
        return new Response(
          JSON.stringify({
            error: 'Invalid media metadata: aspectRatio must be greater than 0',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      mediaProcessingResult = {
        originalPath: mediaItem!.originalPath!,
        resizedPath: mediaItem!.resizedPath!,
        thumbnailPath: mediaItem!.thumbnailPath!,
        width,
        height,
        aspectRatio: finalAspectRatio,
        bytes,
        blurhash: mediaItem!.blurhash,
        thumbhash: mediaItem!.thumbhash,
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
      // Generate signed URLs for media variants to enable client access
      const signedUrls = await generateSignedMediaUrls(supabaseClient, {
        originalPath: mediaProcessingResult.originalPath,
        resizedPath: mediaProcessingResult.resizedPath,
        thumbnailPath: mediaProcessingResult.thumbnailPath,
      });

      insertPayload.media_uri = signedUrls.media_uri;
      insertPayload.media_resized_uri = signedUrls.media_resized_uri;
      insertPayload.media_thumbnail_uri = signedUrls.media_thumbnail_uri;
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

/**
 * Generate signed URLs for community media variants
 * @param supabaseClient - Supabase client
 * @param mediaProcessingResult - Result from media processing with storage paths
 * @returns Object with signed URLs for each variant
 */
async function generateSignedMediaUrls(
  supabaseClient: SupabaseClient,
  mediaProcessingResult: {
    originalPath: string;
    resizedPath: string;
    thumbnailPath: string;
  }
) {
  // Signed URLs expire in 1 year (31536000 seconds) for community media
  const expiresIn = 31536000;

  const [originalUrl, resizedUrl, thumbnailUrl] = await Promise.all([
    supabaseClient.storage
      .from(COMMUNITY_MEDIA_BUCKET)
      .createSignedUrl(mediaProcessingResult.originalPath, expiresIn),
    supabaseClient.storage
      .from(COMMUNITY_MEDIA_BUCKET)
      .createSignedUrl(mediaProcessingResult.resizedPath, expiresIn),
    supabaseClient.storage
      .from(COMMUNITY_MEDIA_BUCKET)
      .createSignedUrl(mediaProcessingResult.thumbnailPath, expiresIn),
  ]);

  if (originalUrl.error || resizedUrl.error || thumbnailUrl.error) {
    throw createHttpError(
      500,
      `Failed to generate signed URLs for media: ${originalUrl.error?.message || resizedUrl.error?.message || thumbnailUrl.error?.message}`
    );
  }

  return {
    media_uri: originalUrl.data.signedUrl,
    media_resized_uri: resizedUrl.data.signedUrl,
    media_thumbnail_uri: thumbnailUrl.data.signedUrl,
  };
}

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
      const resolvedIps = await resolveHostnameToIps(hostname);

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

// Image processing constants and types (inlined from _shared/image-processing.ts)
const RESIZED_LONG_EDGE = 1280;
const RESIZED_QUALITY = 85;
const THUMBNAIL_LONG_EDGE = 200;
const THUMBNAIL_QUALITY = 70;
const HASH_SAMPLE_LONG_EDGE = 64;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;
const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

let magickReadyPromise: Promise<void> | undefined;

type ImageVariant = {
  data: Uint8Array;
  width: number;
  height: number;
  bytes: number;
  contentType: 'image/jpeg';
};

type ProcessedImageMetadata = {
  width: number;
  height: number;
  aspectRatio: number;
  bytes: number;
  gpsStripped: boolean;
};

type ProcessedImage = {
  original: ImageVariant;
  resized: ImageVariant;
  thumbnail: ImageVariant;
  blurhash: string;
  thumbhash: string | null;
  metadata: ProcessedImageMetadata;
};

async function ensureMagickInitialized(): Promise<void> {
  if (!magickReadyPromise) {
    magickReadyPromise = (async () => {
      const wasmUrl = new URL(
        'magick.wasm',
        import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.30')
      );
      const wasmBytes = await Deno.readFile(wasmUrl);
      await initializeImageMagick(wasmBytes);
    })();
  }

  await magickReadyPromise;
}

async function processImageVariants(
  input: Uint8Array
): Promise<ProcessedImage> {
  await ensureMagickInitialized();

  let result: ProcessedImage | undefined;

  ImageMagick.read(input, (image: MagickImage) => {
    image.autoOrient();
    image.strip();
    image.quality = RESIZED_QUALITY;

    const sanitizedBytes = image.write(
      (data: Uint8Array) => data,
      MagickFormat.Jpeg
    );

    const originalVariant = createVariant(
      sanitizedBytes,
      image.width,
      image.height
    );

    const resizedVariant = createResizedVariant(image, originalVariant);
    const thumbnailVariant = createThumbnailVariant(image);

    const { blurhash, thumbhash } = generatePlaceholders(image);

    result = {
      original: originalVariant,
      resized: resizedVariant,
      thumbnail: thumbnailVariant,
      blurhash,
      thumbhash,
      metadata: buildMetadata(originalVariant),
    };
  });

  if (!result) {
    throw new Error('Failed to process image. No result produced.');
  }

  return result;
}

function createVariant(
  data: Uint8Array,
  width: number,
  height: number
): ImageVariant {
  return {
    data: new Uint8Array(data),
    width,
    height,
    bytes: data.byteLength,
    contentType: 'image/jpeg',
  };
}

function createResizedVariant(
  baseImage: MagickImage,
  fallback: ImageVariant
): ImageVariant {
  const { width, height } = fallback;
  const { width: targetWidth, height: targetHeight } =
    calculateResizeDimensions(width, height, RESIZED_LONG_EDGE);

  if (targetWidth === width && targetHeight === height) {
    return fallback;
  }

  const resizedImage = baseImage.clone();
  resizedImage.resize(new MagickGeometry(targetWidth, targetHeight));
  resizedImage.quality = RESIZED_QUALITY;
  const resizedBytes = resizedImage.write(
    (data: Uint8Array) => data,
    MagickFormat.Jpeg
  );

  const variant = createVariant(
    resizedBytes,
    resizedImage.width,
    resizedImage.height
  );

  resizedImage.dispose();
  return variant;
}

function createThumbnailVariant(baseImage: MagickImage): ImageVariant {
  const { width, height } = calculateResizeDimensions(
    baseImage.width,
    baseImage.height,
    THUMBNAIL_LONG_EDGE
  );

  const thumbnailImage = baseImage.clone();
  thumbnailImage.resize(new MagickGeometry(width, height));
  thumbnailImage.quality = THUMBNAIL_QUALITY;
  const thumbnailBytes = thumbnailImage.write(
    (data: Uint8Array) => data,
    MagickFormat.Jpeg
  );

  const variant = createVariant(
    thumbnailBytes,
    thumbnailImage.width,
    thumbnailImage.height
  );

  thumbnailImage.dispose();
  return variant;
}

function calculateResizeDimensions(
  width: number,
  height: number,
  maxLongEdge: number
): { width: number; height: number } {
  const longEdge = Math.max(width, height);

  if (longEdge <= maxLongEdge) {
    return { width, height };
  }

  const scale = maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function generatePlaceholders(image: MagickImage): {
  blurhash: string;
  thumbhash: string | null;
} {
  let blurhash = DEFAULT_BLURHASH;
  let thumbhash: string | null = null;

  const hashImage = image.clone();
  const { width, height } = calculateResizeDimensions(
    hashImage.width,
    hashImage.height,
    HASH_SAMPLE_LONG_EDGE
  );
  hashImage.resize(new MagickGeometry(width, height));

  const rgbaBytes = hashImage.write(
    (data: Uint8Array) => data,
    MagickFormat.Rgba
  );
  const pixels = new Uint8ClampedArray(
    rgbaBytes.buffer,
    rgbaBytes.byteOffset,
    rgbaBytes.byteLength
  );

  try {
    blurhash = encodeBlurhash(
      pixels,
      hashImage.width,
      hashImage.height,
      BLURHASH_COMPONENT_X,
      BLURHASH_COMPONENT_Y
    );
  } catch (error) {
    console.warn('[image-processing] Failed to generate BlurHash:', error);
  }

  try {
    const thumbhashBytes = rgbaToThumbHash(
      hashImage.width,
      hashImage.height,
      new Uint8Array(rgbaBytes)
    );
    thumbhash = toBase64(thumbhashBytes);
  } catch (error) {
    console.warn('[image-processing] Failed to generate ThumbHash:', error);
  }

  hashImage.dispose();

  return { blurhash, thumbhash };
}

function toBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i += 1) {
    binary += String.fromCharCode(data[i] ?? 0);
  }
  return btoa(binary);
}

function buildMetadata(variant: ImageVariant): ProcessedImageMetadata {
  const aspectRatio = variant.height > 0 ? variant.width / variant.height : 1;
  return {
    width: variant.width,
    height: variant.height,
    aspectRatio,
    bytes: variant.bytes,
    gpsStripped: true,
  };
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
      if (inputBytes.byteLength > MAX_BYTES) {
        controller.abort();
        throw createHttpError(
          413,
          `Media source too large: ${inputBytes.byteLength} bytes exceeds limit of ${MAX_BYTES} bytes.`
        );
      }
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
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function hashBytes(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createHttpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

/**
 * Rate Limiting Middleware for Supabase Edge Functions
 *
 * Provides per-user rate limiting with configurable thresholds and time windows.
 * Uses database-backed counters with atomic increments for concurrency safety.
 *
 * @module rate-limit
 */

interface RateLimitConfig {
  /** Unique identifier for the endpoint (e.g., 'assessments', 'tasks', 'posts') */
  endpoint: string;
  /** Maximum number of requests allowed in the time window */
  limit: number;
  /** Time window in seconds (default: 3600 for 1 hour) */
  windowSeconds?: number;
  /** Number to increment counter by (default: 1, use batch size for batch operations) */
  increment?: number;
}

interface RateLimitResult {
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
async function checkRateLimit(
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
function createRateLimitResponse(
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
async function withRateLimit(
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

// Helper function to fetch with timeout using AbortController
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 2000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

// Resolve a hostname to A and AAAA records using a trusted DNS-over-HTTPS
// resolver (Google DNS). Returns an array of IP strings. This gives us the
// ability to validate the actual IPs the hostname resolves to (defending
// against DNS rebinding attacks).
async function resolveHostnameToIps(hostname: string): Promise<string[]> {
  const records: string[] = [];

  // Query A records
  try {
    const aResp = await fetchWithTimeout(
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
    const aaaaResp = await fetchWithTimeout(
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
