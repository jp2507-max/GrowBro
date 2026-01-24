// @ts-nocheck
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { createClient } from 'npm:@supabase/supabase-js@2';

import type { NotificationRequestEntry, ProcessingStats } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const payload = parts[1];
    const padded = payload.padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      '='
    );
    const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\\s+(.+)$/i);
  if (!match) return false;

  const payload = decodeJwtPayload(match[1]);
  const role = typeof payload?.role === 'string' ? payload.role : null;
  return role === 'service_role' || role === 'supabase_admin';
}

/**
 * Sends a single notification request to the send-push-notification Edge Function
 */
async function sendNotification(
  request: NotificationRequestEntry,
  supabaseServiceKey: string,
  supabaseUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extract collapse_key and thread_id from data
    const collapseKey = request.data?.collapse_key || undefined;
    const threadId = request.data?.thread_id || undefined;

    // Build request payload for send-push-notification
    const payload = {
      userId: request.user_id,
      type: request.type,
      title: request.title,
      body: request.body,
      data: request.data || {},
      deepLink: request.deep_link || undefined,
      collapseKey,
      threadId,
    };

    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-push-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json();

    // Check if the send was successful
    if (result.success === false) {
      return {
        success: false,
        error: result.reason || result.error || 'Unknown error',
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: (err as Error)?.message || String(err),
    };
  }
}

/**
 * Implements exponential backoff retry logic
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendWithRetry(
  request: NotificationRequestEntry,
  supabaseServiceKey: string,
  supabaseUrl: string,
  maxRetries = 3
): Promise<{ success: boolean; error?: string }> {
  let lastError = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = await sendNotification(
      request,
      supabaseServiceKey,
      supabaseUrl
    );

    if (result.success) {
      return result;
    }

    lastError = result.error || 'Unknown error';

    // Don't retry on user opt-out or missing tokens
    if (
      lastError.includes('User opted out') ||
      lastError.includes('No active push tokens')
    ) {
      return result;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.log(
        `Retry attempt ${attempt + 1} for request ${request.id} after ${backoffMs}ms`
      );
      await sleep(backoffMs);
    }
  }

  return { success: false, error: lastError };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method Not Allowed' }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }

  try {
    if (!isServiceRoleRequest(req)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          status: 401,
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Atomically claim pending requests to avoid duplicate processing if cron overlaps.
    const { data: requests, error: fetchError } = await supabase.rpc(
      'claim_notification_requests',
      { batch_size: 100 }
    );

    if (fetchError) {
      throw new Error(
        `Failed to fetch notification requests: ${fetchError.message}`
      );
    }

    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending notification requests',
          stats: { processed: 0, succeeded: 0, failed: 0, errors: [] },
        }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
          status: 200,
        }
      );
    }

    console.log(`Processing ${requests.length} notification requests...`);

    const stats: ProcessingStats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    // Process each request (already marked processed by claim_notification_requests)
    for (const request of requests as NotificationRequestEntry[]) {
      stats.processed++;

      // Send notification with retry logic
      const result = await sendWithRetry(
        request,
        supabaseServiceKey,
        supabaseUrl
      );

      if (result.success) {
        stats.succeeded++;
      } else {
        stats.failed++;
        stats.errors.push({
          requestId: request.id,
          error: result.error || 'Unknown error',
        });

        console.error(`Failed to process request ${request.id}:`, result.error);
      }
    }

    console.log('Processing complete:', stats);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${stats.processed} notification requests`,
        stats,
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error)?.message || 'Internal server error',
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 500,
      }
    );
  }
});
