// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Idempotency-Key, X-Client-Tx-Id',
};

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
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl) {
      console.error('SUPABASE_URL environment variable is missing or empty');
      return new Response(JSON.stringify({ error: 'Server misconfiguration: SUPABASE_URL is missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!supabaseKey) {
      console.error('SUPABASE_ANON_KEY environment variable is missing or empty');
      return new Response(JSON.stringify({ error: 'Server misconfiguration: SUPABASE_ANON_KEY is missing' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

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

    // Soft delete with 15-second undo window
    const undoExpiresAt = new Date(Date.now() + 15 * 1000).toISOString();

    const { data, error } = await supabase
      .from('post_comments')
      .update({
        deleted_at: new Date().toISOString(),
        undo_expires_at: undoExpiresAt,
      })
      .eq('id', commentId)
      .eq('user_id', user.id) // Ensure user owns the comment
      .is('deleted_at', null) // Only delete if not already deleted
      .select('id, undo_expires_at')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ error: 'Comment not found or already deleted' }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        undo_expires_at: data.undo_expires_at,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
