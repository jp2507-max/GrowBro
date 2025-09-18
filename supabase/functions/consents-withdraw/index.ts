// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

type WithdrawPayload = {
  purposes?: string[]; // e.g., ['telemetry','experiments','aiTraining','crashDiagnostics']
  reason?: string; // optional user-provided reason (avoid PII)
};

async function getUserId(client: any): Promise<string | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id as string;
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function guardMethod(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }
  return null;
}

async function createAuthedClient(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) return { error: json({ error: 'Unauthorized' }, 401) };

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !supabaseKey) {
    return { error: json({ error: 'Server misconfiguration' }, 500) };
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
    db: { schema: 'privacy' },
  });
  return { client };
}

async function insertWithdrawJob(
  client: any,
  userId: string,
  payload: WithdrawPayload
) {
  return await client
    .from('dsr_jobs')
    .insert([
      {
        user_id: userId,
        job_type: 'withdraw',
        status: 'queued',
        payload,
      },
    ])
    .select('id, status')
    .single();
}

async function handler(req: Request): Promise<Response> {
  const method = guardMethod(req);
  if (method) return method;

  try {
    const init = await createAuthedClient(req);
    if ('error' in init) return init.error;
    const { client } = init;

    const userId = await getUserId(client);
    if (!userId) return json({ error: 'Unauthorized' }, 401);

    let payload: WithdrawPayload = {};
    try {
      payload = (await req.json()) as WithdrawPayload;
    } catch {}

    const { data, error } = await insertWithdrawJob(client, userId, payload);
    if (error) return json({ error: error.message }, 500);

    return json({ jobId: data.id, status: data.status }, 202);
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
}

Deno.serve(handler);
