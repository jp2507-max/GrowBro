import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient, SupabaseClient, PostgrestSingleResponse, PostgrestError } from 'npm:@supabase/supabase-js@2';

interface DeletePostPayload {
  postId: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Idempotency-Key, X-Client-Tx-Id',
};

Deno.serve(async (req: Request): Promise<Response> => {
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
    const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
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

    const body = await req.json();
    if (typeof body !== 'object' || body === null || !('postId' in body)) {
      return new Response(JSON.stringify({ error: 'postId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const payload: DeletePostPayload = body as DeletePostPayload;
    if (!payload.postId || typeof payload.postId !== 'string') {
      return new Response(JSON.stringify({ error: 'postId must be a non-empty string' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Soft delete with 15-second undo window
    const undoExpiresAt = new Date(Date.now() + 15 * 1000).toISOString();

    const { data, error }: PostgrestSingleResponse<{ id: string; undo_expires_at: string }> = await supabase
      .from('posts')
      .update({
        deleted_at: new Date().toISOString(),
        undo_expires_at: undoExpiresAt,
      })
      .eq('id', payload.postId)
      .eq('user_id', user.id) // Ensure user owns the post
      .is('deleted_at', null) // Only delete if not already deleted
      .select('id, undo_expires_at')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(
          JSON.stringify({ error: 'Post not found or already deleted' }),
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
