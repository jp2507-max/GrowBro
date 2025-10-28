// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

import { withRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Idempotency-Key, X-Client-Tx-Id',
};

interface CreatePostRequest {
  body: string;
  media_uri?: string;
  client_tx_id?: string;
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

    // Create post
    const { data: post, error: insertError } = await supabaseClient
      .from('posts')
      .insert({
        user_id: user.id,
        body: requestBody.body,
        media_uri: requestBody.media_uri,
        client_tx_id: requestBody.client_tx_id,
      })
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
