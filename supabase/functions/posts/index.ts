import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Idempotency-Key, X-Client-Tx-Id',
};

Deno.serve(async (req: Request) => {
  const { method, url } = req;
  const urlObj = new URL(url);
  const path = urlObj.pathname;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Create Supabase client
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    }
  );

  // 1. Handle POST /posts/add (Legacy creation endpoint)
  // Or handle any POST to this function as a create request
  if (method === 'POST') {
    console.log(
      '[posts-shim] Proxying creation request to create-post function'
    );

    // Proxy to create-post function
    // We can use the internal function URL if we are in local dev,
    // or just invoke it via the client
    const body = await req.json();

    const { data, error } = await supabaseClient.functions.invoke(
      'create-post',
      {
        body,
        headers: {
          'Idempotency-Key': req.headers.get('Idempotency-Key') || '',
          'X-Client-Tx-Id': req.headers.get('X-Client-Tx-Id') || '',
        },
      }
    );

    if (error) {
      console.error('[posts-shim] Proxy error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: error.context?.status || 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 2. Handle GET /posts and GET /posts/:id (Legacy endpoints)
  if (method === 'GET') {
    // Extract ID from path if present (e.g., /posts/123)
    const urlParts = path.split('/').filter(Boolean);
    // Path might be ["posts"] or ["posts", "id"] or just ["id"] if function is named "posts"
    const isList = urlParts.length <= 1;
    const postId = isList ? null : urlParts[urlParts.length - 1];

    if (postId) {
      console.log(`[posts-shim] Fetching single post: ${postId}`);
      const { data, error } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('id', postId)
        .is('deleted_at', null)
        .is('hidden_at', null)
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: error.code === 'PGRST116' ? 404 : 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Listing logic
    const limit = parseInt(urlObj.searchParams.get('limit') || '20', 10);
    const cursor = urlObj.searchParams.get('cursor');

    let query = supabaseClient
      .from('posts')
      .select('*', { count: 'exact' })
      .is('deleted_at', null)
      .is('hidden_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: posts, error, count } = await query;

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Match the previous response format which expect a 'posts' field
    // and potentially other metadata
    return new Response(
      JSON.stringify({
        posts: posts || [],
        count: count || 0,
        next:
          posts?.length === limit ? posts[posts.length - 1].created_at : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
