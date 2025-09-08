// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Generates a deterministic idempotency key from the request body.
 * Uses SHA-256 hash of canonicalized JSON/text body for consistency.
 */
async function generateIdempotencyKey(req: Request): Promise<string> {
  try {
    // Clone the request to avoid consuming the original stream
    const clonedReq = req.clone();
    const bodyText = await clonedReq.text();

    // Handle empty bodies consistently
    if (!bodyText || bodyText.trim() === '') {
      return crypto.randomUUID(); // Fallback for truly empty bodies
    }

    // Canonicalize JSON if possible, otherwise use text as-is
    let canonicalBody: string;
    try {
      const parsed = JSON.parse(bodyText);
      // Canonicalize by sorting keys and pretty-printing consistently
      canonicalBody = JSON.stringify(parsed, Object.keys(parsed).sort(), 2);
    } catch {
      // Not valid JSON, use as plain text
      canonicalBody = bodyText;
    }

    // Compute SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalBody);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return hashHex;
  } catch (error) {
    // If anything fails, fallback to random UUID
    console.warn('Failed to generate deterministic idempotency key:', error);
    return crypto.randomUUID();
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Idempotency-Key',
};

function jsonResponse(
  payload: unknown,
  status: number,
  idemKey: string
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idemKey,
      ...corsHeaders,
    },
  });
}

async function parseAndValidatePayload(
  request: Request,
  idemKey: string
): Promise<
  { lastPulledAt: number | null; changes: Record<string, unknown> } | Response
> {
  const { lastPulledAt, changes } = (await request.json()) as {
    lastPulledAt: number | null;
    changes: Record<string, unknown>;
  };

  if (
    lastPulledAt !== null &&
    (!Number.isFinite(lastPulledAt) || lastPulledAt < 0)
  ) {
    return jsonResponse(
      { error: 'lastPulledAt must be null or a finite non-negative number' },
      400,
      idemKey
    );
  }

  if (
    changes === null ||
    typeof changes !== 'object' ||
    Array.isArray(changes) ||
    // Ensure plain object (no prototype shenanigans)
    (changes as any).constructor !== Object
  ) {
    return jsonResponse(
      { error: 'changes must be a plain non-null object' },
      400,
      idemKey
    );
  }
  return { lastPulledAt, changes };
}

async function applySyncPush(
  client: any,
  payload: { lastPulledAt: number | null; changes: Record<string, unknown> },
  idemKey: string
): Promise<Response> {
  const { lastPulledAt, changes } = payload;
  const { data, error } = await client.rpc('apply_sync_push', {
    last_pulled_at_ms: lastPulledAt ?? 0,
    changes,
    idempotency_key: idemKey,
  });

  if (error) {
    const isConflict = (error.message || '').includes(
      'changed since lastPulledAt'
    );
    return jsonResponse(
      { error: error.message },
      isConflict ? 409 : 500,
      idemKey
    );
  }
  return jsonResponse(data ?? { applied: true }, 200, idemKey);
}

async function validateRequest(req: Request): Promise<
  | {
      authHeader: string;
      idemKey: string;
      supabaseUrl: string;
      supabaseKey: string;
    }
  | Response
> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const providedIdemKey = req.headers.get('Idempotency-Key');
  const idemKey = providedIdemKey ?? (await generateIdempotencyKey(req));
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  // Helper function to create error response with idempotency key
  const createErrorResponse = (error: string, status: number): Response => {
    return new Response(JSON.stringify({ error }), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idemKey,
        ...corsHeaders,
      },
    });
  };

  // Guard: Check for missing Authorization header
  if (!authHeader || authHeader.trim() === '') {
    return createErrorResponse('Authorization header is required', 401);
  }

  // Guard: Check for missing Supabase environment variables
  if (!supabaseUrl || supabaseUrl.trim() === '') {
    return createErrorResponse(
      'SUPABASE_URL environment variable is not configured',
      500
    );
  }

  if (!supabaseKey || supabaseKey.trim() === '') {
    return createErrorResponse(
      'SUPABASE_ANON_KEY environment variable is not configured',
      500
    );
  }

  return { authHeader, idemKey, supabaseUrl, supabaseKey };
}

async function performSync(params: {
  authHeader: string;
  idemKey: string;
  supabaseUrl: string;
  supabaseKey: string;
  req: Request;
}): Promise<Response> {
  const { authHeader, idemKey, supabaseUrl, supabaseKey, req } = params;
  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const parsed = await parseAndValidatePayload(req, idemKey);
  if (parsed instanceof Response) return parsed;
  return await applySyncPush(client, parsed, idemKey);
}

async function handleSyncPush(req: Request): Promise<Response> {
  const validation = await validateRequest(req);
  if (validation instanceof Response) {
    return validation;
  }

  return await performSync({ ...validation, req });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    return await handleSyncPush(req);
  } catch (err) {
    // For unhandled errors, we need to generate the idempotency key here
    const idemKey =
      req.headers.get('Idempotency-Key') ?? (await generateIdempotencyKey(req));
    return new Response(
      JSON.stringify({ error: String((err as Error)?.message ?? err) }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idemKey,
          ...corsHeaders,
        },
      }
    );
  }
});
