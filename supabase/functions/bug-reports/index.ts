// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

import { withRateLimit } from '../_shared/rate-limit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface BugReportRequest {
  title: string;
  description: string;
  category: 'crash' | 'bug' | 'performance' | 'ui' | 'other';
  screenshotUrl?: string;
  diagnostics?: {
    appVersion: string;
    buildNumber: string;
    deviceModel: string;
    osVersion: string;
    locale: string;
    freeStorage?: number;
    lastSyncTime?: string;
    networkStatus: 'online' | 'offline';
  };
  sentryEventId?: string;
}

interface BugReportResponse {
  ticketId: string;
  message: string;
}

/**
 * Generate a unique ticket ID for bug reports
 * Format: BUG-YYYYMMDD-RANDOM6
 */
function generateTicketId(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BUG-${datePart}-${randomPart}`;
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

    // Check rate limit: 10 bug reports per hour
    const rateLimitResponse = await withRateLimit(
      supabaseClient,
      user.id,
      {
        endpoint: 'bug-reports',
        limit: 10,
        windowSeconds: 3600,
      },
      corsHeaders
    );

    if (rateLimitResponse) {
      console.log(
        `[bug-reports] Rate limit exceeded for user ${user.id.slice(0, 8)}...`
      );
      return rateLimitResponse;
    }

    // Parse and validate request body
    const body: BugReportRequest = await req.json();

    // Validate required fields
    if (!body.title || body.title.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Title is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (body.title.length > 200) {
      return new Response(
        JSON.stringify({ error: 'Title cannot exceed 200 characters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!body.description || body.description.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Description is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (body.description.length > 2000) {
      return new Response(
        JSON.stringify({ error: 'Description cannot exceed 2000 characters' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate category
    const validCategories = ['crash', 'bug', 'performance', 'ui', 'other'];
    if (!body.category || !validCategories.includes(body.category)) {
      return new Response(
        JSON.stringify({
          error:
            'Invalid category. Must be one of: crash, bug, performance, ui, other',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate unique ticket ID
    const ticketId = generateTicketId();

    // Insert bug report
    const { error: insertError } = await supabaseClient
      .from('bug_reports')
      .insert({
        ticket_id: ticketId,
        user_id: user.id,
        title: body.title.trim(),
        description: body.description.trim(),
        category: body.category,
        screenshot_url: body.screenshotUrl,
        diagnostics: body.diagnostics,
        sentry_event_id: body.sentryEventId,
        status: 'open',
      });

    if (insertError) {
      console.error('[bug-reports] Insert error:', insertError);
      return new Response(
        JSON.stringify({
          error: 'Failed to submit bug report',
          message: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(
      `[bug-reports] Created ticket ${ticketId} for user ${user.id.slice(0, 8)}...`
    );

    // Return success response with ticket ID
    const response: BugReportResponse = {
      ticketId,
      message: `Bug report submitted successfully. Your ticket ID is ${ticketId}`,
    };

    return new Response(JSON.stringify(response), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[bug-reports] Unexpected error:', error);
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
