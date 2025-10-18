// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Idempotency-Key, X-Client-Tx-Id',
};
async function getAuthenticatedUser(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { user, error };
}

async function restoreCommentById(supabase, commentId, userId) {
  return await supabase
    .from('post_comments')
    .update({ deleted_at: null, undo_expires_at: null })
    .eq('id', commentId)
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .gt('undo_expires_at', new Date().toISOString())
    .select('id');
}

async function handleRequest(req: Request) {
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
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    // Validate required environment variables
    const missingVars = [];
    if (!supabaseUrl) missingVars.push('SUPABASE_URL');
    if (!supabaseKey) missingVars.push('SUPABASE_ANON_KEY');

    if (missingVars.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Missing required environment variables: ${missingVars.join(', ')}`,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { user, error: authError } = await getAuthenticatedUser(supabase);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const { commentId } = (await req.json()) as { commentId: string };

    if (!commentId) {
      return new Response(JSON.stringify({ error: 'commentId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Atomically restore the comment with all preconditions checked
    const { data, error } = await restoreCommentById(
      supabase,
      commentId,
      user.id
    );

    // Check if the update affected any rows (409 if preconditions not met)
    if (!error && (!data || data.length === 0)) {
      return new Response(
        JSON.stringify({ error: 'Undo conditions not met' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ id: data[0].id, restored: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
}

Deno.serve((req: Request) => handleRequest(req));
