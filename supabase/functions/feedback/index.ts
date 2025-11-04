// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

import { withRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface FeedbackRequest {
  category: 'feature_request' | 'improvement' | 'compliment' | 'other';
  message: string;
  email?: string;
}

interface FeedbackResponse {
  success: boolean;
  message: string;
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

    // Check rate limit: 20 feedback submissions per hour
    const rateLimitResponse = await withRateLimit(
      supabaseClient,
      user.id,
      {
        endpoint: 'feedback',
        limit: 20,
        windowSeconds: 3600,
      },
      corsHeaders
    );

    if (rateLimitResponse) {
      console.log(
        `[feedback] Rate limit exceeded for user ${user.id.slice(0, 8)}...`
      );
      return rateLimitResponse;
    }

    // Parse and validate request body
    const body: FeedbackRequest = await req.json();

    // Validate category
    const validCategories = [
      'feature_request',
      'improvement',
      'compliment',
      'other',
    ];
    if (!body.category || !validCategories.includes(body.category)) {
      return new Response(
        JSON.stringify({
          error:
            'Invalid category. Must be one of: feature_request, improvement, compliment, other',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate message
    if (!body.message || body.message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.message.length > 1000) {
      return new Response(
        JSON.stringify({ error: 'Message cannot exceed 1000 characters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate email if provided
    if (body.email && body.email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return new Response(JSON.stringify({ error: 'Invalid email format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Insert feedback
    const { error: insertError } = await supabaseClient
      .from('feedback')
      .insert({
        user_id: user.id,
        category: body.category,
        message: body.message.trim(),
        email: body.email?.trim() || null,
      });

    if (insertError) {
      console.error('[feedback] Insert error:', insertError);
      return new Response(
        JSON.stringify({
          error: 'Failed to submit feedback',
          message: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(
      `[feedback] Feedback submitted by user ${user.id.slice(0, 8)}... (category: ${body.category})`
    );

    // Return success response
    const response: FeedbackResponse = {
      success: true,
      message: 'Thank you for your feedback! We appreciate your input.',
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[feedback] Unexpected error:', error);
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
