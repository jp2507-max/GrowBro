// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

import { withRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Idempotency-Key',
};

const INFERENCE_SERVICE_URL = Deno.env.get('INFERENCE_SERVICE_URL') || '';
const INFERENCE_TIMEOUT_MS = 5000; // 5s p95 target

interface CloudInferenceImage {
  id: string;
  url: string;
  sha256: string;
  contentType: 'image/jpeg' | 'image/png';
}

interface CloudInferenceRequest {
  idempotencyKey: string;
  assessmentId: string;
  modelVersion?: string;
  images: CloudInferenceImage[];
  plantContext: {
    id: string;
    metadata?: Record<string, unknown>;
  };
  client: {
    appVersion: string;
    platform: 'android' | 'ios';
    deviceModel?: string;
  };
}

interface CloudInferenceResponse {
  success: boolean;
  mode: 'cloud';
  modelVersion: string;
  processingTimeMs: number;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

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
      console.error('[ai-inference] Auth error:', authError);
      return new Response(
        JSON.stringify({
          error: 'Authentication failed',
          code: 'AUTH_FAILED',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check rate limit: 10 assessments per hour
    const rateLimitResponse = await withRateLimit(
      supabaseClient,
      user.id,
      {
        endpoint: 'assessments',
        limit: 10,
        windowSeconds: 3600,
      },
      corsHeaders
    );

    if (rateLimitResponse) {
      console.log(
        `[ai-inference] Rate limit exceeded for user ${user.id.slice(0, 8)}...`
      );
      return rateLimitResponse;
    }

    // Get idempotency key
    const idempotencyKey = req.headers.get('X-Idempotency-Key');
    if (!idempotencyKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing idempotency key',
          code: 'MISSING_IDEMPOTENCY_KEY',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check for existing response (idempotency)
    const { data: existingResponse } = await supabaseClient
      .from('idempotency_keys')
      .select('response_payload')
      .eq('idempotency_key', idempotencyKey)
      .eq('user_id', user.id)
      .single();

    if (existingResponse?.response_payload) {
      console.log(
        '[ai-inference] Returning cached response for',
        idempotencyKey
      );
      return new Response(JSON.stringify(existingResponse.response_payload), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const requestBody: CloudInferenceRequest = await req.json();

    // Validate idempotency key consistency
    if (
      !requestBody.idempotencyKey ||
      requestBody.idempotencyKey !== idempotencyKey
    ) {
      return new Response(
        JSON.stringify({
          error: 'Idempotency key mismatch',
          code: 'IDEMPOTENCY_MISMATCH',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate request
    if (!requestBody.assessmentId || !requestBody.images?.length) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request: missing assessmentId or images',
          code: 'INVALID_REQUEST',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Proxy request to inference microservice
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, INFERENCE_TIMEOUT_MS);

    let inferenceResponse: CloudInferenceResponse;

    try {
      const response = await fetch(INFERENCE_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Inference service returned ${response.status}`);
      }

      inferenceResponse = await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      const error = err as Error;

      if (error.name === 'AbortError') {
        inferenceResponse = {
          success: false,
          mode: 'cloud',
          modelVersion: 'unknown',
          processingTimeMs: Date.now() - startTime,
          error: {
            code: 'TIMEOUT',
            message: 'Inference timeout exceeded',
          },
        };
      } else {
        console.error('[ai-inference] Inference service error:', error);
        inferenceResponse = {
          success: false,
          mode: 'cloud',
          modelVersion: 'unknown',
          processingTimeMs: Date.now() - startTime,
          error: {
            code: 'INFERENCE_SERVICE_ERROR',
            message: error.message || 'Inference service failed',
          },
        };
      }
    } finally {
      clearTimeout(timeoutId);
    }

    // Store response for idempotency (expires in 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await supabaseClient.from('idempotency_keys').insert({
      idempotency_key: idempotencyKey,
      user_id: user.id,
      endpoint: 'ai-inference',
      status: inferenceResponse.success ? 'completed' : 'failed',
      request_payload: requestBody,
      response_payload: inferenceResponse,
      expires_at: expiresAt.toISOString(),
    });

    const totalProcessingTime = Date.now() - startTime;
    console.log(
      `[ai-inference] Completed in ${totalProcessingTime}ms for user ${user.id.slice(0, 8)}...`
    );

    return new Response(JSON.stringify(inferenceResponse), {
      status: inferenceResponse.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const error = err as Error;
    console.error('[ai-inference] Unexpected error:', error);

    const errorResponse: CloudInferenceResponse = {
      success: false,
      mode: 'cloud',
      modelVersion: 'unknown',
      processingTimeMs: Date.now() - startTime,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
