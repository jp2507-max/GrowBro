import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// CORS: replace wildcard '*' with an allowlist sourced from the ALLOWED_ORIGINS env var.
// ALLOWED_ORIGINS should be a comma-separated list of allowed origin URLs (e.g. "https://app.example.com,https://admin.example.com").
// We echo back the Origin only when it matches the configured list. If no match, responses omit the Access-Control-Allow-Origin header.
function parseAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? '';
  return raw
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
}

function getValidatedOrigin(req: Request): string | null {
  const origin = req.headers.get('Origin') ?? '';
  if (!origin) return null;
  const allowed = parseAllowedOrigins();
  return allowed.includes(origin) ? origin : null;
}

function makeCorsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  } as Record<string, string>;
}

type DeletePayload = {
  reason?: string;
};

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function getUserId(
  client: SupabaseClient<any, any, any, any, any>
): Promise<string | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id as string;
}

function json(req: Request, payload: unknown, status: number): Response {
  const origin = getValidatedOrigin(req);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (origin) Object.assign(headers, makeCorsHeaders(origin));
  return new Response(JSON.stringify(payload), { status, headers });
}

function guardMethod(req: Request): Response | null {
  const origin = getValidatedOrigin(req);
  const headers: Record<string, string> = {};
  if (origin) Object.assign(headers, makeCorsHeaders(origin));

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers,
    });
  }
  return null;
}

async function createAuthedClient(req: Request): Promise<{
  error?: Response;
  client?: SupabaseClient<any, any, any, any, any>;
}> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return { error: json(req, { error: 'Unauthorized' }, 401) };

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !supabaseKey) {
    return { error: json(req, { error: 'Server misconfiguration' }, 500) };
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    db: { schema: 'privacy' },
    global: { headers: { Authorization: authHeader } },
  });
  return { client };
}

async function queueDeleteJob(
  client: SupabaseClient<any, any, any, any, any>,
  userId: string,
  payload: DeletePayload
) {
  const estimated = addDays(new Date(), 30);
  return await client
    .from('dsr_jobs')
    .insert([
      {
        user_id: userId,
        job_type: 'delete',
        status: 'queued',
        estimated_completion: estimated.toISOString(),
        payload,
      },
    ])
    .select('id, status, estimated_completion')
    .single();
}

async function handler(req: Request): Promise<Response> {
  const method = guardMethod(req);
  if (method) return method;

  try {
    const init = await createAuthedClient(req);
    if (init.error) return init.error;
    const client = init.client!;

    const userId = await getUserId(client);
    if (!userId) return json(req, { error: 'Unauthorized' }, 401);

    let payload: DeletePayload = {};
    try {
      payload = (await req.json()) as DeletePayload;
    } catch {}

    // Return existing active job if present to make delete requests idempotent.
    const existing = await client
      .from('dsr_jobs')
      .select('id, status, estimated_completion')
      .eq('user_id', userId)
      .eq('job_type', 'delete')
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.error) {
      return json(req, { error: existing.error.message }, 500);
    }
    if (existing.data) {
      return json(
        req,
        {
          jobId: existing.data.id,
          status: existing.data.status,
          estimatedCompletion: existing.data.estimated_completion,
        },
        200
      );
    }

    const { data, error } = await queueDeleteJob(client, userId, payload);
    if (error) return json(req, { error: error.message }, 500);

    return json(
      req,
      {
        jobId: data.id,
        status: data.status,
        estimatedCompletion: data.estimated_completion,
      },
      202
    );
  } catch (err) {
    return json(req, { error: String((err as Error)?.message ?? err) }, 500);
  }
}

Deno.serve(handler);
