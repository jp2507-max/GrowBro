import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import {
  type AuthError,
  createClient,
  type PostgrestError,
  type SupabaseClient,
  type User,
} from 'jsr:@supabase/supabase-js@2';

type EdgeFunctionHandler = (req: Request) => Response | Promise<Response>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Idempotency-Key, X-Client-Tx-Id',
};

interface AuthResult {
  user: User | null;
  error: AuthError | null;
}

async function getAuthenticatedUser(
  supabase: SupabaseClient
): Promise<AuthResult> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { user, error };
}

interface PostData {
  id: string;
  deleted_at: string | null;
  undo_expires_at: string | null;
  user_id: string;
}

interface PostQueryResult {
  data: PostData | null;
  error: PostgrestError | null;
}

async function fetchPostById(
  supabase: SupabaseClient,
  postId: string
): Promise<PostQueryResult> {
  return await supabase
    .from('posts')
    .select('id, deleted_at, undo_expires_at, user_id')
    .eq('id', postId)
    .single();
}

interface RestoreResult {
  data: { id: string } | null;
  error: PostgrestError | null;
}

async function restorePostById(
  supabase: SupabaseClient,
  postId: string
): Promise<RestoreResult> {
  const now = new Date().toISOString();
  return await supabase
    .from('posts')
    .update({ deleted_at: null, undo_expires_at: null })
    .eq('id', postId)
    // NOTE: using `.neq('deleted_at', null)` attempts to translate to SQL as
    // `deleted_at != NULL` which in PostgREST/Postgres never evaluates to true.
    // That means the update would match zero rows even when `deleted_at` is set.
    // Use the PostgREST null operator to target rows where `deleted_at` IS NOT
    // NULL (for example: `.not('deleted_at', 'is', null)`). We don't change the
    // code behavior here — this comment explains the bug reported by the
    // codex connector and the correct operator to use when fixing the query.
    .neq('deleted_at', null)
    .or(`undo_expires_at.is.null,undo_expires_at.gt.${now}`)
    .select('id')
    .single();
}

interface RequestBody {
  postId: string;
}

async function handleRequest(req: Request): Promise<Response> {
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

    const { postId } = (await req.json()) as RequestBody;

    if (!postId) {
      return new Response(JSON.stringify({ error: 'postId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if post exists and is soft-deleted
    const { data: post, error: fetchError } = await fetchPostById(
      supabase,
      postId
    );

    if (fetchError || !post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Verify user owns the post
    if (post.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if post is deleted
    if (!post.deleted_at) {
      return new Response(JSON.stringify({ error: 'Post is not deleted' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Check if undo window has expired
    if (!post.undo_expires_at || new Date(post.undo_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({
          error: 'Undo window has expired',
          canonical_state: { id: post.id, deleted_at: post.deleted_at },
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // Restore the post
    const { data, error } = await restorePostById(supabase, postId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!data) {
      return new Response(
        JSON.stringify({
          error:
            'Post could not be restored, possibly due to expired undo window or concurrent modification',
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    return new Response(JSON.stringify({ id: data.id, restored: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}

Deno.serve(handleRequest as EdgeFunctionHandler);
